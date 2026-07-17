package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopMaterialAudit;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ShopMaterialAuditRepository extends JpaRepository<ShopMaterialAudit, UUID> {

    List<ShopMaterialAudit> findAllByOrderIdOrderByMaterialCodeAsc(UUID orderId);

    List<ShopMaterialAudit> findAllByTenantIdAndCompanyIdAndStatusInOrderByCreatedAtDesc(
            UUID tenantId, UUID companyId, List<String> statuses);

    List<ShopMaterialAudit> findAllByTenantIdAndCompanyIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
            UUID tenantId, UUID companyId, Instant from, Instant to);

    @Query("SELECT a FROM ShopMaterialAudit a " +
            "WHERE a.tenantId = :tenantId AND a.companyId = :companyId " +
            "AND a.orderId IN :orderIds ORDER BY a.createdAt DESC")
    List<ShopMaterialAudit> findAllByTenantCompanyAndOrderIds(@Param("tenantId") UUID tenantId,
                                                               @Param("companyId") UUID companyId,
                                                               @Param("orderIds") List<UUID> orderIds);

    @Query("SELECT a FROM ShopMaterialAudit a " +
            "WHERE a.tenantId = :tenantId AND a.companyId = :companyId " +
            "AND a.status IN :statuses " +
            "AND (:excludeOrderId IS NULL OR a.orderId <> :excludeOrderId)")
    List<ShopMaterialAudit> findOpenDemand(@Param("tenantId") UUID tenantId,
                                           @Param("companyId") UUID companyId,
                                           @Param("statuses") List<String> statuses,
                                           @Param("excludeOrderId") UUID excludeOrderId);

    @Modifying
    @Query("DELETE FROM ShopMaterialAudit a WHERE a.orderId = :orderId")
    void deleteAllByOrderId(@Param("orderId") UUID orderId);
}
