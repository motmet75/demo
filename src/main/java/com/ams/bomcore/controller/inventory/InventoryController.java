package com.ams.bomcore.controller.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
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
import com.ams.bomcore.service.inventory.InventoryService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;
    private final InventoryImportService inventoryImportService;

    public InventoryController(InventoryService inventoryService, InventoryImportService inventoryImportService) {
        this.inventoryService = inventoryService;
        this.inventoryImportService = inventoryImportService;
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

            Instant expirationDateTime = exp == null || exp.trim().isEmpty() ? null : Instant.parse(exp);
            Instant productionDateTime = prod == null || prod.trim().isEmpty() ? null : Instant.parse(prod);
            BigDecimal quantityReserved = qres == null || qres.trim().isEmpty() ? null : new BigDecimal(qres);

            // prefer ids when provided
            Object mid = body.get("materialId");
            Object wid = body.get("warehouseId");
            InventoryEntity saved;
            if (mid != null && wid != null) {
                UUID materialId = UUID.fromString(String.valueOf(mid));
                UUID warehouseId = UUID.fromString(String.valueOf(wid));
                saved = inventoryService.addStockByIds(materialId, warehouseId, qty, batchNo, expirationDateTime, productionDateTime, quantityReserved, tenantId, companyId, reason, createdBy, notes, invoiceId);
            } else {
                String materialCode = (String) body.get("materialCode");
                String warehouseCode = (String) body.get("warehouseCode");
                saved = inventoryService.addStock(materialCode, warehouseCode, qty, batchNo, expirationDateTime, productionDateTime, quantityReserved, tenantId, companyId, reason, createdBy, notes, invoiceId);
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

            Instant expirationDateTime = exp == null || exp.trim().isEmpty() ? null : Instant.parse(exp);
            Instant productionDateTime = prod == null || prod.trim().isEmpty() ? null : Instant.parse(prod);
            BigDecimal quantityReserved = qres == null || qres.trim().isEmpty() ? null : new BigDecimal(qres);

            // quantityTotal is intentionally NOT accepted here — it is set only at import/initial creation
            InventoryEntity updated = inventoryService.updateStock(id, qty, null, batchNo, expirationDateTime, productionDateTime, quantityReserved, tenantId, companyId, reason, createdBy, notes);
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
}
