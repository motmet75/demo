package com.ams.bomcore.service.material;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.MaterialRepository;

/**
 * Service for Material CRUD. Material operations are scoped to a Company.
 */
@Service
public class MaterialService {

    private final MaterialRepository materialRepository;

    public MaterialService(MaterialRepository materialRepository) {
        this.materialRepository = materialRepository;
    }

    public Material createForCompany(Material material, Company company, Tenant tenant) {
        // assign company and persist
        material.setCompany(company);
        material.setTenant(tenant);
        return materialRepository.save(material);
    }

    /**
     * Update an existing material ensuring it is scoped to the provided company and tenant.
     */
    public Material updateForCompany(UUID id, Material material, Company company, Tenant tenant) {
        Material existing = materialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("material not found"));

        if (existing.getTenant() == null || !existing.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalArgumentException("material does not belong to tenant");
        }
        if (existing.getCompany() == null || !existing.getCompany().getId().equals(company.getId())) {
            throw new IllegalArgumentException("material does not belong to company");
        }

        existing.setMaterialCode(material.getMaterialCode());
        existing.setMaterialName(material.getMaterialName());
        existing.setUnit(material.getUnit());
        existing.setMaterialType(material.getMaterialType());
        existing.setThumbnailUrl(material.getThumbnailUrl());
        existing.setPrice(material.getPrice());
        existing.setDescription(material.getDescription());
        if (material.getIsActive() != null) {
            existing.setIsActive(material.getIsActive());
        }

        return materialRepository.save(existing);
    }

    public List<Material> findAllByCompany(Company company) {
        return materialRepository.findAllByCompany(company);
    }

    public void delete(UUID id) {
        materialRepository.deleteById(id);
    }
}