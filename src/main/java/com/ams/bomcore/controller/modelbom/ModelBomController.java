package com.ams.bomcore.controller.modelbom;

import java.util.List;
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

import com.ams.bomcore.domain.modelbom.ModelBom;
import com.ams.bomcore.repository.ModelBomRepository;
import com.ams.bomcore.service.modelbom.ModelBomService;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.controller.modelbom.dto.ModelBomView;
import com.ams.bomcore.repository.ModelRepository;

import jakarta.validation.Valid;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/model-boms")
public class ModelBomController {

    private final ModelBomService modelBomService;
    private final ModelBomRepository modelBomRepository;
    private final TenantRepository tenantRepository;
    private final ModelRepository modelRepository;

    public ModelBomController(ModelBomService modelBomService, ModelBomRepository modelBomRepository, TenantRepository tenantRepository, ModelRepository modelRepository) {
        this.modelBomService = modelBomService;
        this.modelBomRepository = modelBomRepository;
        this.tenantRepository = tenantRepository;
        this.modelRepository = modelRepository;
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

    @GetMapping(path = "/by-model/{modelId}")
    public ResponseEntity<List<ModelBomView>> getByModel(@PathVariable("modelId") UUID modelId,
                                                         @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                                         @RequestParam(value = "companyId", required = false) UUID companyId,
                                                         @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        if (tenantId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(null);
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));

        // fetch model and verify tenant
        java.util.Optional<com.ams.bomcore.domain.model.Model> maybeModel = modelRepository.findById(modelId);
        if (maybeModel.isEmpty()) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(null);
        }
        com.ams.bomcore.domain.model.Model model = maybeModel.get();
        if (model.getTenantId() == null || !model.getTenantId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
        }
        if (companyId != null && model.getCompanyId() != null && !model.getCompanyId().equals(companyId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(null);
        }

        List<ModelBom> list = modelBomRepository.findAllByModel(model);
        if (list == null) list = java.util.Collections.emptyList();

        // capture final refs for lambda
        final com.ams.bomcore.domain.model.Model finalModel = model;
        List<ModelBomView> views = list.stream().map(mb -> {
            ModelBomView v = new ModelBomView();
            v.setId(mb.getId());
            v.setModelId(finalModel.getId());
            v.setModelCode(finalModel.getModelCode());
            v.setModelName(finalModel.getModelName());
            v.setHsCode(finalModel.getHsCode());
            v.setCoCriteria(finalModel.getCoCriteria());
            if (mb.getMaterial() != null) {
                v.setMaterialId(mb.getMaterial().getId());
                v.setMaterialCode(mb.getMaterial().getMaterialCode());
                v.setMaterialName(mb.getMaterial().getMaterialName());
            }
            v.setQtyPerUnit(mb.getQtyPerUnit());
            return v;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(views);
    }

    private UUID resolveCompany(UUID companyId, String headerCompanyId) {
        if (headerCompanyId != null && !headerCompanyId.isBlank()) {
            try { return UUID.fromString(headerCompanyId); } catch (Exception e) { }
        }
        return companyId;
    }

    /**
     * Create a new ModelBom entry with full tenant/company scope.
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody java.util.Map<String, Object> body,
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

            UUID modelId = UUID.fromString(String.valueOf(body.get("modelId")));
            UUID materialId = UUID.fromString(String.valueOf(body.get("materialId")));
            java.math.BigDecimal qtyPerUnit = new java.math.BigDecimal(String.valueOf(body.get("qtyPerUnit")));

            ModelBom saved = modelBomService.createModelBom(modelId, materialId, qtyPerUnit, tenantId, companyId);

            ModelBomView view = new ModelBomView();
            view.setId(saved.getId());
            if (saved.getModel() != null) {
                view.setModelId(saved.getModel().getId());
                view.setModelCode(saved.getModel().getModelCode());
                view.setModelName(saved.getModel().getModelName());
                view.setHsCode(saved.getModel().getHsCode());
                view.setCoCriteria(saved.getModel().getCoCriteria());
            }
            if (saved.getMaterial() != null) {
                view.setMaterialId(saved.getMaterial().getId());
                view.setMaterialCode(saved.getMaterial().getMaterialCode());
                view.setMaterialName(saved.getMaterial().getMaterialName());
            }
            view.setQtyPerUnit(saved.getQtyPerUnit());

            return ResponseEntity.status(HttpStatus.CREATED).body(view);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Update an existing ModelBom entry.
     */
    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable("id") UUID id,
                                    @Valid @RequestBody java.util.Map<String, Object> body,
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

            if (!modelBomRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }

            UUID materialId = body.get("materialId") != null ? UUID.fromString(String.valueOf(body.get("materialId"))) : null;
            java.math.BigDecimal qtyPerUnit = body.get("qtyPerUnit") != null ? new java.math.BigDecimal(String.valueOf(body.get("qtyPerUnit"))) : null;

            ModelBom saved = modelBomService.updateModelBom(id, materialId, qtyPerUnit, tenantId, companyId);

            ModelBomView view = new ModelBomView();
            view.setId(saved.getId());
            if (saved.getModel() != null) {
                view.setModelId(saved.getModel().getId());
                view.setModelCode(saved.getModel().getModelCode());
                view.setModelName(saved.getModel().getModelName());
                view.setHsCode(saved.getModel().getHsCode());
                view.setCoCriteria(saved.getModel().getCoCriteria());
            }
            if (saved.getMaterial() != null) {
                view.setMaterialId(saved.getMaterial().getId());
                view.setMaterialCode(saved.getMaterial().getMaterialCode());
                view.setMaterialName(saved.getMaterial().getMaterialName());
            }
            view.setQtyPerUnit(saved.getQtyPerUnit());

            return ResponseEntity.ok(view);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Delete a ModelBom entry.
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        if (!modelBomRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        modelBomService.delete(id);
        return ResponseEntity.noContent().build();
    }
}