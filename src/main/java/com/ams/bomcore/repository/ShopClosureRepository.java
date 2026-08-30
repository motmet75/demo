package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopClosure;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ShopClosureRepository extends JpaRepository<ShopClosure, UUID> {
    Optional<ShopClosure> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);
}
