package com.ams.bomcore.controller.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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

import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.service.model.ModelService;

import jakarta.validation.Valid;

/**
 * Thin REST controller for Model CRUD, follows Material controller patterns.
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/models")
public class ModelController {

    private final ModelService modelService;
    private final ModelRepository modelRepository;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;

    public ModelController(ModelService modelService, ModelRepository modelRepository, TenantRepository tenantRepository, CompanyRepository companyRepository) {
        this.modelService = modelService;
        this.modelRepository = modelRepository;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
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
    public List<Model> list(@RequestParam(value = "tenantId", required = false) UUID tenantId,
                            @RequestParam(value = "companyId", required = false) UUID companyId,
                            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            throw new IllegalArgumentException("tenantId and companyId are required");
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        // confirm company belongs to tenant
        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalArgumentException("company does not belong to tenant");
        }

        // Model stores tenantId and companyId as strings
        return modelService.findAllByTenantAndCompany(tenant.getId().toString(), company.getId().toString());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody Model model,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        // uniqueness per company
        var existing = modelRepository.findByModelCodeAndTenantIdAndCompanyId(model.getModelCode(), tenant.getId().toString(), company.getId().toString());
        if (existing.isPresent()) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("model code already exists for this company");

        model.setTenantId(tenant.getId().toString());
        model.setCompanyId(company.getId().toString());
        Model saved = modelService.createForTenantAndCompany(model, tenant.getId().toString(), company.getId().toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable("id") UUID id,
                                    @Valid @RequestBody Model model,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        // prefer headers
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

        model.setId(id);
        if (!modelRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        // ensure id/company/tenant are set on incoming object and update scoping
        model.setTenantId(tenant.getId().toString());
        model.setCompanyId(company.getId().toString());
        Model saved = modelService.updateForTenantAndCompany(model, tenant.getId().toString(), company.getId().toString());
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        if (!modelRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        modelService.delete(id);
        return ResponseEntity.noContent().build();
    }
}