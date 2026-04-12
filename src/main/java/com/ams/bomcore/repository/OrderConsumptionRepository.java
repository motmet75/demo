package com.ams.bomcore.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.controller.order.dto.OrderConsumptionDto;
import com.ams.bomcore.domain.order.OrderConsumption;

@Repository
public interface OrderConsumptionRepository extends JpaRepository<OrderConsumption, UUID> {

    List<OrderConsumption> findByOrderId(UUID orderId);

    @Query("SELECT c FROM OrderConsumption c WHERE c.orderId IN :orderIds AND c.tenantId = :tenantId AND c.companyId = :companyId")
    List<OrderConsumption> findByOrderIds(@Param("orderIds") List<UUID> orderIds,
                                          @Param("tenantId") UUID tenantId,
                                          @Param("companyId") UUID companyId);

    @Query("""
        SELECT new com.ams.bomcore.controller.order.dto.OrderConsumptionDto(
            c.id, c.orderId,
            oh.orderNumber, oh.status, oh.deliveryDateTime,
            c.material.id, c.material.materialCode, c.material.materialName,
            c.plannedQty, c.adjustedQty, c.availableQty,
            c.checkResult, c.tenantId, c.companyId, c.createdAt,
            c.updatedBy,
            ocl.deductedInventoryId
        )
        FROM OrderConsumption c
        JOIN OrderHeader oh ON oh.id = c.orderId
        LEFT JOIN OrderConsumptionLogEntity ocl
            ON ocl.orderId = c.orderId
            AND ocl.material.id = c.material.id
            AND ocl.deductedInventoryId IS NOT NULL
        WHERE c.tenantId = :tenantId AND c.companyId = :companyId
        ORDER BY c.createdAt DESC
        """)
    List<OrderConsumptionDto> findDtoByTenantIdAndCompanyId(@Param("tenantId") UUID tenantId,
                                                             @Param("companyId") UUID companyId);

    @Modifying
    @Query("DELETE FROM OrderConsumption c WHERE c.orderId = :orderId")
    void deleteByOrderId(@Param("orderId") UUID orderId);

    @Modifying
    @Query("DELETE FROM OrderConsumption c WHERE c.orderId IN :orderIds")
    void deleteByOrderIds(@Param("orderIds") List<UUID> orderIds);
}
