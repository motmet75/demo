package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.supplier.Supplier;

/**
 * Spring Data JPA repository for Supplier entities.
 */
@Repository
public interface SupplierRepository extends JpaRepository<Supplier, UUID> {

    Optional<Supplier> findBySupplierCode(String supplierCode);

    boolean existsBySupplierCode(String supplierCode);

    // Tenant-scoped queries (tenantId stored as UUID)
    List<Supplier> findAllByTenantId(UUID tenantId);

    Optional<Supplier> findBySupplierCodeAndTenantId(String supplierCode, UUID tenantId);

    boolean existsBySupplierCodeAndTenantId(String supplierCode, UUID tenantId);

    // Company-scoped queries
    List<Supplier> findAllByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    Optional<Supplier> findBySupplierCodeAndTenantIdAndCompanyId(String supplierCode, UUID tenantId, UUID companyId);

    boolean existsBySupplierCodeAndTenantIdAndCompanyId(String supplierCode, UUID tenantId, UUID companyId);

}