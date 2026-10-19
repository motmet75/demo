package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.VinHoadonShopInvoiceOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VinHoadonShopInvoiceOrderRepository extends JpaRepository<VinHoadonShopInvoiceOrder, UUID> {
    Optional<VinHoadonShopInvoiceOrder> findByOrder_Id(UUID orderId);
    List<VinHoadonShopInvoiceOrder> findAllByOrder_IdIn(Collection<UUID> orderIds);
    List<VinHoadonShopInvoiceOrder> findAllByInvoice_Id(UUID invoiceId);
}
