package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;

@Repository
public interface CompanyRepository extends JpaRepository<Company, UUID> {

    List<Company> findAllByTenant(Tenant tenant);

    long countByTenant(Tenant tenant);

    Optional<Company> findByCompanyCode(String companyCode);

    // Added: tenant-scoped lookup using tenant id for uniqueness checks
    Optional<Company> findByCompanyCodeAndTenantId(String companyCode, UUID tenantId);

}