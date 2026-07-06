package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopPrintHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ShopPrintHistoryRepository extends JpaRepository<ShopPrintHistory, UUID> {
    List<ShopPrintHistory> findTop200ByTenantIdAndCompanyIdOrderByPrintedAtDesc(UUID tenantId, UUID companyId);

    long countByTenantIdAndCompanyIdAndPrintTypeAndSourceTypeAndSourceKey(
            UUID tenantId, UUID companyId, String printType, String sourceType, String sourceKey);

    @Query("select coalesce(max(p.slipNumber), 0) from ShopPrintHistory p where p.tenantId = :tenantId and p.companyId = :companyId")
    Integer maxSlipNumber(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);
}