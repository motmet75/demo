package com.ams.bomcore.controller.model;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.controller.modelbom.ModelBomCsvParser;
import com.ams.bomcore.controller.modelbom.ModelBomCsvParser.ParseResult;
import com.ams.bomcore.controller.modelbom.dto.ModelBomCsvRow;
import com.ams.bomcore.service.modelbom.ModelBomService;
import com.ams.bomcore.service.modelbom.ModelBomService.ImportResult;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.domain.tenant.Tenant;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/models")
public class ModelImportBomController {

    private final ModelBomService modelBomService;
    private final TenantRepository tenantRepository;

    public ModelImportBomController(ModelBomService modelBomService, TenantRepository tenantRepository) {
        this.modelBomService = modelBomService;
        this.tenantRepository = tenantRepository;
    }

    private java.util.UUID resolveTenant(java.util.UUID tenantId, String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { return java.util.UUID.fromString(headerTenantId); } catch (Exception e) { }
        }
        return tenantId;
    }

    /**
     * Import Model BOMs from CSV.
     * Endpoint: POST /bom/api/models/import-bom
     * Accepts multipart/form-data with `file` field.
     */
    @PostMapping(path = "/import-bom", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResponse> importBom(@RequestParam("file") MultipartFile file,
                                                    @RequestParam(value = "tenantId", required = false) java.util.UUID tenantId,
                                                    @RequestParam(value = "companyId", required = false) java.util.UUID companyId,
                                                    @RequestParam(value = "bomId", required = false) java.util.UUID bomId,
                                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        // resolve tenant from header or param
        tenantId = resolveTenant(tenantId, headerTenantId);

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        if (!filename.toLowerCase().endsWith(".csv")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(ImportResponse.error("Only CSV files are supported currently"));
        }

        // Parse CSV into DTOs
        ParseResult parse = ModelBomCsvParser.parse(file);
        if (parse.hasErrors()) {
            // return bad request with parser errors; controller contains no business logic
            ImportResponse resp = new ImportResponse();
            resp.success = false;
            resp.message = "Parsing failed";
            resp.errors.addAll(parse.getErrors());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resp);
        }

        List<ModelBomCsvRow> rows = parse.getRows();

        // Determine tenantId/companyId: prefer explicit request params; otherwise infer from CSV rows if all rows agree
        java.util.UUID inferredTenant = null;
        java.util.UUID inferredCompany = null;
        for (ModelBomCsvRow r : rows) {
            if (r.getTenantId() != null) {
                if (inferredTenant == null) inferredTenant = r.getTenantId();
                else if (!inferredTenant.equals(r.getTenantId())) {
                    ImportResponse resp = new ImportResponse();
                    resp.success = false;
                    resp.message = "Inconsistent tenantId values across CSV rows";
                    resp.errors.add("Different tenantId values found in CSV");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resp);
                }
            }
            if (r.getCompanyId() != null) {
                if (inferredCompany == null) inferredCompany = r.getCompanyId();
                else if (!inferredCompany.equals(r.getCompanyId())) {
                    ImportResponse resp = new ImportResponse();
                    resp.success = false;
                    resp.message = "Inconsistent companyId values across CSV rows";
                    resp.errors.add("Different companyId values found in CSV");
                    return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resp);
                }
            }
        }

        // If request param tenantId missing, try to use inferredTenant
        if (tenantId == null && inferredTenant != null) {
            tenantId = inferredTenant;
        }

        // Validate tenantId presence now
        if (tenantId == null) {
            ImportResponse resp = ImportResponse.error("tenantId is required either as request param, X-Tenant-Id header, or CSV column");
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resp);
        }

        // If request param companyId missing, try to use inferredCompany
        if (companyId == null && inferredCompany != null) {
            companyId = inferredCompany;
        }

        // verify tenant exists
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));

        try {
            ImportResult svcResult;
            if (bomId != null) {
                // import into existing model (bomId is the model id)
                svcResult = modelBomService.importIntoModel(rows, tenant.getId(), companyId, bomId);
            } else {
                svcResult = modelBomService.importFromParsedRows(rows, tenant.getId(), companyId);
            }

            if (svcResult.hasErrors()) {
                // service-level validation failed (e.g., missing materials) -> report as bad request
                ImportResponse resp = new ImportResponse();
                resp.success = false;
                resp.message = "Import failed";
                resp.errors.addAll(svcResult.getErrors());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resp);
            }

            ImportResponse resp = new ImportResponse();
            resp.success = true;
            resp.message = "Imported";
            resp.modelsAffected = svcResult.getModelsCreated();
            resp.bomLinesImported = svcResult.getModelBomsCreated() + svcResult.getModelBomsUpdated();
            return ResponseEntity.ok(resp);
        } catch (Exception ex) {
            ImportResponse resp = ImportResponse.error("Failed to import: " + (ex.getMessage() == null ? ex.toString() : ex.getMessage()));
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(resp);
        }
    }

    public static class ImportResponse {
        public boolean success;
        public String message;
        public int modelsAffected;
        public int bomLinesImported;
        public final java.util.List<String> errors = new java.util.ArrayList<>();

        public static ImportResponse success(int modelsAffected, int bomLinesImported) {
            ImportResponse r = new ImportResponse();
            r.success = true;
            r.message = "Imported";
            r.modelsAffected = modelsAffected;
            r.bomLinesImported = bomLinesImported;
            return r;
        }

        public static ImportResponse error(String message) {
            ImportResponse r = new ImportResponse();
            r.success = false;
            r.message = message;
            return r;
        }
    }
}
