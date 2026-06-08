package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopOrderItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopOrderItemRepository extends JpaRepository<ShopOrderItem, UUID> {
    List<ShopOrderItem> findAllByOrder_Id(UUID orderId);
}
