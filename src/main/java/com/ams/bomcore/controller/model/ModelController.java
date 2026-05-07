package com.ams.bomcore.controller.model;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
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
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.model.ModelService;

import jakarta.validation.Valid;

/**
 * Thin REST controller for Model CRUD, follows Material controller patterns.
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/models")
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

        // Model stores tenantId and companyId as UUIDs
        return modelService.findAllByTenantAndCompany(tenant.getId(), company.getId());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody Model model,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
		}

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        // uniqueness per company
        var existing = modelRepository.findByModelCodeAndTenantIdAndCompanyId(model.getModelCode(), tenant.getId(), company.getId());
        if (existing.isPresent()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("model code already exists for this company");
		}

        model.setTenantId(tenant.getId());
        model.setCompanyId(company.getId());
        Model saved = modelService.createForTenantAndCompany(model, tenant.getId(), company.getId());
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

        if (tenantId == null || companyId == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
		}

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
        model.setTenantId(tenant.getId());
        model.setCompanyId(company.getId());
        Model saved = modelService.updateForTenantAndCompany(model, tenant.getId(), company.getId());
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

    /**
     * Import models from CSV (multipart/form-data).
     * Expected format: model_code,model_name,hs_code,co_criteria
     * Skips header row and duplicate model codes within the same company.
     */
    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResult> importCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ImportResult.error("tenantId and companyId are required"));
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ImportResult.error("company does not belong to tenant"));
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!filename.toLowerCase().endsWith(".csv")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(ImportResult.error("Only CSV files are supported"));
        }

        List<String> errors = new ArrayList<>();
        List<Model> toSave = new ArrayList<>();
        int rowNum = 0;

        try (BufferedReader br = new BufferedReader(
                new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                rowNum++;
                if (line.trim().isEmpty()) {
					continue;
				}
                String[] cols = line.split(",", -1);
                // Skip header row
                if (rowNum == 1 && (cols[0].toLowerCase().contains("model") || cols[0].toLowerCase().contains("code"))) {
                    continue;
                }
                if (cols.length < 2) {
                    errors.add("Row " + rowNum + ": expected at least 2 columns (model_code, model_name, ...)");
                    continue;
                }
                String code = cols[0].trim();
                String name = cols[1].trim();
                String hsCode = cols.length > 2 ? cols[2].trim() : "";
                String coCriteria = cols.length > 3 ? cols[3].trim() : "";

                if (code.isEmpty() || name.isEmpty()) {
                    errors.add("Row " + rowNum + ": model_code and model_name are required");
                    continue;
                }
                // Skip duplicates already in DB
                if (modelRepository.findByModelCodeAndTenantIdAndCompanyId(code, tenant.getId(), company.getId()).isPresent()) {
                    errors.add("Row " + rowNum + ": model_code already exists: " + code);
                    continue;
                }
                Model m = new Model();
                m.setModelCode(code);
                m.setModelName(name);
                if (!hsCode.isEmpty()) {
					m.setHsCode(hsCode);
				}
                if (!coCriteria.isEmpty()) {
					m.setCoCriteria(coCriteria);
				}
                m.setTenantId(tenant.getId());
                m.setCompanyId(company.getId());
                m.setIsActive(true);
                toSave.add(m);
            }

            if (!toSave.isEmpty()) {
                List<Model> saved = modelRepository.saveAll(toSave);
                return ResponseEntity.ok(ImportResult.success(saved.size(), errors));
            }
            return ResponseEntity.ok(ImportResult.success(0, errors));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ImportResult.error("Failed to parse file: " + e.getMessage()));
        }
    }

    public static class ImportResult {
        private boolean success;
        private String message;
        private int created;
        private List<String> errors = new ArrayList<>();

        public static ImportResult success(int created, List<String> errors) {
            ImportResult r = new ImportResult();
            r.success = true;
            r.message = "Imported";
            r.created = created;
            r.errors = errors == null ? new ArrayList<>() : errors;
            return r;
        }

        public static ImportResult error(String message) {
            ImportResult r = new ImportResult();
            r.success = false;
            r.message = message;
            return r;
        }

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        public int getCreated() { return created; }
        public void setCreated(int created) { this.created = created; }
        public List<String> getErrors() { return errors; }
        public void setErrors(List<String> errors) { this.errors = errors; }
    }
}