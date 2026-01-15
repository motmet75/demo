package com.ams.bomcore.controller.model;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.controller.modelbom.ModelBomCsvParser;
import com.ams.bomcore.controller.modelbom.ModelBomCsvParser.ParseResult;
import com.ams.bomcore.controller.modelbom.dto.ModelBomCsvRow;
import com.ams.bomcore.service.modelbom.ModelBomService;
import com.ams.bomcore.service.modelbom.ModelBomService.ImportResult;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/models")
public class ModelImportBomController {

    private final ModelBomService modelBomService;

    public ModelImportBomController(ModelBomService modelBomService) {
        this.modelBomService = modelBomService;
    }

    /**
     * Import Model BOMs from CSV.
     * Endpoint: POST /bom/api/models/import-bom
     * Accepts multipart/form-data with `file` field.
     */
    @PostMapping(path = "/import-bom", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<ImportResponse> importBom(@RequestParam("file") MultipartFile file) {
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

        try {
            ImportResult svcResult = modelBomService.importFromParsedRows(rows);
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