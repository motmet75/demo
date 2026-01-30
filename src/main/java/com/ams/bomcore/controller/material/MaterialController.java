package com.ams.bomcore.controller.material;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.Optional;

import jakarta.validation.Valid;

import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.material.MaterialService;

/*
 * Controller for Material CRUD and import endpoint.
 * - GET /api/materials?tenantId=&companyId=
 * - POST /api/materials
 * - PUT /api/materials/{id}
 * - DELETE /api/materials/{id}
 * - POST /api/materials/import (multipart/form-data, CSV supported)
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/materials")
public class MaterialController {

    private final MaterialService materialService;
    private final MaterialRepository materialRepository;
    private final CompanyRepository companyRepository;
    private final TenantRepository tenantRepository;
    private final ObjectMapper objectMapper;

    public MaterialController(MaterialService materialService, MaterialRepository materialRepository, CompanyRepository companyRepository, TenantRepository tenantRepository, Optional<ObjectMapper> objectMapperOptional) {
        this.materialService = materialService;
        this.materialRepository = materialRepository;
        this.companyRepository = companyRepository;
        this.tenantRepository = tenantRepository;
        // If Spring provides an ObjectMapper bean, use it; otherwise fall back to a plain one.
        this.objectMapper = (objectMapperOptional != null && objectMapperOptional.isPresent()) ? objectMapperOptional.get() : new ObjectMapper();
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
    public List<Material> list(@RequestParam(value = "tenantId", required = false) UUID tenantId,
                               @RequestParam(value = "companyId", required = false) UUID companyId,
                               @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                               @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        // prefer headers
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

        return materialService.findAllByCompany(company);
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody Material material,
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
        var existing = materialRepository.findByMaterialCodeAndCompany(material.getMaterialCode(), company);
        if (existing.isPresent()) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("material code already exists for this company");

        Material saved = materialService.createForCompany(material, company, tenant);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable("id") UUID id,
                                    @Valid @RequestBody Material material,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        // prefer headers
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");

        if (!materialRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        // ensure id is set on incoming object and update scoping
        material.setId(id);
        Material saved = materialService.updateForCompany(material, company, tenant);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        if (!materialRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        materialService.delete(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Import materials from CSV (multipart/form-data).
     * Simple CSV format expected: material_code,material_name,unit,material_type
     * It will parse rows, validate minimal fields, and perform batch save.
     */
    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResult> importCsv(@RequestParam("file") MultipartFile file,
                                                  @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                                  @RequestParam(value = "companyId", required = false) UUID companyId,
                                                  @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                                  @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (companyId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ImportResult.error("companyId is required for import"));
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        // Only accept CSV for now
        if (!filename.toLowerCase().endsWith(".csv")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(ImportResult.error("Only CSV files are supported currently"));
        }

        List<String> errors = new ArrayList<>();
        List<Material> toSave = new ArrayList<>();
        int row = 0;
        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = br.readLine()) != null) {
                row++;
                if (line.trim().isEmpty()) continue;
                // naive CSV split by comma
                String[] cols = line.split(",");
                // allow header detection
                if (row == 1 && (cols[0].toLowerCase().contains("material") || cols.length < 3)) {
                    // assume header, skip
                    continue;
                }
                if (cols.length < 4) {
                    errors.add("Row " + row + ": expected 4 columns (code,name,unit,type)");
                    continue;
                }
                String code = cols[0].trim();
                String name = cols[1].trim();
                String unit = cols[2].trim();
                String type = cols[3].trim();
                if (code.isEmpty() || name.isEmpty() || unit.isEmpty() || type.isEmpty()) {
                    errors.add("Row " + row + ": missing required fields");
                    continue;
                }
                // skip duplicates in DB by code within company
                if (materialRepository.findByMaterialCodeAndCompany(code, company).isPresent()) {
                    errors.add("Row " + row + ": material_code already exists for company: " + code);
                    continue;
                }
                Material m = new Material();
                m.setMaterialCode(code);
                m.setMaterialName(name);
                m.setUnit(unit);
                m.setMaterialType(type);
                m.setCompany(company);
                m.setTenant(tenant);
                toSave.add(m);
            }

            if (!toSave.isEmpty()) {
                // batch save
                List<Material> saved = materialRepository.saveAll(toSave);
                return ResponseEntity.ok(ImportResult.success(saved.size(), errors));
            } else {
                return ResponseEntity.ok(ImportResult.success(0, errors));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ImportResult.error("Failed to parse file: " + e.getMessage()));
        }
    }

    @PostMapping(path = "/export", consumes = MediaType.APPLICATION_JSON_VALUE, produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<StreamingResponseBody> exportToExcel(@RequestBody(required = false) List<String> ids) {
        // Accept a JSON array of id strings. If null or empty, produce an empty sheet with headers.
        List<String> incoming = ids == null ? new ArrayList<>() : new ArrayList<>(ids);

        // Trim and keep only valid UUID strings
        List<UUID> uuidList = new ArrayList<>();
        if (incoming != null) {
            for (String s : incoming) {
                if (s == null) continue;
                try {
                    uuidList.add(UUID.fromString(s.trim()));
                } catch (Exception ex) {
                    // skip invalid UUID strings
                }
            }
        }

        // find materials by ids (if none, we'll produce an empty sheet with just headers)
        List<Material> list = uuidList.isEmpty() ? new ArrayList<>() : materialRepository.findAllById(uuidList);

        StreamingResponseBody stream = (OutputStream os) -> {
            try (XSSFWorkbook workbook = new XSSFWorkbook()) {
                Sheet sheet = workbook.createSheet("Materials");
                int rownum = 0;
                // header
                Row header = sheet.createRow(rownum++);
                String[] headers = new String[] { "ID", "Code", "Name", "Unit", "Type", "Price", "Description", "Active", "CreatedAt" };
                for (int i = 0; i < headers.length; i++) {
                    Cell c = header.createCell(i);
                    c.setCellValue(headers[i]);
                }

                DateTimeFormatter dtf = DateTimeFormatter.ISO_INSTANT;

                for (Material m : list) {
                    Row r = sheet.createRow(rownum++);
                    r.createCell(0).setCellValue(m.getId() == null ? "" : m.getId().toString());
                    r.createCell(1).setCellValue(m.getMaterialCode() == null ? "" : m.getMaterialCode());
                    r.createCell(2).setCellValue(m.getMaterialName() == null ? "" : m.getMaterialName());
                    r.createCell(3).setCellValue(m.getUnit() == null ? "" : m.getUnit());
                    r.createCell(4).setCellValue(m.getMaterialType() == null ? "" : m.getMaterialType());
                    if (m.getPrice() != null) {
                        r.createCell(5).setCellValue(m.getPrice().doubleValue());
                    } else {
                        r.createCell(5).setCellValue("");
                    }
                    r.createCell(6).setCellValue(m.getDescription() == null ? "" : m.getDescription());
                    r.createCell(7).setCellValue(m.getIsActive() == null ? "" : m.getIsActive().toString());
                    r.createCell(8).setCellValue(m.getCreatedAt() == null ? "" : dtf.format(m.getCreatedAt()));
                }

                // auto-size columns for small datasets
                for (int i = 0; i < headers.length; i++) {
                    sheet.autoSizeColumn(i);
                }

                workbook.write(os);
                os.flush();
            }
        };

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=materials_selected_export.xlsx");
        headers.add(HttpHeaders.CONTENT_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        return ResponseEntity.ok().headers(headers).body(stream);
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

        public boolean isSuccess() {
            return success;
        }

        public void setSuccess(boolean success) {
            this.success = success;
        }

        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public int getCreated() {
            return created;
        }

        public void setCreated(int created) {
            this.created = created;
        }

        public List<String> getErrors() {
            return errors;
        }

        public void setErrors(List<String> errors) {
            this.errors = errors;
        }
    }
}
