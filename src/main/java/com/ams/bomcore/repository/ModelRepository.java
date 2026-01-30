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

    // Find all models belonging to a tenant (tenantId stored as String in Model)
    List<Model> findAllByTenantId(String tenantId);

    // Find by code within a tenant (tenantId stored as String)
    Optional<Model> findByModelCodeAndTenantId(String modelCode, String tenantId);

    // New: find all models belonging to a company (company-only scope)
    List<Model> findAllByCompanyId(String companyId);

    // New: find by code scoped to company only
    Optional<Model> findByModelCodeAndCompanyId(String modelCode, String companyId);

    // New: find all models for tenant + company
    List<Model> findAllByTenantIdAndCompanyId(String tenantId, String companyId);

    // New: find by code scoped to tenant+company
    Optional<Model> findByModelCodeAndTenantIdAndCompanyId(String modelCode, String tenantId, String companyId);

}