package com.ams.bomcore.service.inventory;

import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
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
import com.ams.bomcore.domain.modelbom.ModelBom;
import com.ams.bomcore.repository.InventoryMovementRepository;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.ModelBomRepository;
import com.ams.bomcore.repository.WarehouseRepository;

@Service
public class InventoryImportService {

    private final InventoryRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final WarehouseRepository warehouseRepository;
    private final InventoryMovementRepository movementRepository;
    private final ModelBomRepository modelBomRepository;

    public InventoryImportService(
            InventoryRepository inventoryRepository,
            MaterialRepository materialRepository,
            WarehouseRepository warehouseRepository,
            InventoryMovementRepository movementRepository,
            ModelBomRepository modelBomRepository) {
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
        this.movementRepository = movementRepository;
        this.modelBomRepository = modelBomRepository;
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

            // =========================================================
            // 1. HEADER MAP
            // =========================================================
            Row headerRow = sheet.getRow(0);

            Map<String, Integer> columnMap = new HashMap<>();

            for (Cell cell : headerRow) {
                columnMap.put(
                        cell.getStringCellValue().trim().toLowerCase(),
                        cell.getColumnIndex()
                );
            }

            List<CsvRow> rawRows = new ArrayList<>();

            Set<String> matCodes = new HashSet<>();
            Set<String> whCodes = new HashSet<>();

            // =========================================================
            // 2. PARSE EXCEL ROWS
            // =========================================================
            for (int i = 1; i <= sheet.getLastRowNum(); i++) {

                Row row = sheet.getRow(i);

                if (row == null || isRowEmpty(row)) {
                    continue;
                }

                CsvRow data = parseExcelRow(row, columnMap, i + 1);

                if (data.materialCode != null
                        && data.warehouseCode != null
                        && data.batchNo != null) {

                    rawRows.add(data);

                    matCodes.add(data.materialCode);
                    whCodes.add(data.warehouseCode);

                } else {
                    errors.add(
                            "Line " + (i + 1)
                                    + ": Missing required fields (material_code, warehouse_code, batch_no)"
                    );
                }
            }

            // =========================================================
            // 3. LOAD MATERIALS
            // =========================================================
            Map<String, Material> materialMap =
                    materialRepository
                            .findAllByMaterialCodeInAndTenantIdAndCompanyId(
                                    matCodes,
                                    tenantId,
                                    companyId
                            )
                            .stream()
                            .collect(Collectors.toMap(
                                    Material::getMaterialCode,
                                    m -> m
                            ));

            // =========================================================
            // 4. LOAD WAREHOUSES
            // =========================================================
            Map<String, WarehouseEntity> warehouseMap =
                    warehouseRepository
                            .findAllByCodeInAndTenantIdAndCompanyId(
                                    whCodes,
                                    tenantId,
                                    companyId
                            )
                            .stream()
                            .collect(Collectors.toMap(
                                    WarehouseEntity::getCode,
                                    w -> w
                            ));

            // =========================================================
            // 5. VALIDATE MASTER DATA
            // =========================================================
            List<String> missingMats = matCodes.stream()
                    .filter(c -> !materialMap.containsKey(c))
                    .toList();

            List<String> missingWhs = whCodes.stream()
                    .filter(c -> !warehouseMap.containsKey(c))
                    .toList();

            if (!missingMats.isEmpty() || !missingWhs.isEmpty()) {

                result.setSuccess(false);
                result.setMessage("Missing master data");

                result.setMissingMaterials(missingMats);
                result.setMissingWarehouses(missingWhs);

                return result;
            }

            for (CsvRow row : rawRows) {
                applyWarehouseConversion(row, materialMap.get(row.materialCode), tenantId, companyId, errors);
            }
            if (!errors.isEmpty()) {
                result.setSuccess(false);
                result.setMessage("Import validation failed");
                result.setErrors(errors);
                return result;
            }

            // =========================================================
            // 6. LOAD EXISTING INVENTORY
            // =========================================================
            Map<String, InventoryEntity> existingInvMap =
                    inventoryRepository
                            .findAllByTenantIdAndCompanyId(tenantId, companyId)
                            .stream()
                            .collect(Collectors.toMap(
                                    inv ->
                                            inv.getMaterial().getMaterialCode()
                                                    + "|"
                                                    + inv.getWarehouse().getCode()
                                                    + "|"
                                                    + inv.getBatchNo(),
                                    inv -> inv
                            ));

            List<InventoryEntity> toSave = new ArrayList<>();
            List<InventoryMovementEntity> movements = new ArrayList<>();

            // =========================================================
            // 7. PROCESS
            // =========================================================
            for (CsvRow row : rawRows) {

                String key =
                        row.materialCode
                                + "|"
                                + row.warehouseCode
                                + "|"
                                + row.batchNo;

                InventoryEntity inv =
                        existingInvMap.getOrDefault(key, new InventoryEntity());

                boolean isNew = (inv.getId() == null);

                if (isNew) {

                    inv.setMaterial(materialMap.get(row.materialCode));
                    inv.setWarehouse(warehouseMap.get(row.warehouseCode));

                    inv.setBatchNo(row.batchNo);

                    inv.setTenantId(tenantId);
                    inv.setCompanyId(companyId);
                }

                // =====================================================
                // UPDATE ALL FIELDS
                // =====================================================

                inv.setQuantityOnHand(
                        row.quantityOnHand != null
                                ? row.quantityOnHand
                                : BigDecimal.ZERO
                );

                // Optional quantities if your entity supports them
                 inv.setQuantityTotal(row.quantityTotal);
               //  inv.setQuantityReserved(row.quantityReserved);
                 inv.setQuantityLocked(row.quantityLocked);

                inv.setUnit(row.unit != null && !row.unit.isBlank() ? row.unit : unitFor(materialMap.get(row.materialCode)));

                inv.setCurrency(row.currency != null ? row.currency : "USD");

                inv.setMaterialCodeDenorm(row.materialCode);
                inv.setWarehouseCodeDenorm(row.warehouseCode);

                inv.setVisible(true);

                // Example additional setters
                // Uncomment if InventoryEntity already has these fields

                
                inv.setContractCode(row.contractCode);
                inv.setUnitPrice(row.unitPrice);
                inv.setWarehouseImportUnit(row.warehouseImportUnit);
                inv.setWarehouseImportQuantity(row.warehouseImportQuantity);
                inv.setBomUnitPerWarehouseUnit(row.bomUnitPerWarehouseUnit);
                inv.setWarehouseImportUnitPrice(row.warehouseImportUnitPrice);
                inv.setHsCode(row.hsCode);
                inv.setOriginType(row.originType);
                inv.setOriginCountry(row.originCountry);
                inv.setXformNo(row.xformNo);
                inv.setCdsNo(row.cdsNo);
                inv.setPurchaseNo(row.purchaseNo);
                inv.setOrderToDeduction(row.orderToDeduction);
                inv.setMaterialQuota(row.materialQuota);
                inv.setMaterialQuotaPercentage(row.materialQuotaPercentage);
                inv.setUserName(row.userName);
                inv.setXformDate(row.xformDate);
                inv.setPurchaseDateTime( parseInstant(  row.purchaseDateTime ==null? "" : row.purchaseDateTime.toString() ) );
                inv.setCdsDateTime(parseInstant(row.cdsDateTime == null? "" :row.cdsDateTime.toString() )) ;
                inv.setProductionDateTime(parseInstant(row.productionDateTime ==null? "" :row.productionDateTime.toString() )) ;
                inv.setExpirationDateTime(parseInstant(row.expirationDateTime ==null? "" :row.expirationDateTime.toString() )) ;
                

                toSave.add(inv);

                // =====================================================
                // MOVEMENT
                // =====================================================
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

            // =========================================================
            // 8. SAVE
            // =========================================================
            inventoryRepository.saveAll(toSave);

            movementRepository.saveAll(movements);

            result.setSuccess(true);
            result.setCreated(toSave.size());
            result.setErrors(errors);

            result.setMessage(
                    "Successfully processed " + toSave.size() + " records."
            );

        } catch (Exception e) {

            result.setSuccess(false);
            result.setMessage("Excel error: " + e.getMessage());
        }

        return result;
    }

    // =============================================================
    // PARSE ROW
    // =============================================================
    private CsvRow parseExcelRow(
            Row row,
            Map<String, Integer> columnMap,
            int line
    ) {

        CsvRow r = new CsvRow();

        r.lineNumber = line;

        r.materialCode = getCellValue(row, columnMap, "material_code");
        r.warehouseCode = getCellValue(row, columnMap, "warehouse_code");
        r.batchNo = getCellValue(row, columnMap, "batch_no");

        r.unit = firstCellValue(row, columnMap, "bom_import_unit", "bom_unit", "unit");

        r.currency = getCellValue(row, columnMap, "currency");

        r.contractCode = getCellValue(row, columnMap, "contract_code");

        r.hsCode = getCellValue(row, columnMap, "hs_code");

        r.originType = getCellValue(row, columnMap, "origin_type");

        r.originCountry = getCellValue(row, columnMap, "origin_country");

        r.xformNo = getCellValue(row, columnMap, "xform_no");

        r.cdsNo = getCellValue(row, columnMap, "cds_no");

        r.purchaseNo = getCellValue(row, columnMap, "purchase_no");

        r.orderToDeduction = getCellValue(row, columnMap, "order_to_deduction");

        r.userName = getCellValue(row, columnMap, "user_name");
        r.warehouseImportUnit = firstCellValue(row, columnMap, "warehouse_import_unit", "import_unit", "purchase_unit");

        // =========================================================
        // DECIMAL FIELDS
        // =========================================================

        r.unitPrice = parseBigDecimal(
                firstCellValue(row, columnMap, "unit_price", "bom_unit_price")
        );

        r.warehouseImportQuantity = parseBigDecimal(
                firstCellValue(row, columnMap, "warehouse_import_quantity", "warehouse_qty_import_unit", "import_quantity", "purchase_quantity")
        );

        r.bomUnitPerWarehouseUnit = parseBigDecimal(
                firstCellValue(row, columnMap, "bom_unit_per_warehouse_unit", "bom_qty_per_warehouse_unit", "bom_import_quantity", "conversion_factor")
        );

        r.warehouseImportUnitPrice = parseBigDecimal(
                firstCellValue(row, columnMap, "warehouse_import_unit_price", "warehouse_unit_price", "import_unit_price", "price")
        );

        r.quantityOnHand = parseBigDecimal(
                getCellValue(row, columnMap, "quantity_on_hand")
        );

        r.quantityTotal = parseBigDecimal(
                getCellValue(row, columnMap, "quantity_total")
        );

        r.quantityReserved = parseBigDecimal(
                getCellValue(row, columnMap, "quantity_reserved")
        );

        r.quantityLocked = parseBigDecimal(
                getCellValue(row, columnMap, "quantity_locked")
        );

        r.materialQuota = parseBigDecimal(
                getCellValue(row, columnMap, "material_quota")
        );

        r.materialQuotaPercentage = parseBigDecimal(
                getCellValue(row, columnMap, "material_quota_percentage")
        );

     // =========================================================
     // DATE FIELDS
     // =========================================================

     r.xformDate = parseLocalDateCell(
             row,
             columnMap,
             "xform_date"
     );

     r.purchaseDateTime = parseInstantCell(
             row,
             columnMap,
             "purchase_date_time"
     );

     r.cdsDateTime = parseInstantCell(
             row,
             columnMap,
             "cds_date_time"
     );

     r.productionDateTime = parseInstantCell(
             row,
             columnMap,
             "production_date_time"
     );

     r.expirationDateTime = parseInstantCell(
             row,
             columnMap,
             "expiration_date_time"
     );
        return r;
    }

    // =============================================================
    // HELPERS
    // =============================================================
    private String getCellValue(
            Row row,
            Map<String, Integer> map,
            String colName
    ) {

        Integer idx = map.get(colName);

        if (idx == null) {
            return null;
        }

        Cell cell = row.getCell(idx);

        if (cell == null) {
            return null;
        }

        return new DataFormatter()
                .formatCellValue(cell)
                .trim();
    }

    private String firstCellValue(Row row, Map<String, Integer> map, String... colNames) {
        for (String colName : colNames) {
            String value = getCellValue(row, map, colName);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }

    private void applyWarehouseConversion(CsvRow row, Material material, UUID tenantId, UUID companyId, List<String> errors) {
        String bomUnit = unitFor(material);
        if (row.unit != null && !row.unit.isBlank() && !row.unit.trim().equalsIgnoreCase(bomUnit)) {
            errors.add("Line " + row.lineNumber + ": bom_import_unit/unit '" + row.unit + "' does not match material unit '" + bomUnit + "'");
        }
        row.unit = bomUnit;

        if (row.warehouseImportUnit != null && row.warehouseImportUnit.isBlank()) {
            row.warehouseImportUnit = null;
        }
        boolean hasWarehouseImport = row.warehouseImportQuantity != null
                || row.bomUnitPerWarehouseUnit != null
                || row.warehouseImportUnitPrice != null
                || row.warehouseImportUnit != null;

        if (hasWarehouseImport) {
            if (row.warehouseImportQuantity == null) {
                errors.add("Line " + row.lineNumber + ": warehouse_import_quantity is required when warehouse import columns are used");
            } else if (row.warehouseImportQuantity.compareTo(BigDecimal.ZERO) <= 0) {
                errors.add("Line " + row.lineNumber + ": warehouse_import_quantity must be positive");
            }

            if (row.bomUnitPerWarehouseUnit == null) {
                ConversionDefaults defaults = resolveModelBomConversion(material, tenantId, companyId);
                if (defaults != null) {
                    row.bomUnitPerWarehouseUnit = defaults.bomUnitPerWarehouseUnit;
                    if (row.warehouseImportUnit == null || row.warehouseImportUnit.isBlank()) {
                        row.warehouseImportUnit = defaults.warehouseUnit;
                    }
                }
            }
            if (row.bomUnitPerWarehouseUnit == null) {
                errors.add("Line " + row.lineNumber + ": bom_unit_per_warehouse_unit is required when warehouse import columns are used, unless one unique model BOM conversion exists for material " + row.materialCode);
            } else if (row.bomUnitPerWarehouseUnit.compareTo(BigDecimal.ZERO) <= 0) {
                errors.add("Line " + row.lineNumber + ": bom_unit_per_warehouse_unit must be positive");
            }
            if (row.warehouseImportUnitPrice != null && row.warehouseImportUnitPrice.compareTo(BigDecimal.ZERO) < 0) {
                errors.add("Line " + row.lineNumber + ": warehouse_import_unit_price cannot be negative");
            }

            if (row.warehouseImportQuantity != null
                    && row.bomUnitPerWarehouseUnit != null
                    && row.warehouseImportQuantity.compareTo(BigDecimal.ZERO) > 0
                    && row.bomUnitPerWarehouseUnit.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal bomQuantity = row.warehouseImportQuantity.multiply(row.bomUnitPerWarehouseUnit);
                row.quantityOnHand = bomQuantity;
                if (row.quantityTotal == null) {
                    row.quantityTotal = bomQuantity;
                }
                if (row.warehouseImportUnitPrice != null) {
                    row.unitPrice = row.warehouseImportUnitPrice.divide(row.bomUnitPerWarehouseUnit, 10, RoundingMode.HALF_UP);
                }
            }
        }

        if (row.quantityOnHand == null) {
            errors.add("Line " + row.lineNumber + ": either quantity_on_hand or warehouse_import_quantity + bom_unit_per_warehouse_unit is required");
        } else if (row.quantityOnHand.compareTo(BigDecimal.ZERO) < 0) {
            errors.add("Line " + row.lineNumber + ": quantity_on_hand cannot be negative");
        }

        if (row.quantityTotal == null) {
            row.quantityTotal = row.quantityOnHand;
        }
        if (row.unitPrice == null) {
            row.unitPrice = BigDecimal.ZERO;
        }
    }
    private ConversionDefaults resolveModelBomConversion(Material material, UUID tenantId, UUID companyId) {
        if (material == null || tenantId == null || companyId == null) {
            return null;
        }
        List<ModelBom> candidates = modelBomRepository.findAllByMaterialAndTenantIdAndCompanyId(material, tenantId, companyId)
                .stream()
                .filter(mb -> mb.getBomUnitPerWarehouseUnit() != null && mb.getBomUnitPerWarehouseUnit().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        if (candidates.isEmpty()) {
            return null;
        }

        BigDecimal ratio = candidates.get(0).getBomUnitPerWarehouseUnit();
        String warehouseUnit = candidates.get(0).getWarehouseUnit();
        for (ModelBom candidate : candidates) {
            if (candidate.getBomUnitPerWarehouseUnit().compareTo(ratio) != 0) {
                return null;
            }
            String candidateUnit = candidate.getWarehouseUnit();
            if (warehouseUnit != null && candidateUnit != null && !warehouseUnit.equalsIgnoreCase(candidateUnit)) {
                warehouseUnit = null;
            } else if (warehouseUnit == null && candidateUnit != null) {
                warehouseUnit = candidateUnit;
            }
        }
        return new ConversionDefaults(ratio, warehouseUnit);
    }

    private static class ConversionDefaults {
        final BigDecimal bomUnitPerWarehouseUnit;
        final String warehouseUnit;

        ConversionDefaults(BigDecimal bomUnitPerWarehouseUnit, String warehouseUnit) {
            this.bomUnitPerWarehouseUnit = bomUnitPerWarehouseUnit;
            this.warehouseUnit = warehouseUnit;
        }
    }
    private BigDecimal parseBigDecimal(String value) {

        try {

            if (value == null || value.isBlank()) {
                return null;
            }

            return new BigDecimal(
                    value.replace(",", "").trim()
            );

        } catch (Exception e) {

            return null;
        }
    }

    private LocalDate parseLocalDate(String value) {

        try {

            if (value == null || value.isBlank()) {
                return null;
            }

            return LocalDate.parse(value);

        } catch (Exception e) {

            return null;
        }
    }

    private LocalDateTime parseLocalDateTime(String value) {

        try {

            if (value == null || value.isBlank()) {
                return null;
            }

            return LocalDateTime.parse(value);

        } catch (Exception e) {

            try {

                return Instant.ofEpochMilli(
                                Long.parseLong(value)
                        )
                        .atZone(ZoneId.systemDefault())
                        .toLocalDateTime();

            } catch (Exception ex) {

                return null;
            }
        }
    }

    private boolean isRowEmpty(Row row) {

        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {

            Cell cell = row.getCell(c);

            if (cell != null
                    && cell.getCellType() != CellType.BLANK) {

                return false;
            }
        }

        return true;
    }

    private static String unitFor(Material material) {
        if (material != null && material.getUnit() != null && !material.getUnit().isBlank()) {
            return material.getUnit().trim();
        }
        return "pcs";
    }

    // =============================================================
    // CSV ROW DTO
    // =============================================================
    private static class CsvRow {

        int lineNumber;

        String materialCode;
        String warehouseCode;
        String batchNo;

        BigDecimal quantityOnHand;
        BigDecimal quantityTotal;
        BigDecimal quantityReserved;
        BigDecimal quantityLocked;

        String contractCode;

        String unit;

        BigDecimal unitPrice;

        String warehouseImportUnit;

        BigDecimal warehouseImportQuantity;

        BigDecimal bomUnitPerWarehouseUnit;

        BigDecimal warehouseImportUnitPrice;

        String currency;

        String hsCode;

        String originType;

        String originCountry;

        String xformNo;

        String cdsNo;

        String purchaseNo;

        String orderToDeduction;

        BigDecimal materialQuota;

        BigDecimal materialQuotaPercentage;

        String userName;

        LocalDate xformDate;

        Instant purchaseDateTime;

        Instant cdsDateTime;

        Instant productionDateTime;

        Instant expirationDateTime;
    }

    // =============================================================
    // RESULT
    // =============================================================
    public static class ImportResult {

        private boolean success;

        private String message;

        private int created;

        private List<String> errors = new ArrayList<>();

        private List<String> missingMaterials = new ArrayList<>();

        private List<String> missingWarehouses = new ArrayList<>();

        public boolean isSuccess() {
            return success;
        }

        public void setSuccess(boolean success) {
            this.success = success;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public int getCreated() {
            return created;
        }

        public void setCreated(int created) {
            this.created = created;
        }

        public List<String> getErrors() {
            return errors;
        }

        public void setErrors(List<String> errors) {
            this.errors = errors;
        }

        public List<String> getMissingMaterials() {
            return missingMaterials;
        }

        public void setMissingMaterials(List<String> missingMaterials) {
            this.missingMaterials = missingMaterials;
        }

        public List<String> getMissingWarehouses() {
            return missingWarehouses;
        }

        public void setMissingWarehouses(List<String> missingWarehouses) {
            this.missingWarehouses = missingWarehouses;
        }
    }
    
    private Instant parseInstant(String value) {

        try {

            if (value == null || value.isBlank()) {
                return null;
            }

            // Excel ISO format example:
            // 2026-05-01T08:30:00

            return Instant.parse(
                    value.endsWith("Z")
                            ? value
                            : value + "Z"
            );

        } catch (Exception e) {

            try {

                // Excel numeric datetime support
                double excelDate = Double.parseDouble(value);

                Date javaDate = DateUtil.getJavaDate(excelDate);

                return javaDate.toInstant();

            } catch (Exception ex) {

                return null;
            }
        }
    }
    
    private LocalDate parseLocalDateCell(
            Row row,
            Map<String, Integer> map,
            String colName
    ) {

        try {

            Integer idx = map.get(colName);

            if (idx == null) {
                return null;
            }

            Cell cell = row.getCell(idx);

            if (cell == null) {
                return null;
            }

            // REAL EXCEL DATE
            if (cell.getCellType() == CellType.NUMERIC
                    && DateUtil.isCellDateFormatted(cell)) {

                return cell.getDateCellValue()
                        .toInstant()
                        .atZone(ZoneId.systemDefault())
                        .toLocalDate();
            }

            // STRING DATE
            String value = new DataFormatter()
                    .formatCellValue(cell)
                    .trim();

            if (value.isBlank()) {
                return null;
            }

            return LocalDate.parse(value);

        } catch (Exception e) {

            return null;
        }
    }
    
    
    private Instant parseInstantCell(
            Row row,
            Map<String, Integer> map,
            String colName
    ) {

        try {

            Integer idx = map.get(colName);

            if (idx == null) {
                return null;
            }

            Cell cell = row.getCell(idx);

            if (cell == null) {
                return null;
            }

            // =====================================================
            // NORMAL EXCEL DATETIME CELL
            // =====================================================
            if (cell.getCellType() == CellType.NUMERIC
                    && DateUtil.isCellDateFormatted(cell)) {

                return cell.getDateCellValue()
                        .toInstant();
            }

            // =====================================================
            // STRING VALUE
            // =====================================================
            String value = new DataFormatter()
                    .formatCellValue(cell)
                    .trim();

            if (value.isBlank()) {
                return null;
            }

            // ISO INSTANT
            // 2026-05-01T08:30:00Z
            try {

                return Instant.parse(value);

            } catch (Exception ignored) {
            }

            // LOCAL DATETIME
            // 2026-05-01T08:30:00
            try {

                return java.time.LocalDateTime
                        .parse(value)
                        .atZone(ZoneId.systemDefault())
                        .toInstant();

            } catch (Exception ignored) {
            }

            // DATE ONLY
            // 2026-05-01
            try {

                return LocalDate
                        .parse(value)
                        .atStartOfDay(ZoneId.systemDefault())
                        .toInstant();

            } catch (Exception ignored) {
            }

            return null;

        } catch (Exception e) {

            return null;
        }
    }
    
}