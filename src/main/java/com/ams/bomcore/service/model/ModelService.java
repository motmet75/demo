package com.ams.bomcore.service.model;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.repository.ModelRepository;

/**
 * Simple single-responsibility service for Model CRUD. No BOM logic here.
 */
@Service
public class ModelService {

    private final ModelRepository modelRepository;

    public ModelService(ModelRepository modelRepository) {
        this.modelRepository = modelRepository;
    }

    public Model create(Model model) {
        return modelRepository.save(model);
    }

    public List<Model> findAll() {
        return modelRepository.findAll();
    }

    public void delete(UUID id) {
        modelRepository.deleteById(id);
    }
}
