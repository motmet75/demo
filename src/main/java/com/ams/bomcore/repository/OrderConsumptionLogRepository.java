package com.ams.bomcore.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.inventory.OrderConsumptionLogEntity;

@Repository
public interface OrderConsumptionLogRepository extends JpaRepository<OrderConsumptionLogEntity, UUID> {

    List<OrderConsumptionLogEntity> findByOrderId(UUID orderId);

    List<OrderConsumptionLogEntity> findByBomCalculationId(UUID bomCalculationId);

    List<OrderConsumptionLogEntity> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    @Query("SELECT l FROM OrderConsumptionLogEntity l WHERE l.tenantId = :tenantId AND l.companyId = :companyId AND l.material.id = :materialId")
    List<OrderConsumptionLogEntity> findByTenantIdAndCompanyIdAndMaterialId(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("materialId") UUID materialId);

    List<OrderConsumptionLogEntity> findByTenantIdAndCompanyIdAndStatus(UUID tenantId, UUID companyId, String status);
}
