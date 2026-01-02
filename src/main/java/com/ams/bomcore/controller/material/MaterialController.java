package com.ams.bomcore.controller.material;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import jakarta.validation.Valid;

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
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.service.material.MaterialService;

/*
 * Controller for Material CRUD and import endpoint.
 * - GET /api/materials
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

    public MaterialController(MaterialService materialService, MaterialRepository materialRepository) {
        this.materialService = materialService;
        this.materialRepository = materialRepository;
    }

    @GetMapping
    public List<Material> list() {
        return materialService.findAll();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Material> create(@Valid @RequestBody Material material) {
        Material saved = materialService.create(material);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Material> update(@PathVariable("id") UUID id, @Valid @RequestBody Material material) {
        // ensure id is set and exists
        material.setId(id);
        if (!materialRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        Material saved = materialRepository.save(material);
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
    public ResponseEntity<ImportResult> importCsv(@RequestParam("file") MultipartFile file) {
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
                // skip duplicates in DB by code
                if (materialRepository.findByMaterialCode(code).isPresent()) {
                    errors.add("Row " + row + ": material_code already exists: " + code);
                    continue;
                }
                Material m = new Material();
                m.setMaterialCode(code);
                m.setMaterialName(name);
                m.setUnit(unit);
                m.setMaterialType(type);
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