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

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.service.bom.BomService;

import jakarta.validation.Valid;

/**
 * Full BOM CRUD controller.
 *
 * GET  /bom/api/bom-crud                       – list all BOMs for tenant+company
 * POST /bom/api/bom-crud                       – create BOM
 * PUT  /bom/api/bom-crud/{id}/status           – change BOM status (ACTIVE/ARCHIVED/DRAFT)
 * DELETE /bom/api/bom-crud/{id}                – delete BOM (non-ACTIVE only)
 * GET  /bom/api/bom-crud/{id}/items            – list BOM items
 * POST /bom/api/bom-crud/{id}/items            – add BOM item
 * PUT  /bom/api/bom-crud/items/{itemId}        – update BOM item
 * DELETE /bom/api/bom-crud/items/{itemId}      – delete BOM item
 * POST /bom/api/bom-crud/sync/{modelId}        – sync BOM from model_bom rows
 * GET  /bom/api/bom-crud/active/{modelId}      – get active BOM for model
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/bom-crud")
public class BomCrudController {

    private final BomService bomService;

    public BomCrudController(BomService bomService) {
        this.bomService = bomService;
    }

    private UUID resolveTenant(UUID t, String h) {
        if (h != null && !h.isBlank()) {
			try { return UUID.fromString(h); } catch (Exception ignored) {}
		}
        return t;
    }
    private UUID resolveCompany(UUID c, String h) {
        if (h != null && !h.isBlank()) {
			try { return UUID.fromString(h); } catch (Exception ignored) {}
		}
        return c;
    }

    // ── BOM list ──────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {

        tenantId  = resolveTenant(tenantId, ht);
        companyId = resolveCompany(companyId, hc);
        if (tenantId == null || companyId == null) {
			return ResponseEntity.badRequest().body("tenantId and companyId are required");
		}

        List<BomDto> dtos = bomService.listByTenantAndCompany(tenantId, companyId)
                .stream().map(this::toDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    // ── Active BOM for model ──────────────────────────────────────────

    @GetMapping("/active/{modelId}")
    public ResponseEntity<?> getActive(
            @PathVariable UUID modelId,
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String ht) {

        tenantId = resolveTenant(tenantId, ht);
        if (tenantId == null) {
			return ResponseEntity.badRequest().body("tenantId is required");
		}

        return bomService.getActiveBomForModel(modelId, tenantId)
                .map(b -> ResponseEntity.ok(toDto(b)))
                .orElse(ResponseEntity.notFound().build());
    }

    // ── Create BOM ────────────────────────────────────────────────────

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(
            @Valid @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {
        try {
            tenantId  = resolveTenant(tenantId, ht);
            companyId = resolveCompany(companyId, hc);
            if (tenantId == null || companyId == null) {
				return ResponseEntity.badRequest().body("tenantId and companyId are required");
			}

            UUID modelId = UUID.fromString(String.valueOf(body.get("modelId")));
            Integer version = body.get("version") != null
                    ? Integer.parseInt(String.valueOf(body.get("version"))) : 1;
            String status = body.get("status") != null ? String.valueOf(body.get("status")) : "DRAFT";
            String bomName = body.get("bomName") != null ? String.valueOf(body.get("bomName")) : null;

            BomEntity bom = bomService.createBom(modelId, tenantId, companyId, version, status);
            if (bomName != null && !bomName.isBlank()) { bom.setBomName(bomName); }
            bom = bomService.saveBom(bom);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(bom));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ── Update BOM name ───────────────────────────────────────────────

    @PutMapping(path = "/{id}/name", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateName(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        try {
            BomEntity bom = bomService.getById(id)
                    .orElseThrow(() -> new IllegalArgumentException("BOM not found: " + id));
            String bomName = body.get("bomName") != null ? String.valueOf(body.get("bomName")) : null;
            bom.setBomName(bomName != null && !bomName.isBlank() ? bomName.trim() : null);
            bom = bomService.saveBom(bom);
            return ResponseEntity.ok(toDto(bom));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ── Update BOM status ─────────────────────────────────────────────

    @PutMapping(path = "/{id}/status", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateStatus(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body) {
        try {
            String status = String.valueOf(body.get("status"));
            BomEntity bom = bomService.updateBomStatus(id, status);
            return ResponseEntity.ok(toDto(bom));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ── Delete BOM ────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteBom(@PathVariable UUID id) {
        try {
            bomService.deleteBom(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ── BOM Items ─────────────────────────────────────────────────────

    @GetMapping("/{id}/items")
    public ResponseEntity<?> listItems(
            @PathVariable UUID id,
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {

        tenantId  = resolveTenant(tenantId, ht);
        companyId = resolveCompany(companyId, hc);
        if (tenantId == null || companyId == null) {
			return ResponseEntity.badRequest().body("tenantId and companyId are required");
		}

        List<BomItemDto> dtos = bomService.getBomItems(id, tenantId, companyId)
                .stream().map(this::toItemDto).collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    @PostMapping(path = "/{id}/items", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> addItem(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {
        try {
            tenantId  = resolveTenant(tenantId, ht);
            companyId = resolveCompany(companyId, hc);
            if (tenantId == null || companyId == null) {
				return ResponseEntity.badRequest().body("tenantId and companyId are required");
			}

            UUID materialId   = UUID.fromString(String.valueOf(body.get("materialId")));
            BigDecimal qty    = new BigDecimal(String.valueOf(body.get("quantity")));
            Integer level     = body.get("level") != null ? Integer.parseInt(String.valueOf(body.get("level"))) : 1;
            UUID parentItemId = body.get("parentItemId") != null
                    ? UUID.fromString(String.valueOf(body.get("parentItemId"))) : null;

            BomItemEntity item = bomService.addBomItem(id, materialId, qty, level, parentItemId, tenantId, companyId);
            return ResponseEntity.status(HttpStatus.CREATED).body(toItemDto(item));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @PutMapping(path = "/items/{itemId}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateItem(
            @PathVariable UUID itemId,
            @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {
        try {
            tenantId  = resolveTenant(tenantId, ht);
            companyId = resolveCompany(companyId, hc);

            UUID materialId = body.get("materialId") != null
                    ? UUID.fromString(String.valueOf(body.get("materialId"))) : null;
            BigDecimal qty  = body.get("quantity") != null
                    ? new BigDecimal(String.valueOf(body.get("quantity"))) : null;
            Integer level   = body.get("level") != null
                    ? Integer.parseInt(String.valueOf(body.get("level"))) : null;

            BomItemEntity item = bomService.updateBomItem(itemId, materialId, qty, level, tenantId, companyId);
            return ResponseEntity.ok(toItemDto(item));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    @DeleteMapping("/items/{itemId}")
    public ResponseEntity<?> deleteItem(@PathVariable UUID itemId) {
        try {
            bomService.deleteBomItem(itemId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ── Sync from ModelBom ────────────────────────────────────────────

    /**
     * POST /bom/api/bom-crud/sync/{modelId}
     * Reads all model_bom rows for this model and creates/versions a new ACTIVE BomEntity.
     */
    @PostMapping("/sync/{modelId}")
    public ResponseEntity<?> syncFromModelBoms(
            @PathVariable UUID modelId,
            @RequestParam(value = "tenantId",  required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {
        try {
            tenantId  = resolveTenant(tenantId, ht);
            companyId = resolveCompany(companyId, hc);
            if (tenantId == null || companyId == null) {
				return ResponseEntity.badRequest().body("tenantId and companyId are required");
			}

            BomEntity bom = bomService.syncBomFromModelBoms(modelId, tenantId, companyId);
            return ResponseEntity.ok(toDto(bom));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(e.getMessage());
        }
    }

    // ── DTOs ─────────────────────────────────────────────────────────

    private BomDto toDto(BomEntity b) {
        return new BomDto(
                b.getId(),
                b.getModel() != null ? b.getModel().getId() : null,
                b.getModel() != null ? b.getModel().getModelCode() : null,
                b.getModel() != null ? b.getModel().getModelName() : null,
                b.getBomName(),
                b.getVersion(),
                b.getStatus(),
                b.getTenantId(),
                b.getCompanyId(),
                b.getCreatedAt());
    }

    private BomItemDto toItemDto(BomItemEntity i) {
        return new BomItemDto(
                i.getId(),
                i.getBom() != null ? i.getBom().getId() : null,
                i.getMaterial() != null ? i.getMaterial().getId() : null,
                i.getMaterial() != null ? i.getMaterial().getMaterialCode() : null,
                i.getMaterial() != null ? i.getMaterial().getMaterialName() : null,
                i.getMaterial() != null ? i.getMaterial().getUnit() : null,
                i.getQuantity(),
                i.getLevel(),
                i.getParentItem() != null ? i.getParentItem().getId() : null);
    }

    public static class BomDto {
        public final UUID id;
        public final UUID modelId;
        public final String modelCode;
        public final String modelName;
        public final String bomName;
        public final Integer version;
        public final String status;
        public final UUID tenantId;
        public final UUID companyId;
        public final java.time.Instant createdAt;

        public BomDto(UUID id, UUID modelId, String modelCode, String modelName, String bomName,
                      Integer version, String status, UUID tenantId, UUID companyId,
                      java.time.Instant createdAt) {
            this.id = id; this.modelId = modelId; this.modelCode = modelCode;
            this.modelName = modelName; this.bomName = bomName; this.version = version;
            this.status = status; this.tenantId = tenantId; this.companyId = companyId;
            this.createdAt = createdAt;
        }
    }

    public static class BomItemDto {
        public final UUID id;
        public final UUID bomId;
        public final UUID materialId;
        public final String materialCode;
        public final String materialName;
        public final String unit;
        public final BigDecimal quantity;
        public final Integer level;
        public final UUID parentItemId;

        public BomItemDto(UUID id, UUID bomId, UUID materialId, String materialCode,
                          String materialName, String unit, BigDecimal quantity,
                          Integer level, UUID parentItemId) {
            this.id = id; this.bomId = bomId; this.materialId = materialId;
            this.materialCode = materialCode; this.materialName = materialName;
            this.unit = unit; this.quantity = quantity;
            this.level = level; this.parentItemId = parentItemId;
        }
    }
}
