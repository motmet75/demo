package com.ams.bomcore.controller.modelbom;

import java.util.List;
import java.util.UUID;

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

import com.ams.bomcore.domain.modelbom.ModelBom;
import com.ams.bomcore.repository.ModelBomRepository;
import com.ams.bomcore.service.modelbom.ModelBomService;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.domain.tenant.Tenant;

import jakarta.validation.Valid;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/model-boms")
public class ModelBomController {

    private final ModelBomService modelBomService;
    private final ModelBomRepository modelBomRepository;
    private final TenantRepository tenantRepository;

    public ModelBomController(ModelBomService modelBomService, ModelBomRepository modelBomRepository, TenantRepository tenantRepository) {
        this.modelBomService = modelBomService;
        this.modelBomRepository = modelBomRepository;
        this.tenantRepository = tenantRepository;
    }

    private UUID resolveTenant(UUID tenantId, String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { return UUID.fromString(headerTenantId); } catch (Exception e) { }
        }
        return tenantId;
    }

    @GetMapping
    public List<ModelBom> list(@RequestParam(value = "tenantId", required = false) UUID tenantId,
                               @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId is required");
        }
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        // simple approach: return all ModelBom entries and let tenant enforcement be applied elsewhere
        // For now, return all and rely on tenantId being set on created rows; this can be improved with a tenant-scoped repo method
        return modelBomService.findAll();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ModelBom> create(@Valid @RequestBody ModelBom modelBom,
                                           @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                           @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        if (tenantId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));

        modelBom.setTenantId(tenant.getId().toString());
        ModelBom saved = modelBomService.create(modelBom);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ModelBom> update(@PathVariable("id") UUID id, @Valid @RequestBody ModelBom modelBom,
                                          @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                          @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        if (tenantId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);

        modelBom.setId(id);
        if (!modelBomRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        modelBom.setTenantId(tenant.getId().toString());
        ModelBom saved = modelBomRepository.save(modelBom);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        if (!modelBomRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        modelBomService.delete(id);
        return ResponseEntity.noContent().build();
    }
}