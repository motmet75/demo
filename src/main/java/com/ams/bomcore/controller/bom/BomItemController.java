package com.ams.bomcore.controller.bom;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

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

import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.service.bom.BomItemService;

import jakarta.validation.Valid;

/**
 * REST controller for BOM Item CRUD operations.
 * Follows the same pattern as InventoryController.
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/bom-items")
public class BomItemController {

    private final BomItemService bomItemService;

    public BomItemController(BomItemService bomItemService) {
        this.bomItemService = bomItemService;
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
     * List all BOM items for a BOM.
     */
    @GetMapping("/by-bom/{bomId}")
    public ResponseEntity<?> listByBom(@PathVariable("bomId") UUID bomId,
                                       @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                       @RequestParam(value = "companyId", required = false) UUID companyId,
                                       @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                       @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
        }

        List<BomItemEntity> items = bomItemService.listByBomIdAndTenantAndCompany(bomId, tenantId, companyId);
        List<BomItemDto> dtos = items.stream().map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get a BOM item by ID.
     */
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(@PathVariable("id") UUID id) {
        return bomItemService.getById(id)
                .map(item -> ResponseEntity.ok(toDto(item)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Create a new BOM item.
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody Map<String, Object> body,
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

            UUID bomId = UUID.fromString(String.valueOf(body.get("bomId")));
            UUID materialId = UUID.fromString(String.valueOf(body.get("materialId")));
            BigDecimal quantity = new BigDecimal(String.valueOf(body.get("quantity")));
            Integer level = body.get("level") != null ? Integer.parseInt(String.valueOf(body.get("level"))) : 1;
            UUID parentItemId = body.get("parentItemId") != null ? UUID.fromString(String.valueOf(body.get("parentItemId"))) : null;

            BomItemEntity item = bomItemService.create(bomId, materialId, quantity, level, parentItemId, tenantId, companyId);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(item));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Update a BOM item.
     */
    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable("id") UUID id,
                                    @Valid @RequestBody Map<String, Object> body,
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

            UUID materialId = body.get("materialId") != null ? UUID.fromString(String.valueOf(body.get("materialId"))) : null;
            BigDecimal quantity = body.get("quantity") != null ? new BigDecimal(String.valueOf(body.get("quantity"))) : null;
            Integer level = body.get("level") != null ? Integer.parseInt(String.valueOf(body.get("level"))) : null;
            UUID parentItemId = body.get("parentItemId") != null ? UUID.fromString(String.valueOf(body.get("parentItemId"))) : null;

            BomItemEntity item = bomItemService.update(id, materialId, quantity, level, parentItemId, tenantId, companyId);
            return ResponseEntity.ok(toDto(item));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Delete a BOM item.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        if (bomItemService.getById(id).isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        bomItemService.delete(id);
        return ResponseEntity.noContent().build();
    }

    private BomItemDto toDto(BomItemEntity item) {
        return new BomItemDto(
                item.getId(),
                item.getBom() != null ? item.getBom().getId() : null,
                item.getMaterial() != null ? item.getMaterial().getId() : null,
                item.getMaterial() != null ? item.getMaterial().getMaterialCode() : null,
                item.getMaterial() != null ? item.getMaterial().getMaterialName() : null,
                item.getQuantity(),
                item.getLevel(),
                item.getParentItem() != null ? item.getParentItem().getId() : null,
                item.getTenantId(),
                item.getCompanyId(),
                item.getCreatedAt()
        );
    }

    public static class BomItemDto {
        public final UUID id;
        public final UUID bomId;
        public final UUID materialId;
        public final String materialCode;
        public final String materialName;
        public final BigDecimal quantity;
        public final Integer level;
        public final UUID parentItemId;
        public final UUID tenantId;
        public final UUID companyId;
        public final java.time.Instant createdAt;

        public BomItemDto(UUID id, UUID bomId, UUID materialId, String materialCode, String materialName,
                         BigDecimal quantity, Integer level, UUID parentItemId, UUID tenantId, UUID companyId,
                         java.time.Instant createdAt) {
            this.id = id;
            this.bomId = bomId;
            this.materialId = materialId;
            this.materialCode = materialCode;
            this.materialName = materialName;
            this.quantity = quantity;
            this.level = level;
            this.parentItemId = parentItemId;
            this.tenantId = tenantId;
            this.companyId = companyId;
            this.createdAt = createdAt;
        }
    }
}
