package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopBillItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopBillItemRepository extends JpaRepository<ShopBillItem, UUID> {
    List<ShopBillItem> findAllByBill_Id(UUID billId);
    List<ShopBillItem> findAllByBill_Order_Id(UUID orderId);
    List<ShopBillItem> findAllByOrderItem_Order_Id(UUID orderId);
    List<ShopBillItem> findAllByBill_IdAndOriginalBill_Id(UUID billId, UUID originalBillId);
    List<ShopBillItem> findAllByOriginalBill_Id(UUID originalBillId);
    Optional<ShopBillItem> findByOrderItem_Id(UUID orderItemId);
}