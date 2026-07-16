package com.ams.bomcore.repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.controller.order.dto.OrderConsumptionLogDto;
import com.ams.bomcore.domain.inventory.OrderConsumptionLogEntity;

@Repository
public interface OrderConsumptionLogRepository extends JpaRepository<OrderConsumptionLogEntity, UUID> {

    List<OrderConsumptionLogEntity> findByOrderId(UUID orderId);

    List<OrderConsumptionLogEntity> findByBomCalculationId(UUID bomCalculationId);

    List<OrderConsumptionLogEntity> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    @Query("SELECT l FROM OrderConsumptionLogEntity l JOIN FETCH l.material WHERE l.tenantId = :tenantId AND l.companyId = :companyId AND l.createdAt >= :from AND l.createdAt < :to")
    List<OrderConsumptionLogEntity> findForecastUsageRows(@Param("tenantId") UUID tenantId,
                                                           @Param("companyId") UUID companyId,
                                                           @Param("from") Instant from,
                                                           @Param("to") Instant to);

    @Query("SELECT l FROM OrderConsumptionLogEntity l WHERE l.tenantId = :tenantId AND l.companyId = :companyId AND l.material.id = :materialId")
    List<OrderConsumptionLogEntity> findByTenantIdAndCompanyIdAndMaterialId(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("materialId") UUID materialId);

    List<OrderConsumptionLogEntity> findByTenantIdAndCompanyIdAndStatus(UUID tenantId, UUID companyId, String status);

    /**
     * Returns full consumption log rows joined with order_header and material,
     * including deducted_inventory_id for traceability.
     */
    @Query("""
            SELECT new com.ams.bomcore.controller.order.dto.OrderConsumptionLogDto(
                l.id, l.orderId,
                h.orderNumber, h.status,
                l.bomCalculationId,
                l.material.id, l.material.materialCode, l.material.materialName,
                l.plannedQty, l.effectivePlannedQty,
                l.realConsumptionQty, l.varianceQty,
                l.deductedInventoryId,
                l.status,
                l.tenantId, l.companyId,
                l.createdAt, l.updatedAt)
            FROM OrderConsumptionLogEntity l
            JOIN OrderHeader h ON h.id = l.orderId
            WHERE l.tenantId = :tenantId AND l.companyId = :companyId
            ORDER BY l.createdAt DESC
            """)
    List<OrderConsumptionLogDto> findDtoByTenantIdAndCompanyId(
            @Param("tenantId") UUID tenantId,
            @Param("companyId") UUID companyId);

    @Query("""
            SELECT new com.ams.bomcore.controller.order.dto.OrderConsumptionLogDto(
                l.id, l.orderId,
                h.orderNumber, h.status,
                l.bomCalculationId,
                l.material.id, l.material.materialCode, l.material.materialName,
                l.plannedQty, l.effectivePlannedQty,
                l.realConsumptionQty, l.varianceQty,
                l.deductedInventoryId,
                l.status,
                l.tenantId, l.companyId,
                l.createdAt, l.updatedAt)
            FROM OrderConsumptionLogEntity l
            JOIN OrderHeader h ON h.id = l.orderId
            WHERE l.orderId = :orderId
            ORDER BY l.createdAt DESC
            """)
    List<OrderConsumptionLogDto> findDtoByOrderId(@Param("orderId") UUID orderId);
}
