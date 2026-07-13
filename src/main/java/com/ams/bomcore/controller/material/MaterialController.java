package com.ams.bomcore.controller.material;

import java.io.ByteArrayOutputStream;
import java.io.OutputStream;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.apache.poi.ss.usermodel.BorderStyle;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;
import org.apache.poi.ss.usermodel.CellType;
import org.apache.poi.ss.usermodel.FillPatternType;
import org.apache.poi.ss.usermodel.Font;
import org.apache.poi.ss.usermodel.IndexedColors;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
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
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.material.MaterialService;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.validation.Valid;

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
@RequestMapping("/bom/materials")
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

        if (tenantId == null || companyId == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
		}

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        // uniqueness per company
        var existing = materialRepository.findByMaterialCodeAndCompany(material.getMaterialCode(), company);
        if (existing.isPresent()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("material code already exists for this company");
		}

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

        if (tenantId == null || companyId == null) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
		}

        Optional<Material> current = materialRepository.findById(id);
        if (current.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));

        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("company does not belong to tenant");
        }

        Material existingMaterial = current.get();
        if (existingMaterial.getTenant() == null || !existingMaterial.getTenant().getId().equals(tenant.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        if (existingMaterial.getCompany() == null || !existingMaterial.getCompany().getId().equals(company.getId())) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }

        var duplicate = materialRepository.findByMaterialCodeAndCompany(material.getMaterialCode(), company);
        if (duplicate.isPresent() && !duplicate.get().getId().equals(id)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("material code already exists for this company");
        }

        Material saved = materialService.updateForCompany(id, material, company, tenant);
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
     * Download XLSX template for material import.
     * GET /bom/materials/template/import
     */
    @GetMapping(path = "/template/import")
    public ResponseEntity<byte[]> downloadImportTemplate() {
        String[] headers = { "material_code", "material_name", "unit", "material_type", "description" };
        Object[][] examples = {
            { "MAT-001", "Steel Plate",  "kg", "RAW_MATERIAL", "Cold-rolled steel plate" },
            { "MAT-002", "Copper Wire",  "m",  "RAW_MATERIAL", "2mm copper wire" },
        };

        try (Workbook wb = new XSSFWorkbook();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {

            Sheet sheet = wb.createSheet("material_import");

            CellStyle headerStyle = wb.createCellStyle();
            Font headerFont = wb.createFont();
            headerFont.setBold(true);
            headerStyle.setFont(headerFont);
            headerStyle.setFillForegroundColor(IndexedColors.LIGHT_CORNFLOWER_BLUE.getIndex());
            headerStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);
            headerStyle.setBorderBottom(BorderStyle.THIN);
            headerStyle.setBorderTop(BorderStyle.THIN);
            headerStyle.setBorderLeft(BorderStyle.THIN);
            headerStyle.setBorderRight(BorderStyle.THIN);

            CellStyle exampleStyle = wb.createCellStyle();
            exampleStyle.setFillForegroundColor(IndexedColors.LIGHT_YELLOW.getIndex());
            exampleStyle.setFillPattern(FillPatternType.SOLID_FOREGROUND);

            Row headerRow = sheet.createRow(0);
            for (int i = 0; i < headers.length; i++) {
                Cell cell = headerRow.createCell(i);
                cell.setCellValue(headers[i]);
                cell.setCellStyle(headerStyle);
                sheet.setColumnWidth(i, 22 * 256);
            }

            for (int r = 0; r < examples.length; r++) {
                Row row = sheet.createRow(r + 1);
                for (int c = 0; c < examples[r].length; c++) {
                    Cell cell = row.createCell(c);
                    cell.setCellValue(examples[r][c] == null ? "" : examples[r][c].toString());
                    cell.setCellStyle(exampleStyle);
                }
            }

            wb.write(out);
            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=\"material_import_template.xlsx\"")
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .body(out.toByteArray());

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    /**
     * Import materials from XLSX file (multipart/form-data).
     * Expected columns: material_code, material_name, unit, material_type, description (optional)
     * Header row is auto-detected and skipped.
     */
    @PostMapping(path = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResult> importXlsx(@RequestParam("file") MultipartFile file,
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

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename().toLowerCase() : "";
        if (!filename.endsWith(".xlsx") && !filename.endsWith(".xls")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                    .body(ImportResult.error("Only XLSX files are supported. Please use the template."));
        }

        List<String> errors = new ArrayList<>();
        List<Material> toSave = new ArrayList<>();

        try (Workbook wb = new XSSFWorkbook(file.getInputStream())) {
            Sheet sheet = wb.getSheetAt(0);
            Iterator<Row> rowIterator = sheet.iterator();

            // Detect and skip header row
            Row firstRow = rowIterator.hasNext() ? rowIterator.next() : null;
            if (firstRow == null) {
                return ResponseEntity.ok(ImportResult.success(0, errors));
            }
            String firstCell = getCellString(firstRow.getCell(0));
            boolean isHeader = firstCell.toLowerCase().contains("material") || firstCell.toLowerCase().contains("code");
            if (!isHeader) {
                // First row is data — process it now
                processXlsxRow(firstRow, company, tenant, errors, toSave, firstRow.getRowNum() + 1);
            }

            while (rowIterator.hasNext()) {
                Row row = rowIterator.next();
                if (isRowEmpty(row)) continue;
                processXlsxRow(row, company, tenant, errors, toSave, row.getRowNum() + 1);
            }

            if (!toSave.isEmpty()) {
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

    private void processXlsxRow(Row row, Company company, Tenant tenant,
                                 List<String> errors, List<Material> toSave, int rowNum) {
        String code        = getCellString(row.getCell(0));
        String name        = getCellString(row.getCell(1));
        String unit        = getCellString(row.getCell(2));
        String type        = getCellString(row.getCell(3));
        String description = row.getLastCellNum() > 4 ? getCellString(row.getCell(4)) : "";

        if (code.isEmpty() || name.isEmpty() || unit.isEmpty() || type.isEmpty()) {
            errors.add("Row " + rowNum + ": missing required fields (code, name, unit, type)");
            return;
        }
        if (materialRepository.findByMaterialCodeAndCompany(code, company).isPresent()) {
            errors.add("Row " + rowNum + ": material_code already exists for company: " + code);
            return;
        }
        Material m = new Material();
        m.setMaterialCode(code);
        m.setMaterialName(name);
        m.setUnit(unit);
        m.setMaterialType(type);
        if (!description.isEmpty()) {
            m.setDescription(description);
        }
        m.setCompany(company);
        m.setTenant(tenant);
        toSave.add(m);
    }

    private String getCellString(Cell cell) {
        if (cell == null) return "";
        if (cell.getCellType() == CellType.NUMERIC) {
            // Avoid scientific notation for numeric codes
            return String.valueOf((long) cell.getNumericCellValue());
        }
        return cell.toString().trim();
    }

    private boolean isRowEmpty(Row row) {
        if (row == null) return true;
        for (int i = row.getFirstCellNum(); i < row.getLastCellNum(); i++) {
            Cell cell = row.getCell(i);
            if (cell != null && cell.getCellType() != CellType.BLANK && !cell.toString().trim().isEmpty()) {
                return false;
            }
        }
        return true;
    }

    @PostMapping(path = "/export", consumes = MediaType.APPLICATION_JSON_VALUE, produces = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    public ResponseEntity<StreamingResponseBody> exportToExcel(@RequestBody(required = false) List<String> ids) {
        // Accept a JSON array of id strings. If null or empty, produce an empty sheet with headers.
        List<String> incoming = ids == null ? new ArrayList<>() : new ArrayList<>(ids);

        // Trim and keep only valid UUID strings
        List<UUID> uuidList = new ArrayList<>();
        if (incoming != null) {
            for (String s : incoming) {
                if (s == null) {
					continue;
				}
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