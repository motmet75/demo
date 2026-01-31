package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.company.Company;

/**
 * Spring Data JPA repository for Material entities.
 */
@Repository
public interface MaterialRepository extends JpaRepository<Material, UUID> {

    Optional<Material> findByMaterialCode(String materialCode);

    // Find all materials belonging to a company
    List<Material> findAllByCompany(Company company);

    // Find by code within a company to enforce uniqueness per company
    Optional<Material> findByMaterialCodeAndCompany(String materialCode, Company company);

    // New: find by code scoped to company id (convenience for services that only have companyId)
    Optional<Material> findByMaterialCodeAndTenantIdAndCompanyId(String materialCode, UUID tenantId, UUID companyId);

}