package com.ams.bomcore.controller.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.inventory.InventoryMovementEntity;
import com.ams.bomcore.service.inventory.InventoryException;
import com.ams.bomcore.service.inventory.InventoryMovementService;

import jakarta.validation.Valid;

/**
 * REST controller for inventory movements.
 * Follows the same pattern as InventoryController.
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/inventory-movements")
public class InventoryMovementController {

    private final InventoryMovementService movementService;

    public InventoryMovementController(InventoryMovementService movementService) {
        this.movementService = movementService;
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

    /**
     * List all movements.
     */
    @GetMapping
    public ResponseEntity<?> list(@RequestParam(value = "tenantId", required = false) UUID tenantId,
                                  @RequestParam(value = "companyId", required = false) UUID companyId,
                                  @RequestParam(value = "movementType", required = false) String movementType,
                                  @RequestParam(value = "materialId", required = false) UUID materialId,
                                  @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                  @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
        }

        List<InventoryMovementEntity> movements;
        if (movementType != null && !movementType.isBlank()) {
            movements = movementService.listByType(tenantId, companyId, movementType);
        } else if (materialId != null) {
            movements = movementService.listByMaterial(tenantId, companyId, materialId);
        } else {
            movements = movementService.listAll(tenantId, companyId);
        }

        return ResponseEntity.ok(movements);
    }

    /**
     * Get movement by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable("id") UUID id) {
        InventoryMovementEntity movement = movementService.getById(id);
        if (movement == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(movement);
    }

    /**
     * Record an IN movement.
     */
    @PostMapping(path = "/in", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> recordIn(@Valid @RequestBody Map<String, Object> body,
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

            UUID materialId = UUID.fromString(String.valueOf(body.get("materialId")));
            UUID warehouseId = UUID.fromString(String.valueOf(body.get("warehouseId")));
            BigDecimal quantity = new BigDecimal(String.valueOf(body.get("quantity")));
            String unit = body.get("unit") != null ? String.valueOf(body.get("unit")) : "pcs";
            String batchNo = body.get("batchNo") != null ? String.valueOf(body.get("batchNo")) : null;
            String reason = body.get("reason") != null ? String.valueOf(body.get("reason")) : null;
            String createdBy = body.get("createdBy") != null ? String.valueOf(body.get("createdBy")) : "system";
            String referenceType = body.get("referenceType") != null ? String.valueOf(body.get("referenceType")) : null;
            UUID referenceId = body.get("referenceId") != null ? UUID.fromString(String.valueOf(body.get("referenceId"))) : null;
            String notes = body.get("notes") != null ? String.valueOf(body.get("notes")) : null;

            InventoryMovementEntity movement = movementService.recordInMovement(
                    materialId, warehouseId, quantity, unit, batchNo, reason, createdBy,
                    referenceType, referenceId, notes, tenantId, companyId);

            return ResponseEntity.status(HttpStatus.CREATED).body(movement);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Record an OUT movement.
     */
    @PostMapping(path = "/out", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> recordOut(@Valid @RequestBody Map<String, Object> body,
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

            UUID materialId = UUID.fromString(String.valueOf(body.get("materialId")));
            UUID warehouseId = UUID.fromString(String.valueOf(body.get("warehouseId")));
            BigDecimal quantity = new BigDecimal(String.valueOf(body.get("quantity")));
            String unit = body.get("unit") != null ? String.valueOf(body.get("unit")) : "pcs";
            String batchNo = body.get("batchNo") != null ? String.valueOf(body.get("batchNo")) : null;
            String reason = body.get("reason") != null ? String.valueOf(body.get("reason")) : null;
            String createdBy = body.get("createdBy") != null ? String.valueOf(body.get("createdBy")) : "system";
            String referenceType = body.get("referenceType") != null ? String.valueOf(body.get("referenceType")) : null;
            UUID referenceId = body.get("referenceId") != null ? UUID.fromString(String.valueOf(body.get("referenceId"))) : null;
            String notes = body.get("notes") != null ? String.valueOf(body.get("notes")) : null;

            InventoryMovementEntity movement = movementService.recordOutMovement(
                    materialId, warehouseId, quantity, unit, batchNo, reason, createdBy,
                    referenceType, referenceId, notes, tenantId, companyId);

            return ResponseEntity.status(HttpStatus.CREATED).body(movement);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Record a TRANSFER movement.
     */
    @PostMapping(path = "/transfer", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> recordTransfer(@Valid @RequestBody Map<String, Object> body,
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

            UUID materialId = UUID.fromString(String.valueOf(body.get("materialId")));
            UUID fromWarehouseId = UUID.fromString(String.valueOf(body.get("fromWarehouseId")));
            UUID toWarehouseId = UUID.fromString(String.valueOf(body.get("toWarehouseId")));
            BigDecimal quantity = new BigDecimal(String.valueOf(body.get("quantity")));
            String unit = body.get("unit") != null ? String.valueOf(body.get("unit")) : "pcs";
            String batchNo = body.get("batchNo") != null ? String.valueOf(body.get("batchNo")) : null;
            String reason = body.get("reason") != null ? String.valueOf(body.get("reason")) : null;
            String createdBy = body.get("createdBy") != null ? String.valueOf(body.get("createdBy")) : "system";
            String notes = body.get("notes") != null ? String.valueOf(body.get("notes")) : null;

            InventoryMovementEntity movement = movementService.recordTransferMovement(
                    materialId, fromWarehouseId, toWarehouseId, quantity, unit, batchNo, reason,
                    createdBy, notes, tenantId, companyId);

            return ResponseEntity.status(HttpStatus.CREATED).body(movement);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Record an ADJUSTMENT movement.
     */
    @PostMapping(path = "/adjustment", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> recordAdjustment(@Valid @RequestBody Map<String, Object> body,
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

            UUID materialId = UUID.fromString(String.valueOf(body.get("materialId")));
            UUID warehouseId = UUID.fromString(String.valueOf(body.get("warehouseId")));
            BigDecimal quantity = new BigDecimal(String.valueOf(body.get("quantity")));
            String unit = body.get("unit") != null ? String.valueOf(body.get("unit")) : "pcs";
            String batchNo = body.get("batchNo") != null ? String.valueOf(body.get("batchNo")) : null;
            String reason = body.get("reason") != null ? String.valueOf(body.get("reason")) : null;
            String createdBy = body.get("createdBy") != null ? String.valueOf(body.get("createdBy")) : "system";
            String notes = body.get("notes") != null ? String.valueOf(body.get("notes")) : null;

            InventoryMovementEntity movement = movementService.recordAdjustmentMovement(
                    materialId, warehouseId, quantity, unit, batchNo, reason, createdBy, notes,
                    tenantId, companyId);

            return ResponseEntity.status(HttpStatus.CREATED).body(movement);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Delete a movement by ID.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        InventoryMovementEntity existing = movementService.getById(id);
        if (existing == null) {
            return ResponseEntity.notFound().build();
        }
        movementService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
