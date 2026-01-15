package com.ams.bomcore.service.modelbom;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ams.bomcore.domain.modelbom.ModelBom;
import com.ams.bomcore.repository.ModelBomRepository;

@Service
public class ModelBomService {

    private final ModelBomRepository modelBomRepository;

    public ModelBomService(ModelBomRepository modelBomRepository) {
        this.modelBomRepository = modelBomRepository;
    }

    public ModelBom create(ModelBom modelBom) {
        return modelBomRepository.save(modelBom);
    }

    public List<ModelBom> findAll() {
        return modelBomRepository.findAll();
    }

    public void delete(UUID id) {
        modelBomRepository.deleteById(id);
    }
}
