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
    public Material updateForCompany(Material material, Company company, Tenant tenant) {
        material.setCompany(company);
        material.setTenant(tenant);
        return materialRepository.save(material);
    }

    public List<Material> findAllByCompany(Company company) {
        return materialRepository.findAllByCompany(company);
    }

    public void delete(UUID id) {
        materialRepository.deleteById(id);
    }
}