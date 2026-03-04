package com.ams.bomcore.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;

@Repository
public interface BomItemRepository extends JpaRepository<BomItemEntity, UUID> {

    List<BomItemEntity> findByBom(BomEntity bom);

    List<BomItemEntity> findByBomAndTenantId(BomEntity bom, UUID tenantId);

    List<BomItemEntity> findByBomAndTenantIdAndCompanyId(BomEntity bom, UUID tenantId, UUID companyId);

    @Query("SELECT bi FROM BomItemEntity bi WHERE bi.bom.id = :bomId")
    List<BomItemEntity> findByBomId(@Param("bomId") UUID bomId);

    @Query("SELECT bi FROM BomItemEntity bi WHERE bi.bom.id = :bomId AND bi.tenantId = :tenantId AND bi.companyId = :companyId")
    List<BomItemEntity> findByBomIdAndTenantIdAndCompanyId(@Param("bomId") UUID bomId, @Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);

    void deleteByBom(BomEntity bom);

    @Query("DELETE FROM BomItemEntity bi WHERE bi.bom.id = :bomId")
    void deleteByBomId(@Param("bomId") UUID bomId);
}
