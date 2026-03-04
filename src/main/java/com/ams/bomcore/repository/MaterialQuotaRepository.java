package com.ams.bomcore.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.inventory.MaterialQuotaEntity;
import com.ams.bomcore.domain.material.Material;

@Repository
public interface MaterialQuotaRepository extends JpaRepository<MaterialQuotaEntity, UUID> {

    List<MaterialQuotaEntity> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    Optional<MaterialQuotaEntity> findByMaterialAndTenantIdAndCompanyIdAndQuotaPeriod(Material material, UUID tenantId, UUID companyId, LocalDate quotaPeriod);

    @Query("SELECT q FROM MaterialQuotaEntity q WHERE q.tenantId = :tenantId AND q.companyId = :companyId AND q.material.id = :materialId")
    List<MaterialQuotaEntity> findByTenantIdAndCompanyIdAndMaterialId(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("materialId") UUID materialId);

    @Query("SELECT q FROM MaterialQuotaEntity q WHERE q.tenantId = :tenantId AND q.companyId = :companyId AND q.quotaPeriod = :quotaPeriod")
    List<MaterialQuotaEntity> findByTenantIdAndCompanyIdAndQuotaPeriod(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("quotaPeriod") LocalDate quotaPeriod);
}
