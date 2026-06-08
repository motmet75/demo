package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopOrder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopOrderRepository extends JpaRepository<ShopOrder, UUID> {
    List<ShopOrder> findAllByTenantIdAndCompanyIdOrderByCreatedAtDesc(UUID tenantId, UUID companyId);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndStatusOrderByCreatedAtDesc(UUID tenantId, UUID companyId, String status);
    Optional<ShopOrder> findByOrderCodeAndTenantIdAndCompanyId(String orderCode, UUID tenantId, UUID companyId);
    Optional<ShopOrder> findByOrderCode(String orderCode);
}
