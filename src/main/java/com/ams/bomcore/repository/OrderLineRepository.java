package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.order.OrderLine;

@Repository
public interface OrderLineRepository extends JpaRepository<OrderLine, UUID> {

    List<OrderLine> findByOrder_IdOrderByLineNumberAsc(UUID orderId);

    List<OrderLine> findByOrder_IdAndTenantIdAndCompanyId(UUID orderId, UUID tenantId, UUID companyId);

    Optional<OrderLine> findByIdAndTenantIdAndCompanyId(UUID id, UUID tenantId, UUID companyId);

    // Find MODEL lines for a given order (for BOM explosion)
    @Query("SELECT l FROM OrderLine l WHERE l.order.id = :orderId AND l.lineType = 'MODEL'")
    List<OrderLine> findModelLinesByOrderId(@Param("orderId") UUID orderId);

    // Find MATERIAL lines for a given order (direct material consumption)
    @Query("SELECT l FROM OrderLine l WHERE l.order.id = :orderId AND l.lineType = 'MATERIAL'")
    List<OrderLine> findMaterialLinesByOrderId(@Param("orderId") UUID orderId);

    // Find lines by model across all orders (tenant-scoped)
    @Query("SELECT l FROM OrderLine l WHERE l.modelId = :modelId AND l.tenantId = :tenantId AND l.companyId = :companyId")
    List<OrderLine> findByModelIdAndTenantIdAndCompanyId(
            @Param("modelId") UUID modelId,
            @Param("tenantId") UUID tenantId,
            @Param("companyId") UUID companyId);

    // Count pending/in-progress lines for an order
    @Query("SELECT COUNT(l) FROM OrderLine l WHERE l.order.id = :orderId AND l.lineStatus NOT IN ('COMPLETED', 'CANCELLED')")
    long countActiveLinesByOrderId(@Param("orderId") UUID orderId);

    @Modifying
    @Query("DELETE FROM OrderLine l WHERE l.order.id = :orderId")
    void deleteByOrderId(@Param("orderId") UUID orderId);
}
