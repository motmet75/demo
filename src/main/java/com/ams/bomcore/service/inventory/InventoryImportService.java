package com.ams.bomcore.service.inventory;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.domain.contract.Contract;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.InventoryMovementEntity;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.repository.ContractRepository;
import com.ams.bomcore.repository.InventoryMovementRepository;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.WarehouseRepository;

/**
 * Service to import inventory from CSV file.
 * CSV format (header row required):
 * material_code,warehouse_code,batch_no,quantity_on_hand,contract_code,unit,unit_price,currency,
 * hs_code,origin_type,origin_country,xform_no,cds_no,purchase_no,order_to_deduction,
 * quantity_reserved,quantity_locked,material_quota,material_quota_percentage,user_name,
 * xform_date,purchase_date_time,cds_date_time,production_date_time,expiration_date_time,
 * visible,approved,locked
 */
@Service
public class InventoryImportService {

    private final InventoryRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final WarehouseRepository warehouseRepository;
    private final ContractRepository contractRepository;
    private final InventoryMovementRepository movementRepository;

    public InventoryImportService(
            InventoryRepository inventoryRepository,
            MaterialRepository materialRepository,
            WarehouseRepository warehouseRepository,
            ContractRepository contractRepository,
            InventoryMovementRepository movementRepository) {
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
        this.contractRepository = contractRepository;
        this.movementRepository = movementRepository;
    }

    /**
     * Import inventory from CSV file.
     * Returns a result object with success status, created count, and error messages.
     */
    @Transactional(rollbackFor = Exception.class)
    public ImportResult importFromCsv(MultipartFile file, UUID tenantId, UUID companyId) {
        ImportResult result = new ImportResult();
        List<String> missingMaterials = new ArrayList<>();
        List<String> missingWarehouses = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int createdCount = 0;
        int updatedCount = 0;

        try (InputStream is = file.getInputStream();
             BufferedReader reader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {

            String headerLine = reader.readLine();
            if (headerLine == null) {
                result.setSuccess(false);
                result.setMessage("CSV file is empty");
                return result;
            }

            // Parse header to get column indices
            String[] headers = parseCsvLine(headerLine);
            Map<String, Integer> columnMap = buildColumnMap(headers);

            // First pass: validate all materials exist
            List<CsvRow> rows = new ArrayList<>();
            String line;
            int lineNumber = 1;

            while ((line = reader.readLine()) != null) {
                lineNumber++;
                if (line.trim().isEmpty()) continue;

                try {
                    String[] values = parseCsvLine(line);
                    CsvRow row = parseRow(values, columnMap, lineNumber);
                    rows.add(row);

                    // Validate material exists
                    if (row.materialCode == null || row.materialCode.trim().isEmpty()) {
                        errors.add("Line " + lineNumber + ": material_code is required");
                        continue;
                    }

                    // Check warehouse
                    if (row.warehouseCode == null || row.warehouseCode.trim().isEmpty()) {
                        errors.add("Line " + lineNumber + ": warehouse_code is required");
                        continue;
                    }

                    // Check batch_no
                    if (row.batchNo == null || row.batchNo.trim().isEmpty()) {
                        errors.add("Line " + lineNumber + ": batch_no is required");
                    }

                } catch (Exception e) {
                    errors.add("Line " + lineNumber + ": " + e.getMessage());
                }
            }

            // Check all materials exist before processing
            for (CsvRow row : rows) {
                if (row.materialCode != null && !row.materialCode.trim().isEmpty()) {
                    Optional<Material> mat = materialRepository.findByMaterialCodeAndTenantIdAndCompanyId(
                            row.materialCode, tenantId, companyId);
                    if (mat.isEmpty()) {
                        if (!missingMaterials.contains(row.materialCode)) {
                            missingMaterials.add(row.materialCode);
                        }
                    }
                }
                if (row.warehouseCode != null && !row.warehouseCode.trim().isEmpty()) {
                    Optional<WarehouseEntity> wh = warehouseRepository.findByCodeAndTenantIdAndCompanyId(
                            row.warehouseCode, tenantId, companyId);
                    if (wh.isEmpty()) {
                        if (!missingWarehouses.contains(row.warehouseCode)) {
                            missingWarehouses.add(row.warehouseCode);
                        }
                    }
                }
            }

            // If any materials are missing, stop and report
            if (!missingMaterials.isEmpty()) {
                result.setSuccess(false);
                result.setMessage("Cannot import: missing materials in system");
                result.setMissingMaterials(missingMaterials);
                result.setErrors(errors);
                return result;
            }

            if (!missingWarehouses.isEmpty()) {
                result.setSuccess(false);
                result.setMessage("Cannot import: missing warehouses in system");
                result.setMissingWarehouses(missingWarehouses);
                result.setErrors(errors);
                return result;
            }

            // Second pass: create or update inventory records
            for (CsvRow row : rows) {
                try {
                    // Lookup entities by code with tenant+company scope
                    Material material = materialRepository.findByMaterialCodeAndTenantIdAndCompanyId(
                            row.materialCode, tenantId, companyId)
                            .orElseThrow(() -> new RuntimeException("Material not found: " + row.materialCode));
                    WarehouseEntity warehouse = warehouseRepository.findByCodeAndTenantIdAndCompanyId(
                            row.warehouseCode, tenantId, companyId)
                            .orElseThrow(() -> new RuntimeException("Warehouse not found: " + row.warehouseCode));

                    // Lookup contract if provided (with tenant+company scope)
                    UUID contractId = null;
                    if (row.contractCode != null && !row.contractCode.trim().isEmpty()) {
                        Optional<Contract> contract = contractRepository.findByContractNumberAndTenant_IdAndCompany_Id(
                                row.contractCode, tenantId, companyId);
                        if (contract.isPresent()) {
                            contractId = contract.get().getId();
                        }
                    }

                    // Find existing or create new - with tenant+company scope
                    // First check if there's any existing record with this business key
                    Optional<InventoryEntity> anyExisting = inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNo(
                            material, warehouse.getCode(), row.batchNo);
                    
                    // If a record exists, verify it belongs to the same tenant+company
                    if (anyExisting.isPresent()) {
                        InventoryEntity existingRecord = anyExisting.get();
                        if (!existingRecord.getTenantId().equals(tenantId) || !existingRecord.getCompanyId().equals(companyId)) {
                            throw new RuntimeException(
                                "Cannot import: An inventory record already exists for a different tenant/company. " +
                                "Material: " + row.materialCode + 
                                ", Warehouse: " + row.warehouseCode + 
                                ", Batch: " + row.batchNo + 
                                ". This violates the unique constraint (tenant_id, company_id, warehouse_id, material_id, batch_no)."
                            );
                        }
                    }
                    
                    // Now find with tenant+company scope to get or create
                    Optional<InventoryEntity> existing = inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNoAndTenantIdAndCompanyId(
                            material, warehouse.getCode(), row.batchNo, tenantId, companyId);

                    InventoryEntity inv;
                    boolean isNew = false;
                    if (existing.isPresent()) {
                        inv = existing.get();
                        // Verify the existing record belongs to same tenant+company
                        if (!inv.getTenantId().equals(tenantId) || !inv.getCompanyId().equals(companyId)) {
                            throw new RuntimeException("Duplicate inventory found but belongs to different tenant/company. " +
                                    "This violates unique constraint: (company_id, tenant_id, warehouse_id, material_id, batch_no). " +
                                    "Material: " + row.materialCode + ", Warehouse: " + row.warehouseCode + ", Batch: " + row.batchNo);
                        }
                    } else {
                        inv = new InventoryEntity();
                        inv.setMaterial(material);
                        inv.setWarehouse(warehouse);
                        inv.setBatchNo(row.batchNo);
                        inv.setTenantId(tenantId);
                        inv.setCompanyId(companyId);
                        isNew = true;
                    }

                    // Set all fields from CSV
                    inv.setQuantityOnHand(row.quantityOnHand != null ? row.quantityOnHand : BigDecimal.ZERO);
                    inv.setQuantityTotal(row.quantityTotal != null ? row.quantityTotal : (row.quantityOnHand != null ? row.quantityOnHand : BigDecimal.ZERO));
                    inv.setQuantityReserved(row.quantityReserved != null ? row.quantityReserved : BigDecimal.ZERO);
                    inv.setQuantityLocked(row.quantityLocked != null ? row.quantityLocked : BigDecimal.ZERO);
                    inv.setMaterialQuota(row.materialQuota);
                    inv.setMaterialQuotaPercentage(row.materialQuotaPercentage);
                    
                    inv.setContractId(contractId);
                    inv.setContractCode(row.contractCode);
                    inv.setOrderToDeduction(row.orderToDeduction);
                    inv.setUserName(row.userName != null && !row.userName.trim().isEmpty() ? row.userName : "system");
                    inv.setUnit(row.unit != null && !row.unit.trim().isEmpty() ? row.unit : "pcs");
                    inv.setUnitPrice(row.unitPrice != null ? row.unitPrice : BigDecimal.ZERO);
                    inv.setCurrency(row.currency != null && !row.currency.trim().isEmpty() ? row.currency : "USD");
                    
                    inv.setHsCode(row.hsCode);
                    inv.setOriginType(row.originType);
                    inv.setOriginCountry(row.originCountry);
                    
                    inv.setXformNo(row.xformNo);
                    inv.setCdsNo(row.cdsNo);
                    inv.setPurchaseNo(row.purchaseNo);
                    
                    inv.setXformDate(row.xformDate);
                    inv.setPurchaseDateTime(row.purchaseDateTime);
                    inv.setCdsDateTime(row.cdsDateTime);
                    inv.setProductionDateTime(row.productionDateTime);
                    inv.setExpirationDateTime(row.expirationDateTime);
                    
                    inv.setVisible(row.visible != null ? row.visible : true);
                    inv.setApproved(row.approved != null ? row.approved : false);
                    inv.setLocked(row.locked != null ? row.locked : false);
                    
                    // Sync denormalized codes
                    inv.setMaterialCodeDenorm(material.getMaterialCode());
                    inv.setWarehouseCodeDenorm(warehouse.getCode());

                    inventoryRepository.save(inv);

                    // Record inventory movement for each imported row
                    try {
                        InventoryMovementEntity movement = new InventoryMovementEntity();
                        movement.setTenantId(tenantId);
                        movement.setCompanyId(companyId);
                        movement.setMaterial(material);
                        movement.setToWarehouse(warehouse);
                        movement.setQuantity(row.quantityOnHand != null ? row.quantityOnHand : BigDecimal.ZERO);
                        movement.setUnit(row.unit != null && !row.unit.trim().isEmpty() ? row.unit : "pcs");
                        movement.setMovementType(isNew ? "IMPORT" : "IMPORT_UPDATE");
                        movement.setReason("CSV Import");
                        movement.setReferenceType("INVENTORY");
                        movement.setReferenceId(inv.getId());
                        movement.setBatchNo(row.batchNo);
                        movement.setCreatedBy("system");
                        movement.setStatus("COMPLETED");
                        movementRepository.save(movement);
                    } catch (Exception movEx) {
                        // movement logging is non-critical — don't fail the import
                    }

                    if (isNew) {
                        createdCount++;
                    } else {
                        updatedCount++;
                    }

                } catch (org.springframework.dao.DataIntegrityViolationException e) {
                    // Handle constraint violation
                    String constraintError = "CONSTRAINT VIOLATION - Duplicate inventory record detected. " +
                            "The combination (company_id, tenant_id, warehouse_id, material_id, batch_no) must be unique. " +
                            "Material: " + row.materialCode + ", Warehouse: " + row.warehouseCode + ", Batch: " + row.batchNo;
                    errors.add("Line " + row.lineNumber + ": " + constraintError);
                    // Transaction will rollback due to @Transactional(rollbackFor = Exception.class)
                    throw new RuntimeException(constraintError, e);
                } catch (Exception e) {
                    errors.add("Line " + row.lineNumber + ": " + e.getMessage());
                    // Re-throw to trigger rollback
                    throw e;
                }
            }

            result.setSuccess(errors.isEmpty());
            result.setCreated(createdCount);
            result.setUpdated(updatedCount);
            result.setErrors(errors);
            result.setMessage(String.format("Import completed: %d created, %d updated, %d errors", 
                    createdCount, updatedCount, errors.size()));

        } catch (Exception e) {
            result.setSuccess(false);
            result.setMessage("Failed to read CSV file: " + e.getMessage());
            result.getErrors().add(e.getMessage());
        }

        return result;
    }

    private Map<String, Integer> buildColumnMap(String[] headers) {
        Map<String, Integer> map = new HashMap<>();
        for (int i = 0; i < headers.length; i++) {
            map.put(headers[i].trim().toLowerCase(), i);
        }
        return map;
    }

    private String[] parseCsvLine(String line) {
        // Simple CSV parser (does not handle quotes with commas inside)
        return line.split(",", -1);
    }

    private CsvRow parseRow(String[] values, Map<String, Integer> columnMap, int lineNumber) {
        CsvRow row = new CsvRow();
        row.lineNumber = lineNumber;
        
        row.materialCode = getColumnValue(values, columnMap, "material_code");
        row.warehouseCode = getColumnValue(values, columnMap, "warehouse_code");
        row.batchNo = getColumnValue(values, columnMap, "batch_no");
        row.contractCode = getColumnValue(values, columnMap, "contract_code");
        row.orderToDeduction = getColumnValue(values, columnMap, "order_to_deduction");
        row.userName = getColumnValue(values, columnMap, "user_name");
        row.unit = getColumnValue(values, columnMap, "unit");
        row.currency = getColumnValue(values, columnMap, "currency");
        row.hsCode = getColumnValue(values, columnMap, "hs_code");
        row.originType = getColumnValue(values, columnMap, "origin_type");
        row.originCountry = getColumnValue(values, columnMap, "origin_country");
        row.xformNo = getColumnValue(values, columnMap, "xform_no");
        row.cdsNo = getColumnValue(values, columnMap, "cds_no");
        row.purchaseNo = getColumnValue(values, columnMap, "purchase_no");
        
        row.quantityOnHand = parseBigDecimal(getColumnValue(values, columnMap, "quantity_on_hand"));
        row.quantityTotal = parseBigDecimal(getColumnValue(values, columnMap, "quantity_total"));
        row.quantityReserved = parseBigDecimal(getColumnValue(values, columnMap, "quantity_reserved"));
        row.quantityLocked = parseBigDecimal(getColumnValue(values, columnMap, "quantity_locked"));
        row.materialQuota = parseBigDecimal(getColumnValue(values, columnMap, "material_quota"));
        row.materialQuotaPercentage = parseBigDecimal(getColumnValue(values, columnMap, "material_quota_percentage"));
        row.unitPrice = parseBigDecimal(getColumnValue(values, columnMap, "unit_price"));
        
        row.xformDate = parseLocalDate(getColumnValue(values, columnMap, "xform_date"));
        row.purchaseDateTime = parseInstant(getColumnValue(values, columnMap, "purchase_date_time"));
        row.cdsDateTime = parseInstant(getColumnValue(values, columnMap, "cds_date_time"));
        row.productionDateTime = parseInstant(getColumnValue(values, columnMap, "production_date_time"));
        row.expirationDateTime = parseInstant(getColumnValue(values, columnMap, "expiration_date_time"));
        
        row.visible = parseBoolean(getColumnValue(values, columnMap, "visible"));
        row.approved = parseBoolean(getColumnValue(values, columnMap, "approved"));
        row.locked = parseBoolean(getColumnValue(values, columnMap, "locked"));
        
        return row;
    }

    private String getColumnValue(String[] values, Map<String, Integer> columnMap, String columnName) {
        Integer idx = columnMap.get(columnName);
        if (idx == null || idx >= values.length) return null;
        String val = values[idx].trim();
        return val.isEmpty() ? null : val;
    }

    private BigDecimal parseBigDecimal(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        try {
            return new BigDecimal(value.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private LocalDate parseLocalDate(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        try {
            return LocalDate.parse(value.trim(), DateTimeFormatter.ISO_LOCAL_DATE);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private Instant parseInstant(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        try {
            return Instant.parse(value.trim());
        } catch (DateTimeParseException e) {
            // Try parsing as ISO_LOCAL_DATE_TIME and convert to instant
            try {
                return LocalDate.parse(value.trim(), DateTimeFormatter.ISO_LOCAL_DATE).atStartOfDay().toInstant(java.time.ZoneOffset.UTC);
            } catch (DateTimeParseException e2) {
                return null;
            }
        }
    }

    private Boolean parseBoolean(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        String v = value.trim().toLowerCase();
        return v.equals("true") || v.equals("1") || v.equals("yes") || v.equals("y");
    }

    // Inner classes for structured data
    private static class CsvRow {
        int lineNumber;
        String materialCode;
        String warehouseCode;
        String batchNo;
        String contractCode;
        String orderToDeduction;
        String userName;
        String unit;
        String currency;
        String hsCode;
        String originType;
        String originCountry;
        String xformNo;
        String cdsNo;
        String purchaseNo;
        BigDecimal quantityOnHand;
        BigDecimal quantityTotal;
        BigDecimal quantityReserved;
        BigDecimal quantityLocked;
        BigDecimal materialQuota;
        BigDecimal materialQuotaPercentage;
        BigDecimal unitPrice;
        LocalDate xformDate;
        Instant purchaseDateTime;
        Instant cdsDateTime;
        Instant productionDateTime;
        Instant expirationDateTime;
        Boolean visible;
        Boolean approved;
        Boolean locked;
    }

    public static class ImportResult {
        private boolean success;
        private String message;
        private int created;
        private int updated;
        private List<String> errors = new ArrayList<>();
        private List<String> missingMaterials = new ArrayList<>();
        private List<String> missingWarehouses = new ArrayList<>();

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public int getCreated() { return created; }
        public void setCreated(int created) { this.created = created; }
        public int getUpdated() { return updated; }
        public void setUpdated(int updated) { this.updated = updated; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }
        public List<String> getMissingMaterials() { return missingMaterials; }
        public void setMissingMaterials(List<String> missingMaterials) { this.missingMaterials = missingMaterials; }
        public List<String> getMissingWarehouses() { return missingWarehouses; }
        public void setMissingWarehouses(List<String> missingWarehouses) { this.missingWarehouses = missingWarehouses; }
    }
}
