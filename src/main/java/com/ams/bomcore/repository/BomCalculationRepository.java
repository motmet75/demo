package com.ams.bomcore.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.bom.BomCalculationEntity;

@Repository
public interface BomCalculationRepository extends JpaRepository<BomCalculationEntity, UUID> {

    List<BomCalculationEntity> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    List<BomCalculationEntity> findByBom_IdAndTenantIdAndCompanyId(UUID bomId, UUID tenantId, UUID companyId);

    @Query("SELECT c FROM BomCalculationEntity c WHERE c.bom.id = :bomId AND c.tenantId = :tenantId AND c.companyId = :companyId AND c.status = :status")
    List<BomCalculationEntity> findByBomIdAndTenantIdAndCompanyIdAndStatus(@Param("bomId") UUID bomId, @Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("status") String status);
}
