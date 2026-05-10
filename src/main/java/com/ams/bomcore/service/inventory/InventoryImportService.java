package com.ams.bomcore.service.inventory;

import java.io.InputStream;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.*;
import java.util.stream.Collectors;

import org.apache.poi.ss.usermodel.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.InventoryMovementEntity;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.repository.InventoryMovementRepository;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.WarehouseRepository;

@Service
public class InventoryImportService {

    private final InventoryRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final WarehouseRepository warehouseRepository;
    private final InventoryMovementRepository movementRepository;

    public InventoryImportService(
            InventoryRepository inventoryRepository,
            MaterialRepository materialRepository,
            WarehouseRepository warehouseRepository,
            InventoryMovementRepository movementRepository) {
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
        this.movementRepository = movementRepository;
    }

    @Transactional(rollbackFor = Exception.class)
    public ImportResult importFromCsv(MultipartFile file, UUID tenantId, UUID companyId) {
        ImportResult result = new ImportResult();
        List<String> errors = new ArrayList<>();

        try (InputStream is = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            if (sheet.getPhysicalNumberOfRows() <= 1) {
                result.setSuccess(false);
                result.setMessage("Excel file is empty");
                return result;
            }

            // 1. Build Header Map
            Row headerRow = sheet.getRow(0);
            Map<String, Integer> columnMap = new HashMap<>();
            for (Cell cell : headerRow) {
                columnMap.put(cell.getStringCellValue().trim().toLowerCase(), cell.getColumnIndex());
            }

            List<CsvRow> rawRows = new ArrayList<>();
            Set<String> matCodes = new HashSet<>();
            Set<String> whCodes = new HashSet<>();

            // 2. Parse all rows into memory first
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;

                CsvRow data = parseExcelRow(row, columnMap, i + 1);
                if (data.materialCode != null && data.warehouseCode != null && data.batchNo != null) {
                    rawRows.add(data);
                    matCodes.add(data.materialCode);
                    whCodes.add(data.warehouseCode);
                } else {
                    errors.add("Line " + (i + 1) + ": Missing required fields (Material, Warehouse, or Batch)");
                }
            }

            // 3. Bulk Fetch Master Data (The "Fast" part)
            Map<String, Material> materialMap = materialRepository
                .findAllByMaterialCodeInAndTenantIdAndCompanyId(matCodes, tenantId, companyId)
                .stream().collect(Collectors.toMap(Material::getMaterialCode, m -> m));

            Map<String, WarehouseEntity> warehouseMap = warehouseRepository
                .findAllByCodeInAndTenantIdAndCompanyId(whCodes, tenantId, companyId)
                .stream().collect(Collectors.toMap(WarehouseEntity::getCode, w -> w));

            // Validate master data existence
            List<String> missingMats = matCodes.stream().filter(c -> !materialMap.containsKey(c)).toList();
            List<String> missingWhs = whCodes.stream().filter(c -> !warehouseMap.containsKey(c)).toList();

            if (!missingMats.isEmpty() || !missingWhs.isEmpty()) {
                result.setSuccess(false);
                result.setMessage("Missing master data");
                result.setMissingMaterials(missingMats);
                result.setMissingWarehouses(missingWhs);
                return result;
            }

            // 4. Bulk Fetch Existing Inventory to check for updates
            // Creates a lookup key: materialCode|warehouseCode|batchNo
            Map<String, InventoryEntity> existingInvMap = inventoryRepository
                .findAllByTenantIdAndCompanyId(tenantId, companyId)
                .stream().collect(Collectors.toMap(
                    inv -> inv.getMaterial().getMaterialCode() + "|" + inv.getWarehouse().getCode() + "|" + inv.getBatchNo(),
                    inv -> inv
                ));

            List<InventoryEntity> toSave = new ArrayList<>();
            List<InventoryMovementEntity> movements = new ArrayList<>();

            // 5. Process everything in memory
            for (CsvRow row : rawRows) {
                String key = row.materialCode + "|" + row.warehouseCode + "|" + row.batchNo;
                InventoryEntity inv = existingInvMap.getOrDefault(key, new InventoryEntity());
                boolean isNew = (inv.getId() == null);

                if (isNew) {
                    inv.setMaterial(materialMap.get(row.materialCode));
                    inv.setWarehouse(warehouseMap.get(row.warehouseCode));
                    inv.setBatchNo(row.batchNo);
                    inv.setTenantId(tenantId);
                    inv.setCompanyId(companyId);
                }

                // Update fields
                inv.setQuantityOnHand(row.quantityOnHand != null ? row.quantityOnHand : BigDecimal.ZERO);
                inv.setUnit(row.unit != null ? row.unit : "pcs");
                inv.setCurrency(row.currency != null ? row.currency : "USD");
                inv.setMaterialCodeDenorm(row.materialCode);
                inv.setWarehouseCodeDenorm(row.warehouseCode);
                inv.setVisible(true);
                
                toSave.add(inv);

                // Movement Record
                InventoryMovementEntity move = new InventoryMovementEntity();
                move.setTenantId(tenantId);
                move.setCompanyId(companyId);
                move.setMaterial(inv.getMaterial());
                move.setToWarehouse(inv.getWarehouse());
                move.setQuantity(inv.getQuantityOnHand());
                move.setMovementType(isNew ? "IMPORT" : "IMPORT_UPDATE");
                move.setBatchNo(row.batchNo);
                move.setStatus("COMPLETED");
                movements.add(move);
            }

            // 6. Batch Save
            inventoryRepository.saveAll(toSave);
            movementRepository.saveAll(movements);

            result.setSuccess(true);
            result.setCreated(toSave.size());
            result.setMessage("Successfully processed " + toSave.size() + " records.");

        } catch (Exception e) {
            result.setSuccess(false);
            result.setMessage("Excel error: " + e.getMessage());
        }

        return result;
    }

    private CsvRow parseExcelRow(Row row, Map<String, Integer> columnMap, int line) {
        CsvRow r = new CsvRow();
        r.lineNumber = line;
        r.materialCode = getCellValue(row, columnMap, "material_code");
        r.warehouseCode = getCellValue(row, columnMap, "warehouse_code");
        r.batchNo = getCellValue(row, columnMap, "batch_no");
        r.unit = getCellValue(row, columnMap, "unit");
        r.currency = getCellValue(row, columnMap, "currency");
        
        String qty = getCellValue(row, columnMap, "quantity_on_hand");
        if (qty != null) r.quantityOnHand = new BigDecimal(qty.replace(",", ""));
        
        return r;
    }

    private String getCellValue(Row row, Map<String, Integer> map, String colName) {
        Integer idx = map.get(colName);
        if (idx == null) return null;
        Cell cell = row.getCell(idx);
        if (cell == null) return null;
        return new DataFormatter().formatCellValue(cell).trim();
    }

    private boolean isRowEmpty(Row row) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) return false;
        }
        return true;
    }

    private static class CsvRow {
        int lineNumber;
        String materialCode;
        String warehouseCode;
        String batchNo;
        String unit;
        String currency;
        BigDecimal quantityOnHand;
    }

    public static class ImportResult {
        private boolean success;
        private String message;
        private int created;
        private List<String> errors = new ArrayList<>();
        private List<String> missingMaterials = new ArrayList<>();
        private List<String> missingWarehouses = new ArrayList<>();

        // Getters and Setters
        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public int getCreated() { return created; }
        public void setCreated(int created) { this.created = created; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }
        public List<String> getMissingMaterials() { return missingMaterials; }
        public void setMissingMaterials(List<String> m) { this.missingMaterials = m; }
        public List<String> getMissingWarehouses() { return missingWarehouses; }
        public void setMissingWarehouses(List<String> w) { this.missingWarehouses = w; }
    }
}