package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ShopOrderItemRepository extends JpaRepository<ShopOrderItem, UUID> {
    List<ShopOrderItem> findAllByOrder_Id(UUID orderId);

    @Query("SELECT i FROM ShopOrderItem i JOIN FETCH i.order o LEFT JOIN FETCH i.model WHERE o.id IN :orderIds")
    List<ShopOrderItem> findAllByOrderIds(@Param("orderIds") List<UUID> orderIds);
}
