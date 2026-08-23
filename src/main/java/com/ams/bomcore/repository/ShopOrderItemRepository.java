package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface ShopOrderItemRepository extends JpaRepository<ShopOrderItem, UUID> {
    List<ShopOrderItem> findAllByOrder_Id(UUID orderId);

    @Query("SELECT i FROM ShopOrderItem i JOIN FETCH i.order o LEFT JOIN FETCH i.model WHERE o.id IN :orderIds")
    List<ShopOrderItem> findAllByOrderIds(@Param("orderIds") List<UUID> orderIds);

    @Query("""
            SELECT COALESCE(SUM(i.quantity), 0)
            FROM ShopOrderItem i
            JOIN i.order o
            WHERE i.model.id = :modelId
              AND o.tenantId = :tenantId
              AND o.companyId = :companyId
              AND o.status <> 'CANCELLED'
              AND o.createdAt >= :fromTime
              AND o.createdAt < :toTime
              AND (:excludeOrderId IS NULL OR o.id <> :excludeOrderId)
            """)
    BigDecimal sumSoldQuantityForModelInDay(@Param("modelId") UUID modelId,
                                            @Param("tenantId") UUID tenantId,
                                            @Param("companyId") UUID companyId,
                                            @Param("fromTime") Instant fromTime,
                                            @Param("toTime") Instant toTime,
                                            @Param("excludeOrderId") UUID excludeOrderId);
}
