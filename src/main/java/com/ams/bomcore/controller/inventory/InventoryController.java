package com.ams.bomcore.controller.inventory;

import java.io.ByteArrayOutputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.controller.inventory.dto.InventoryViewDTO;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.service.inventory.InventoryAlertReportService;
import com.ams.bomcore.service.inventory.InventoryException;
import com.ams.bomcore.service.inventory.InventoryImportService;
import com.ams.bomcore.service.inventory.InventoryPatchXlsxService;
import com.ams.bomcore.service.inventory.InventoryService;
import com.ams.bomcore.service.inventory.OrderDeductionService;

import jakarta.validation.Valid;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryImportService inventoryImportService;
    private final InventoryAlertReportService inventoryAlertReportService;
    private final InventoryPatchXlsxService inventoryPatchXlsxService;
    private final OrderDeductionService orderDeductionService;

    public InventoryController(InventoryService inventoryService,
                               InventoryImportService inventoryImportService,
                               InventoryAlertReportService inventoryAlertReportService,
                               InventoryPatchXlsxService inventoryPatchXlsxService,
                               OrderDeductionService orderDeductionService) {
        this.inventoryService         = inventoryService;
        this.inventoryImportService   = inventoryImportService;
        this.inventoryAlertReportService = inventoryAlertReportService;
        this.inventoryPatchXlsxService = inventoryPatchXlsxService;
        this.orderDeductionService    = orderDeductionService;
    }

    private UUID resolveTenant(UUID tenantId, String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { return UUID.fromString(headerTenantId); } catch (Exception e) { }
        }
        return tenantId;
    }

    private UUID resolveCompany(UUID companyId, String headerCompanyId) {
        if (headerCompanyId != null && !headerCompanyId.isBlank()) {
            try { return UUID.fromString(headerCompanyId); } catch (Exception e) { }
        }
        return companyId;
    }

    private String bodyString(Map<String, Object> body, String key) {
        Object value = body.get(key);
        if (value == null) return null;
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private BigDecimal bodyDecimal(Map<String, Object> body, String key) {
        String value = bodyString(body, key);
        return value == null ? null : new BigDecimal(value);
    }
    @GetMapping
    public List<InventoryEntity> list(@RequestParam(value = "tenantId", required = false) UUID tenantId,
                                      @RequestParam(value = "companyId", required = false) UUID companyId,
                                      @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                      @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            throw new IllegalArgumentException("tenantId and companyId are required");
        }

        return inventoryService.listAllByTenantAndCompany(tenantId, companyId);
    }

    @GetMapping(path = "/alerts", produces = MediaType.APPLICATION_JSON_VALUE)
    public InventoryAlertReportService.InventoryAlertReport alertReport(
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestParam(value = "targetDate", required = false) LocalDate targetDate,
            @RequestParam(value = "lookbackDays", required = false) Integer lookbackDays,
            @RequestParam(value = "forecastDays", required = false) Integer forecastDays,
            @RequestParam(value = "forecastMode", required = false) String forecastMode,
            @RequestParam(value = "expirationDays", required = false) Integer expirationDays,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            throw new IllegalArgumentException("tenantId and companyId are required");
        }

        return inventoryAlertReportService.buildReport(
                tenantId, companyId, targetDate, lookbackDays, forecastDays, forecastMode, expirationDays);
    }

    // New view endpoint for grid display — returns DTO projection to avoid N+1 and lazy issues
    @GetMapping(path = "/view", produces = MediaType.APPLICATION_JSON_VALUE)
    public List<InventoryViewDTO> listView(@RequestParam(value = "tenantId", required = false) UUID tenantId,
                                           @RequestParam(value = "companyId", required = false) UUID companyId,
                                           @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                           @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            throw new IllegalArgumentException("tenantId and companyId are required");
        }

        return inventoryService.listInventoryViewByTenantAndCompany(tenantId, companyId);
    }

    /**
     * Add stock by materialCode + warehouseCode OR by materialId + warehouseId
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> addStock(@Valid @RequestBody Map<String, Object> body,
                                      @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                      @RequestParam(value = "companyId", required = false) UUID companyId,
                                      @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                      @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);

            if (tenantId == null || companyId == null) {
				return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
			}

            BigDecimal qty = bodyDecimal(body, "quantity");
            BigDecimal unitPrice = bodyDecimal(body, "unitPrice");
            BigDecimal warehouseImportQuantity = bodyDecimal(body, "warehouseImportQuantity");
            BigDecimal bomUnitPerWarehouseUnit = bodyDecimal(body, "bomUnitPerWarehouseUnit");
            BigDecimal warehouseImportUnitPrice = bodyDecimal(body, "warehouseImportUnitPrice");
            String warehouseImportUnit = bodyString(body, "warehouseImportUnit");
            String currency = bodyString(body, "currency");

            String batchNo = body.get("batchNo") == null ? null : String.valueOf(body.get("batchNo"));
            String exp = body.get("expirationDateTime") == null ? null : String.valueOf(body.get("expirationDateTime"));
            String prod = body.get("productionDateTime") == null ? null : String.valueOf(body.get("productionDateTime"));
            String qres = body.get("quantityReserved") == null ? null : String.valueOf(body.get("quantityReserved"));
            String qlock = body.get("quantityLocked") == null ? null : String.valueOf(body.get("quantityLocked"));
            String reason     = body.get("reason")     != null ? String.valueOf(body.get("reason"))     : "Manual add stock";
            String createdBy  = body.get("createdBy")  != null ? String.valueOf(body.get("createdBy"))  : "system";
            String notes      = body.get("notes")      != null ? String.valueOf(body.get("notes"))      : null;
            UUID invoiceId    = body.get("invoiceId")  != null ? UUID.fromString(String.valueOf(body.get("invoiceId"))) : null;
            String orderToDeduction = body.get("orderToDeduction") != null ? String.valueOf(body.get("orderToDeduction")) : null;
            String mqp = body.get("materialQuotaPercentage") != null ? String.valueOf(body.get("materialQuotaPercentage")) : null;

            Instant expirationDateTime = exp == null || exp.trim().isEmpty() ? null : Instant.parse(exp);
            Instant productionDateTime = prod == null || prod.trim().isEmpty() ? null : Instant.parse(prod);
            BigDecimal quantityReserved = qres == null || qres.trim().isEmpty() ? null : new BigDecimal(qres);
            BigDecimal quantityLocked = qlock == null || qlock.trim().isEmpty() ? null : new BigDecimal(qlock);
            BigDecimal materialQuotaPercentage = mqp == null || mqp.trim().isEmpty() ? null : new BigDecimal(mqp);

            // prefer ids when provided
            Object mid = body.get("materialId");
            Object wid = body.get("warehouseId");
            InventoryEntity saved;
            if (mid != null && wid != null) {
                UUID materialId = UUID.fromString(String.valueOf(mid));
                UUID warehouseId = UUID.fromString(String.valueOf(wid));
                saved = inventoryService.addStockByIds(materialId, warehouseId, qty, batchNo, expirationDateTime, productionDateTime, quantityReserved, quantityLocked, orderToDeduction, materialQuotaPercentage, tenantId, companyId, reason, createdBy, notes, invoiceId, unitPrice, currency, warehouseImportUnit, warehouseImportQuantity, bomUnitPerWarehouseUnit, warehouseImportUnitPrice);
            } else {
                String materialCode = (String) body.get("materialCode");
                String warehouseCode = (String) body.get("warehouseCode");
                saved = inventoryService.addStock(materialCode, warehouseCode, qty, batchNo, expirationDateTime, productionDateTime, quantityReserved, quantityLocked, orderToDeduction, materialQuotaPercentage, tenantId, companyId, reason, createdBy, notes, invoiceId, unitPrice, currency, warehouseImportUnit, warehouseImportQuantity, bomUnitPerWarehouseUnit, warehouseImportUnitPrice);
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Update stock by inventory id
     */
    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateStock(@PathVariable("id") UUID id, @Valid @RequestBody Map<String, Object> body,
                                         @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                         @RequestParam(value = "companyId", required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                         @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);
            if (tenantId == null || companyId == null) {
				return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
			}

            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));
            BigDecimal unitPrice = bodyDecimal(body, "unitPrice");
            String currency = bodyString(body, "currency");
            String batchNo = body.get("batchNo") == null ? null : String.valueOf(body.get("batchNo"));
            String exp = body.get("expirationDateTime") == null ? null : String.valueOf(body.get("expirationDateTime"));
            String prod = body.get("productionDateTime") == null ? null : String.valueOf(body.get("productionDateTime"));
            String qres = body.get("quantityReserved") == null ? null : String.valueOf(body.get("quantityReserved"));
            String reason    = body.get("reason")    != null ? String.valueOf(body.get("reason"))    : "Manual update stock";
            String createdBy = body.get("createdBy") != null ? String.valueOf(body.get("createdBy")) : "system";
            String notes     = body.get("notes")     != null ? String.valueOf(body.get("notes"))     : null;
            String orderToDeduction = body.get("orderToDeduction") != null ? String.valueOf(body.get("orderToDeduction")) : null;
            String mqp = body.get("materialQuotaPercentage") != null ? String.valueOf(body.get("materialQuotaPercentage")) : null;

            Instant expirationDateTime = exp == null || exp.trim().isEmpty() ? null : Instant.parse(exp);
            Instant productionDateTime = prod == null || prod.trim().isEmpty() ? null : Instant.parse(prod);
            BigDecimal quantityReserved = qres == null || qres.trim().isEmpty() ? null : new BigDecimal(qres);
            BigDecimal materialQuotaPercentage = mqp == null || mqp.trim().isEmpty() ? null : new BigDecimal(mqp);

            // quantityTotal is intentionally NOT accepted here — it is set only at import/initial creation
            InventoryEntity updated = inventoryService.updateStock(id, qty, null, batchNo, expirationDateTime, productionDateTime, quantityReserved, orderToDeduction, materialQuotaPercentage, tenantId, companyId, reason, createdBy, notes, unitPrice, currency);
            return ResponseEntity.ok(updated);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Reserve quantity on an inventory record
     */
    @PostMapping(path = "/{id}/reserve", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> reserve(@PathVariable("id") UUID id, @Valid @RequestBody Map<String, Object> body,
                                     @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                     @RequestParam(value = "companyId", required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                     @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);
            if (tenantId == null || companyId == null) {
				return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
			}

            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));
            InventoryEntity updated = inventoryService.reserveById(id, qty, tenantId, companyId);
            return ResponseEntity.ok(updated);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Release quantity on an inventory record
     */
    @PostMapping(path = "/{id}/release", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> release(@PathVariable("id") UUID id, @Valid @RequestBody Map<String, Object> body,
                                     @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                     @RequestParam(value = "companyId", required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                     @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);
            if (tenantId == null || companyId == null) {
				return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
			}

            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));
            InventoryEntity updated = inventoryService.releaseById(id, qty, tenantId, companyId);
            return ResponseEntity.ok(updated);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Delete an inventory record by id
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteStock(@PathVariable("id") UUID id,
                                         @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                         @RequestParam(value = "companyId", required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                         @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);
            inventoryService.deleteById(id, tenantId, companyId);
            return ResponseEntity.noContent().build();
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Import inventory from CSV file
     */
    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> importCsv(@RequestParam("file") MultipartFile file,
                                       @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                       @RequestParam(value = "companyId", required = false) UUID companyId,
                                       @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                       @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);
            if (tenantId == null || companyId == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
            }

            InventoryImportService.ImportResult result = inventoryImportService.importFromCsv(file, tenantId, companyId);

            if (result.isSuccess()) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
            }
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                "success", false,
                "message", "Import failed: " + ex.getMessage()
            ));
        }
    }

    /**
     * Patch inventory records from a lightweight CSV containing only:
     *   id, order_to_deduction, material_quota_percentage
     *
     * Only the columns present in the CSV header are updated; absent columns
     * leave existing values unchanged.
     *
     * CSV example:
     *   id,order_to_deduction,material_quota_percentage
     *   550e8400-e29b-41d4-a716-446655440000,A,105.00
     *   550e8400-e29b-41d4-a716-446655440001,B,
     *   550e8400-e29b-41d4-a716-446655440002,,102.50
     */
    @PostMapping(path = "/patch-xlsx", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> patchCsv(@RequestParam("file") MultipartFile file,
                                      @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                      @RequestParam(value = "companyId", required = false) UUID companyId,
                                      @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                      @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId  = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);
            if (tenantId == null || companyId == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
            }
            InventoryPatchXlsxService.PatchResult result =
            		inventoryPatchXlsxService.patchFromXlsx(file, tenantId, companyId);
            if (result.isSuccess()) {
                return ResponseEntity.ok(result);
            } else {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(result);
            }
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of(
                    "success", false,
                    "message", "Patch failed: " + ex.getMessage()
            ));
        }
    }

    /**
     * Download XLSX template for full inventory import.
     * GET /bom/inventory/template/import
     */
    @GetMapping(path = "/template/import")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        String[] headers = {
            "material_code","warehouse_code","batch_no",
            "warehouse_import_quantity","warehouse_import_unit","bom_unit_per_warehouse_unit","warehouse_import_unit_price","bom_import_unit",
            "quantity_on_hand","quantity_total","quantity_reserved","quantity_locked","contract_code","unit","unit_price","currency",
            "hs_code","origin_type","origin_country","xform_no","cds_no","purchase_no",
            "order_to_deduction","material_quota","material_quota_percentage",
            "user_name","xform_date","purchase_date_time","cds_date_time",
            "production_date_time","expiration_date_time","visible","approved","locked"
        };
        Object[] example1 = {
            "MAT-MILK","WH-A","MILK-PKG-001",
            1,"package",720,72000,"g",
            "","",0,0,"CTR-001","g","","USD",
            "0402.21","domestic","VN","XFORM-001","CDS-001","PO-001",
            "A",1050,105.00,
            "admin","2026-01-15","2026-01-15T08:00:00Z","2026-01-16T08:00:00Z",
            "2026-01-10T00:00:00Z","2027-01-10T00:00:00Z","true","false","false"
        };
        Object[] example2 = {
            "MAT-002","WH-B","BATCH-2026-002",
            "","","","","",
            500,500,0,0,"","pcs",12.00,"USD",
            "","","","","","",
            "B","",100.00,
            "system","","","",
            "","","true","false","false"
        };

        try (Workbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("inventory_import");

            // Header style: bold, light blue background, bordered
            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            // Example row style: light yellow background
            CellStyle exampleStyle = wb.createCellStyle();
            exampleStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            exampleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            // Write header row
            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 20 * 256); // 20 chars wide
            }

            // Write example rows
            Object[][] examples = {example1, example2};
            for (int r = 0; r < examples.length; r++) {
                Row row = sheet.createRow(r + 1);
                for (int c = 0; c < examples[r].length; c++) {
                    Cell cell = row.createCell(c);
                    Object val = examples[r][c];
                    if (val instanceof Number) {
                        cell.setCellValue(((Number) val).doubleValue());
                    } else {
                        cell.setCellValue(val == null ? "" : val.toString());
                    }
                    cell.setCellStyle(exampleStyle);
                }
            }

            wb.write(out);
            byte[] bytes = out.toByteArray();
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=\"inventory_import_template.xlsx\"")
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .body(bytes);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Download CSV template for patching orderToDeduction / materialQuotaPercentage.
     * Optionally pre-fills the template with current inventory rows for the tenant/company
     * so the user only needs to fill in the two columns.
     *
     * GET /bom/inventory/template/patch-csv
     * Optional params: tenantId, companyId — if supplied, rows are pre-filled from DB.
     */
    @GetMapping(path = "/template/patch-xlsx", produces = "text/csv")
    public ResponseEntity<byte[]> downloadPatchCsvTemplate(
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        try (
                Workbook wb = new XSSFWorkbook();
                ByteArrayOutputStream out = new ByteArrayOutputStream()
        ) {

            Sheet sheet = wb.createSheet("inventory_patch");

            String[] headers = {
                    "id",
                    "material_code",
                    "batch_no",
                    "warehouse_code",
                    "order_to_deduction",
                    "material_quota_percentage",
                    "unit_price"
            };

            CellStyle headerStyle = wb.createCellStyle();

            Font headerFont = wb.createFont();
            headerFont.setBold(true);

            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row headerRow = sheet.createRow(0);

            for (int i = 0; i < headers.length; i++) {

                Cell cell = headerRow.createCell(i);

                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);

                sheet.setColumnWidth(i, 25 * 256);
            }

            int rowIndex = 1;

            if (tenantId != null && companyId != null) {

                List<InventoryEntity> rows =
                        inventoryService.listAllByTenantAndCompany(
                                tenantId,
                                companyId
                        );

                for (InventoryEntity inv : rows) {

                    Row row = sheet.createRow(rowIndex++);

                    row.createCell(0).setCellValue(inv.getId().toString());
                    row.createCell(1).setCellValue(inv.getMaterialCode());
                    row.createCell(2).setCellValue(inv.getBatchNo());
                    row.createCell(3).setCellValue(inv.getWarehouseCode());
                    row.createCell(4).setCellValue(
                            inv.getOrderToDeduction() == null
                                    ? ""
                                    : inv.getOrderToDeduction()
                    );

                    if (inv.getMaterialQuotaPercentage() != null) {
                        row.createCell(5).setCellValue(
                                inv.getMaterialQuotaPercentage().doubleValue()
                        );
                    }

                    if (inv.getUnitPrice() != null) {
                        row.createCell(6).setCellValue(
                                inv.getUnitPrice().doubleValue()
                        );
                    }
                }
            }

            wb.write(out);

            byte[] bytes = out.toByteArray();

            return ResponseEntity.ok()
                    .header(
                            "Content-Disposition",
                            "attachment; filename=\"inventory_patch_template.xlsx\""
                    )
                    .header(
                            "Content-Type",
                            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    )
                    .body(bytes);

        } catch (Exception e) {

            return ResponseEntity
                    .status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .build();
        }

    }

    /**
     * Issue material to production for a BOM item.
     *
     * Deduction logic:
     *   1. Sort inventory for the BOM item's material by orderToDeduction label alphabetically (A first).
     *   2. For each row: physical_deduct = BomItem.quantity × orderQty × (materialQuotaPercentage / 100)
     *   3. Deduct from quantityOnHand row by row until fully consumed.
     *
     * POST /bom/inventory/consume-production
     * Body: { "bomItemId": "uuid", "orderQty": 10 }
     */
    @PostMapping(path = "/consume-production", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> consumeForProduction(
            @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId  = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);
            if (tenantId == null || companyId == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
            }

            Object bomItemIdRaw = body.get("bomItemId");
            Object orderQtyRaw  = body.get("orderQty");
            if (bomItemIdRaw == null || orderQtyRaw == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("bomItemId and orderQty are required");
            }

            UUID       bomItemId = UUID.fromString(String.valueOf(bomItemIdRaw));
            BigDecimal orderQty  = new BigDecimal(String.valueOf(orderQtyRaw));

            OrderDeductionService.ConsumptionResult result =
                    orderDeductionService.consumeForProduction(bomItemId, orderQty, tenantId, companyId);

            if (!result.isFulfilled()) {
                return ResponseEntity.status(HttpStatus.MULTI_STATUS).body(result);
            }
            return ResponseEntity.ok(result);

        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }
}
