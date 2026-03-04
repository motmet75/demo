package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.order.ProductionRun;

@Repository
public interface ProductionRunRepository extends JpaRepository<ProductionRun, UUID> {

    List<ProductionRun> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    List<ProductionRun> findByOrderIdAndTenantIdAndCompanyId(UUID orderId, UUID tenantId, UUID companyId);

    Optional<ProductionRun> findByProductionBatchId(UUID productionBatchId);

    Optional<ProductionRun> findByOrderLineId(UUID orderLineId);

    @Query("SELECT r FROM ProductionRun r WHERE r.tenantId = :tenantId AND r.companyId = :companyId AND r.status = :status")
    List<ProductionRun> findByTenantIdAndCompanyIdAndStatus(
            @Param("tenantId") UUID tenantId,
            @Param("companyId") UUID companyId,
            @Param("status") String status);

    @Query("SELECT r FROM ProductionRun r WHERE r.orderId = :orderId AND r.status NOT IN ('COMPLETED', 'CANCELLED')")
    List<ProductionRun> findActiveRunsByOrderId(@Param("orderId") UUID orderId);
}
