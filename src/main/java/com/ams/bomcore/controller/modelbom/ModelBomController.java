package com.ams.bomcore.controller.modelbom;

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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.modelbom.ModelBom;
import com.ams.bomcore.repository.ModelBomRepository;
import com.ams.bomcore.service.modelbom.ModelBomService;

import jakarta.validation.Valid;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/model-boms")
public class ModelBomController {

    private final ModelBomService modelBomService;
    private final ModelBomRepository modelBomRepository;

    public ModelBomController(ModelBomService modelBomService, ModelBomRepository modelBomRepository) {
        this.modelBomService = modelBomService;
        this.modelBomRepository = modelBomRepository;
    }

    @GetMapping
    public List<ModelBom> list() {
        return modelBomService.findAll();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ModelBom> create(@Valid @RequestBody ModelBom modelBom) {
        ModelBom saved = modelBomService.create(modelBom);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<ModelBom> update(@PathVariable("id") UUID id, @Valid @RequestBody ModelBom modelBom) {
        modelBom.setId(id);
        if (!modelBomRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        ModelBom saved = modelBomRepository.save(modelBom);
        return ResponseEntity.ok(saved);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable("id") UUID id) {
        if (!modelBomRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        modelBomService.delete(id);
        return ResponseEntity.noContent().build();
    }
}