package com.ams.bomcore.controller.model;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.controller.modelbom.ModelBomExcelParser; // Use the Excel Parser
import com.ams.bomcore.controller.modelbom.dto.ModelBomCsvRow;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.modelbom.ModelBomService;
import com.ams.bomcore.service.modelbom.ModelBomService.ImportResult;

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

    private UUID resolveTenant(UUID tenantId, String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { return UUID.fromString(headerTenantId); } catch (Exception e) { }
        }
        return tenantId;
    }

    /**
     * Import Model BOMs from XLSX (Excel).
     * Now strictly enforces .xlsx and uses ModelBomExcelParser.
     */
    @PostMapping(path = "/import-bom", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResponse> importBom(@RequestParam("file") MultipartFile file,
                                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                                    @RequestParam(value = "bomId", required = false) UUID bomId,
                                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        
        tenantId = resolveTenant(tenantId, headerTenantId);

        String filename = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
        
        // --- CHANGED: Strict XLSX validation ---
        if (!filename.toLowerCase().endsWith(".xlsx")) {
            return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                                 .body(ImportResponse.error("Only XLSX Excel files are supported currently"));
        }

        // --- CHANGED: Use Excel Parser instead of CSV Parser ---
        ModelBomExcelParser.ParseResult parse = ModelBomExcelParser.parse(file);
        if (parse.hasErrors()) {
            ImportResponse resp = new ImportResponse();
            resp.success = false;
            resp.message = "Parsing failed";
            resp.errors.addAll(parse.getErrors());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resp);
        }

        List<ModelBomCsvRow> rows = parse.getRows();

        if (tenantId == null) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ImportResponse.error("tenantId is required"));
        }

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("tenant not found"));

        try {
            ImportResult svcResult;
            if (bomId != null) {
                svcResult = modelBomService.importIntoModel(rows, tenant.getId(), companyId, bomId);
            } else {
                svcResult = modelBomService.importFromParsedRows(rows, tenant.getId(), companyId);
            }

            if (svcResult.hasErrors()) {
                ImportResponse resp = new ImportResponse();
                resp.success = false;
                resp.message = "Import failed";
                resp.errors.addAll(svcResult.getErrors());
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(resp);
            }

            return ResponseEntity.ok(ImportResponse.success(svcResult.getModelsCreated(), 
                    svcResult.getModelBomsCreated() + svcResult.getModelBomsUpdated()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(ImportResponse.error("Failed to import: " + ex.getMessage()));
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