package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopTable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopTableRepository extends JpaRepository<ShopTable, UUID> {
    List<ShopTable> findAllByTenantIdAndCompanyId(UUID tenantId, UUID companyId);
    List<ShopTable> findAllByTenantIdAndCompanyIdAndIsActive(UUID tenantId, UUID companyId, Boolean isActive);
}
