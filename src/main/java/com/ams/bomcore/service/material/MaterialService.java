package com.ams.bomcore.service.material;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.repository.MaterialRepository;

/**
 * Simple single-responsibility service for Material CRUD. No BOM logic here.
 */
@Service
public class MaterialService {

    private final MaterialRepository materialRepository;

    public MaterialService(MaterialRepository materialRepository) {
        this.materialRepository = materialRepository;
    }

    public Material create(Material material) {
        // validation could be added here (e.g., unique code)
        return materialRepository.save(material);
    }

    public List<Material> findAll() {
        return materialRepository.findAll();
    }

    public void delete(UUID id) {
        materialRepository.deleteById(id);
    }
}
