package com.ams.bomcore.service.model;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.repository.ModelBomRepository;
import com.ams.bomcore.repository.ModelRepository;

/**
 * Simple single-responsibility service for Model CRUD. Now deletes related ModelBom rows when deleting a Model.
 */
@Service
public class ModelService {

    private final ModelRepository modelRepository;
    private final ModelBomRepository modelBomRepository;

    public ModelService(ModelRepository modelRepository, ModelBomRepository modelBomRepository) {
        this.modelRepository = modelRepository;
        this.modelBomRepository = modelBomRepository;
    }

    public Model create(Model model) {
        return modelRepository.save(model);
    }

    public List<Model> findAll() {
        return modelRepository.findAll();
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id) {
        // find model by id and delete its BOM entries first to avoid orphan rows
        modelRepository.findById(id).ifPresent(m -> {
            try {
                modelBomRepository.deleteAllByModel(m);
            } catch (Exception ex) {
                // if delete fails, let transaction rollback and surface error
                throw ex;
            }
            modelRepository.deleteById(id);
        });
    }
}