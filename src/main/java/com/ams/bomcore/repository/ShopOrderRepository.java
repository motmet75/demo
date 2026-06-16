package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopOrderRepository extends JpaRepository<ShopOrder, UUID> {
    List<ShopOrder> findAllByTenantIdAndCompanyIdOrderByCreatedAtDesc(UUID tenantId, UUID companyId);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndStatusOrderByCreatedAtDesc(UUID tenantId, UUID companyId, String status);
    Optional<ShopOrder> findByOrderCodeAndTenantIdAndCompanyId(String orderCode, UUID tenantId, UUID companyId);
    Optional<ShopOrder> findByOrderCode(String orderCode);
    List<ShopOrder> findAllBySourceTokenOrderByCreatedAtDesc(String sourceToken);
    List<ShopOrder> findAllByTenantIdAndCompanyIdAndStatusInOrderByOrderNumberAsc(UUID tenantId, UUID companyId, List<String> statuses);
    List<ShopOrder> findAllByTable_IdAndTenantIdAndCompanyIdAndStatusIn(UUID tableId, UUID tenantId, UUID companyId, List<String> statuses);
    Optional<ShopOrder> findTopByTenantIdAndCompanyIdAndPickupScannedAtAfterOrderByPickupScannedAtDesc(UUID tenantId, UUID companyId, Instant after);

    @Query("SELECT COUNT(o) FROM ShopOrder o WHERE o.companyId = :companyId AND o.createdAt >= :start AND o.createdAt < :end")
    long countOrdersInDay(@Param("companyId") UUID companyId, @Param("start") Instant start, @Param("end") Instant end);
}
