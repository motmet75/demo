package com.ams.bomcore.controller.inventory;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

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
import com.ams.bomcore.service.inventory.InventoryException;
import com.ams.bomcore.service.inventory.InventoryImportService;
import com.ams.bomcore.service.inventory.InventoryPatchCsvService;
import com.ams.bomcore.service.inventory.InventoryService;
import com.ams.bomcore.service.inventory.OrderDeductionService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryImportService inventoryImportService;
    private final InventoryPatchCsvService inventoryPatchCsvService;
    private final OrderDeductionService orderDeductionService;

    public InventoryController(InventoryService inventoryService,
                               InventoryImportService inventoryImportService,
                               InventoryPatchCsvService inventoryPatchCsvService,
                               OrderDeductionService orderDeductionService) {
        this.inventoryService         = inventoryService;
        this.inventoryImportService   = inventoryImportService;
        this.inventoryPatchCsvService = inventoryPatchCsvService;
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

            if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));

            String batchNo = body.get("batchNo") == null ? null : String.valueOf(body.get("batchNo"));
            String exp = body.get("expirationDateTime") == null ? null : String.valueOf(body.get("expirationDateTime"));
            String prod = body.get("productionDateTime") == null ? null : String.valueOf(body.get("productionDateTime"));
            String qres = body.get("quantityReserved") == null ? null : String.valueOf(body.get("quantityReserved"));
            String reason     = body.get("reason")     != null ? String.valueOf(body.get("reason"))     : "Manual add stock";
            String createdBy  = body.get("createdBy")  != null ? String.valueOf(body.get("createdBy"))  : "system";
            String notes      = body.get("notes")      != null ? String.valueOf(body.get("notes"))      : null;
            UUID invoiceId    = body.get("invoiceId")  != null ? UUID.fromString(String.valueOf(body.get("invoiceId"))) : null;
            String orderToDeduction = body.get("orderToDeduction") != null ? String.valueOf(body.get("orderToDeduction")) : null;
            String mqp = body.get("materialQuotaPercentage") != null ? String.valueOf(body.get("materialQuotaPercentage")) : null;

            Instant expirationDateTime = exp == null || exp.trim().isEmpty() ? null : Instant.parse(exp);
            Instant productionDateTime = prod == null || prod.trim().isEmpty() ? null : Instant.parse(prod);
            BigDecimal quantityReserved = qres == null || qres.trim().isEmpty() ? null : new BigDecimal(qres);
            BigDecimal materialQuotaPercentage = mqp == null || mqp.trim().isEmpty() ? null : new BigDecimal(mqp);

            // prefer ids when provided
            Object mid = body.get("materialId");
            Object wid = body.get("warehouseId");
            InventoryEntity saved;
            if (mid != null && wid != null) {
                UUID materialId = UUID.fromString(String.valueOf(mid));
                UUID warehouseId = UUID.fromString(String.valueOf(wid));
                saved = inventoryService.addStockByIds(materialId, warehouseId, qty, batchNo, expirationDateTime, productionDateTime, quantityReserved, orderToDeduction, materialQuotaPercentage, tenantId, companyId, reason, createdBy, notes, invoiceId);
            } else {
                String materialCode = (String) body.get("materialCode");
                String warehouseCode = (String) body.get("warehouseCode");
                saved = inventoryService.addStock(materialCode, warehouseCode, qty, batchNo, expirationDateTime, productionDateTime, quantityReserved, orderToDeduction, materialQuotaPercentage, tenantId, companyId, reason, createdBy, notes, invoiceId);
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
            if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));
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
            InventoryEntity updated = inventoryService.updateStock(id, qty, null, batchNo, expirationDateTime, productionDateTime, quantityReserved, orderToDeduction, materialQuotaPercentage, tenantId, companyId, reason, createdBy, notes);
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
            if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

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
            if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

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
    @PostMapping(path = "/patch-csv", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
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
            InventoryPatchCsvService.PatchResult result =
                    inventoryPatchCsvService.patchFromCsv(file, tenantId, companyId);
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
     * Download CSV template for full inventory import.
     * GET /bom/inventory/template/import
     */
    @GetMapping(path = "/template/import", produces = "text/csv")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        String csv =
            "material_code,warehouse_code,batch_no,quantity_on_hand,quantity_total," +
            "quantity_reserved,quantity_locked,contract_code,unit,unit_price,currency," +
            "hs_code,origin_type,origin_country,xform_no,cds_no,purchase_no," +
            "order_to_deduction,material_quota,material_quota_percentage," +
            "user_name,xform_date,purchase_date_time,cds_date_time," +
            "production_date_time,expiration_date_time,visible,approved,locked\n" +
            // example row 1
            "MAT-001,WH-A,BATCH-2026-001,1000,1000,0,0,CTR-001,kg,5.50,USD," +
            "3904.10,domestic,VN,XFORM-001,CDS-001,PO-001," +
            "A,1050,105.00," +
            "admin,2026-01-15,2026-01-15T08:00:00Z,2026-01-16T08:00:00Z," +
            "2026-01-10T00:00:00Z,2027-01-10T00:00:00Z,true,false,false\n" +
            // example row 2
            "MAT-002,WH-B,BATCH-2026-002,500,500,0,0,,pcs,12.00,USD," +
            ",,,,,,," +
            "B,,100.00," +
            "system,,,," +
            ",,true,false,false\n";

        byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"inventory_import_template.csv\"")
                .header("Content-Type", "text/csv; charset=UTF-8")
                .body(bytes);
    }

    /**
     * Download CSV template for patching orderToDeduction / materialQuotaPercentage.
     * Optionally pre-fills the template with current inventory rows for the tenant/company
     * so the user only needs to fill in the two columns.
     *
     * GET /bom/inventory/template/patch-csv
     * Optional params: tenantId, companyId — if supplied, rows are pre-filled from DB.
     */
    @GetMapping(path = "/template/patch-csv", produces = "text/csv")
    public ResponseEntity<byte[]> downloadPatchCsvTemplate(
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        StringBuilder csv = new StringBuilder();
        // header
        csv.append("id,material_code,batch_no,warehouse_code,order_to_deduction,material_quota_percentage\n");

        if (tenantId != null && companyId != null) {
            // pre-fill with live rows
            List<InventoryEntity> rows = inventoryService.listAllByTenantAndCompany(tenantId, companyId);
            for (InventoryEntity inv : rows) {
                csv.append(inv.getId()).append(',')
                   .append(inv.getMaterialCode()     == null ? "" : inv.getMaterialCode()).append(',')
                   .append(inv.getBatchNo()           == null ? "" : inv.getBatchNo()).append(',')
                   .append(inv.getWarehouseCode()     == null ? "" : inv.getWarehouseCode()).append(',')
                   .append(inv.getOrderToDeduction()  == null ? "" : inv.getOrderToDeduction()).append(',')
                   .append(inv.getMaterialQuotaPercentage() == null ? "" : inv.getMaterialQuotaPercentage().toPlainString())
                   .append('\n');
            }
        } else {
            // blank example rows
            csv.append("550e8400-e29b-41d4-a716-446655440000,MAT-001,BATCH-2026-001,WH-A,A,105.00\n");
            csv.append("550e8400-e29b-41d4-a716-446655440001,MAT-001,BATCH-2026-002,WH-A,B,102.50\n");
            csv.append("550e8400-e29b-41d4-a716-446655440002,MAT-002,BATCH-2026-003,WH-B,,100.00\n");
        }

        byte[] bytes = csv.toString().getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .header("Content-Disposition", "attachment; filename=\"inventory_patch_template.csv\"")
                .header("Content-Type", "text/csv; charset=UTF-8")
                .body(bytes);
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
