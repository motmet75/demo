package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopShift;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopShiftRepository extends JpaRepository<ShopShift, UUID> {
    List<ShopShift> findAllByTenantIdAndCompanyIdOrderByDayOfWeekAscStartTimeAsc(UUID tenantId, UUID companyId);
    List<ShopShift> findAllByTenantIdAndCompanyIdAndIsActiveTrueOrderByDayOfWeekAscStartTimeAsc(UUID tenantId, UUID companyId);
    void deleteAllByTenantIdAndCompanyId(UUID tenantId, UUID companyId);
}
