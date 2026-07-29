package com.ams.bomcore.controller.model;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import org.apache.poi.ss.usermodel.*;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.model.ModelService;
import com.ams.bomcore.service.shop.ShopPricingService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

import jakarta.validation.Valid;

/**
 * REST controller for Model CRUD, updated to support XLSX imports using Apache POI.
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/models")
public class ModelController {

    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();

    private final ModelService modelService;
    private final ModelRepository modelRepository;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;

    private final ShopPricingService shopPricingService;

    public ModelController(ModelService modelService, ModelRepository modelRepository, TenantRepository tenantRepository, CompanyRepository companyRepository, ShopPricingService shopPricingService) {
        this.modelService = modelService;
        this.modelRepository = modelRepository;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.shopPricingService = shopPricingService;
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

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalArgumentException("company does not belong to tenant");
        }

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

        var existing = modelRepository.findByModelCodeAndTenantIdAndCompanyId(model.getModelCode(), tenant.getId(), company.getId());
        if (existing.isPresent()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("model code already exists for this company");
		}

        model.setTenantId(tenant.getId());
        model.setCompanyId(company.getId());
        try {
            normalizeAllowedSideConfig(model, tenant.getId(), company.getId());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
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
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
		}

        Model existingModel = modelRepository.findById(id).orElse(null);
        if (existingModel == null) {
            return ResponseEntity.notFound().build();
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        if (!tenant.getId().equals(existingModel.getTenantId()) || !company.getId().equals(existingModel.getCompanyId())) {
            return ResponseEntity.notFound().build();
        }

        model.setId(id);
        model.setTenantId(tenant.getId());
        model.setCompanyId(company.getId());
        try {
            normalizeAllowedSideConfig(model, tenant.getId(), company.getId());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
        Model saved = modelService.updateForTenantAndCompany(model, tenant.getId(), company.getId());
        return ResponseEntity.ok(saved);
    }

    private void normalizeAllowedSideConfig(Model model, UUID tenantId, UUID companyId) {
        String raw = model.getAllowedSideIds();
        if (raw == null || raw.isBlank()) {
            model.setAllowedSideIds(null);
            return;
        }

        try {
            JsonNode parsed = JSON_MAPPER.readTree(raw);
            if (!parsed.isArray()) {
                throw new IllegalArgumentException("allowedSideIds must be a JSON array");
            }

            ArrayNode normalized = JSON_MAPPER.createArrayNode();
            Set<UUID> seen = new LinkedHashSet<>();
            for (JsonNode entry : parsed) {
                String rawId = entry.isTextual()
                        ? entry.asText()
                        : entry.isObject() && entry.hasNonNull("modelId") ? entry.get("modelId").asText() : null;
                if (rawId == null || rawId.isBlank()) {
                    throw new IllegalArgumentException("Each side/topping item must have a modelId");
                }

                UUID sideId;
                try {
                    sideId = UUID.fromString(rawId);
                } catch (IllegalArgumentException ex) {
                    throw new IllegalArgumentException("Invalid side/topping modelId: " + rawId);
                }
                if (sideId.equals(model.getId())) {
                    throw new IllegalArgumentException("A menu item cannot be its own side/topping");
                }
                if (!seen.add(sideId)) {
                    continue;
                }

                Model side = modelRepository.findById(sideId)
                        .filter(candidate -> tenantId.equals(candidate.getTenantId())
                                && companyId.equals(candidate.getCompanyId()))
                        .orElseThrow(() -> new IllegalArgumentException("Side/topping item not found: " + sideId));
                if (side.getSellingPrice() == null) {
                    throw new IllegalArgumentException("Side/topping item must have a selling price: " + side.getModelName());
                }

                int maxQty = entry.isObject() && entry.hasNonNull("maxQty")
                        ? entry.get("maxQty").asInt(1)
                        : 1;
                if (maxQty < 1 || maxQty > 99) {
                    throw new IllegalArgumentException("Side/topping maxQty must be between 1 and 99");
                }

                ObjectNode item = normalized.addObject();
                item.put("modelId", sideId.toString());
                item.put("maxQty", maxQty);
            }
            model.setAllowedSideIds(normalized.isEmpty() ? null : JSON_MAPPER.writeValueAsString(normalized));
        } catch (IllegalArgumentException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new IllegalArgumentException("Invalid allowedSideIds JSON", ex);
        }
    }

    @GetMapping("/{id}/cost-estimate")
    public ResponseEntity<?> costEstimate(@PathVariable("id") UUID id,
                                          @RequestParam(value = "quantity", defaultValue = "1") java.math.BigDecimal quantity,
                                          @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                          @RequestParam(value = "companyId", required = false) UUID companyId,
                                          @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                          @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
        }
        var breakdown = shopPricingService.calculateRawCost(id, quantity, tenantId, companyId);
        return ResponseEntity.ok(breakdown);
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
     * Import models from XLSX (multipart/form-data).
     * Expected columns: model_code, model_name, hs_code, co_criteria
     */
    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResult> importXlsx(
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

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow();
        Company company = companyRepository.findById(companyId).orElseThrow();

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ImportResult.error("company does not belong to tenant"));
        }

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!filename.toLowerCase().endsWith(".xlsx")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(ImportResult.error("Only XLSX files are supported"));
        }

        List<String> errors = new ArrayList<>();
        List<Model> toSave = new ArrayList<>();

        try (InputStream is = file.getInputStream();
             Workbook workbook = WorkbookFactory.create(is)) {

            Sheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return ResponseEntity.badRequest().body(ImportResult.error("Excel file is empty"));
            }

            // Map header names to column indices for robustness
            Map<String, Integer> columnMap = new HashMap<>();
            for (Cell cell : headerRow) {
                columnMap.put(cell.getStringCellValue().trim().toLowerCase(), cell.getColumnIndex());
            }

            DataFormatter formatter = new DataFormatter();

            for (int i = 1; i <= sheet.getLastRowNum(); i++) {
                Row row = sheet.getRow(i);
                if (row == null || isRowEmpty(row)) continue;

                try {
                    String code = getCellValue(row, columnMap, "model_code", formatter);
                    String name = getCellValue(row, columnMap, "model_name", formatter);

                    if (code == null || code.isEmpty() || name == null || name.isEmpty()) {
                        errors.add("Row " + (i + 1) + ": model_code and model_name are required");
                        continue;
                    }

                    if (modelRepository.findByModelCodeAndTenantIdAndCompanyId(code, tenant.getId(), company.getId()).isPresent()) {
                        errors.add("Row " + (i + 1) + ": model_code already exists: " + code);
                        continue;
                    }

                    Model m = new Model();
                    m.setModelCode(code);
                    m.setModelName(name);
                    m.setHsCode(getCellValue(row, columnMap, "hs_code", formatter));
                    m.setCoCriteria(getCellValue(row, columnMap, "co_criteria", formatter));
                    m.setTenantId(tenant.getId());
                    m.setCompanyId(company.getId());
                    m.setIsActive(true);
                    toSave.add(m);
                } catch (Exception e) {
                    errors.add("Row " + (i + 1) + ": " + e.getMessage());
                }
            }

            if (!toSave.isEmpty()) {
                modelRepository.saveAll(toSave);
            }
            return ResponseEntity.ok(ImportResult.success(toSave.size(), errors));

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ImportResult.error("Failed to parse XLSX file: " + e.getMessage()));
        }
    }

    private String getCellValue(Row row, Map<String, Integer> map, String colName, DataFormatter formatter) {
        Integer idx = map.get(colName);
        if (idx == null) return "";
        Cell cell = row.getCell(idx);
        return formatter.formatCellValue(cell).trim();
    }

    private boolean isRowEmpty(Row row) {
        for (int c = row.getFirstCellNum(); c < row.getLastCellNum(); c++) {
            Cell cell = row.getCell(c);
            if (cell != null && cell.getCellType() != CellType.BLANK) return false;
        }
        return true;
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