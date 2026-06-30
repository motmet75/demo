package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopBill;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface ShopBillRepository extends JpaRepository<ShopBill, UUID> {
    List<ShopBill> findAllByOrder_IdOrderByCreatedAtAsc(UUID orderId);
    List<ShopBill> findAllByOrder_IdAndStatusOrderByCreatedAtAsc(UUID orderId, String status);
    List<ShopBill> findAllByMergedIntoBill_IdAndStatus(UUID mergedIntoBillId, String status);
    List<ShopBill> findAllByMergedIntoBill_IdInAndStatus(Collection<UUID> mergedIntoBillIds, String status);
    List<ShopBill> findAllByMergeBatchIdAndStatus(UUID mergeBatchId, String status);
    long countByOrder_Id(UUID orderId);
    void deleteAllByOrder_Id(UUID orderId);
}