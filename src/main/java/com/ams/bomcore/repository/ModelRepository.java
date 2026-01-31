package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.model.Model;

/**
 * Spring Data JPA repository for Model entities.
 */
@Repository
public interface ModelRepository extends JpaRepository<Model, UUID> {

    Optional<Model> findByModelCode(String modelCode);

    // Find all models belonging to a tenant (tenantId stored as UUID in Model)
    List<Model> findAllByTenantId(UUID tenantId);

    // Find by code within a tenant (tenantId stored as UUID)
    Optional<Model> findByModelCodeAndTenantId(String modelCode, UUID tenantId);

    // New: find all models belonging to a company (company-only scope)
    List<Model> findAllByCompanyId(UUID companyId);

    // New: find by code scoped to company only
    Optional<Model> findByModelCodeAndCompanyId(String modelCode, UUID companyId);

    // New: find all models for tenant + company
    List<Model> findAllByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    // New: find by code scoped to tenant+company
    Optional<Model> findByModelCodeAndTenantIdAndCompanyId(String modelCode, UUID tenantId, UUID companyId);

}