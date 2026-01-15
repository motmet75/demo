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
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.repository.ModelRepository;
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

    public ModelController(ModelService modelService, ModelRepository modelRepository) {
        this.modelService = modelService;
        this.modelRepository = modelRepository;
    }

    @GetMapping
    public List<Model> list() {
        return modelService.findAll();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Model> create(@Valid @RequestBody Model model) {
        Model saved = modelService.create(model);
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Model> update(@PathVariable("id") UUID id, @Valid @RequestBody Model model) {
        model.setId(id);
        if (!modelRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }
        Model saved = modelRepository.save(model);
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