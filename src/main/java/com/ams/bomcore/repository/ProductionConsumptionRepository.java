package com.ams.bomcore.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.order.ProductionConsumption;

@Repository
public interface ProductionConsumptionRepository extends JpaRepository<ProductionConsumption, UUID> {

    List<ProductionConsumption> findByProductionRun_Id(UUID productionRunId);

    List<ProductionConsumption> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    @Query("SELECT c FROM ProductionConsumption c WHERE c.productionRun.id = :runId AND c.tenantId = :tenantId AND c.companyId = :companyId")
    List<ProductionConsumption> findByRunIdAndTenantAndCompany(
            @Param("runId") UUID runId,
            @Param("tenantId") UUID tenantId,
            @Param("companyId") UUID companyId);

    @Query("SELECT c FROM ProductionConsumption c WHERE c.material.id = :materialId AND c.tenantId = :tenantId AND c.companyId = :companyId")
    List<ProductionConsumption> findByMaterialIdAndTenantAndCompany(
            @Param("materialId") UUID materialId,
            @Param("tenantId") UUID tenantId,
            @Param("companyId") UUID companyId);

    void deleteByProductionRun_Id(UUID productionRunId);
}
