package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.inventory.WarehouseEntity;

@Repository
public interface WarehouseRepository extends JpaRepository<WarehouseEntity, UUID> {

    Optional<WarehouseEntity> findByCode(String code);

    boolean existsByCode(String code);

    // Tenant-scoped queries
    List<WarehouseEntity> findAllByTenantId(UUID tenantId);

    // Tenant + company scoped query
    List<WarehouseEntity> findAllByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    Optional<WarehouseEntity> findByCodeAndTenantId(String code, UUID tenantId);

    boolean existsByCodeAndTenantId(String code, UUID tenantId);

}