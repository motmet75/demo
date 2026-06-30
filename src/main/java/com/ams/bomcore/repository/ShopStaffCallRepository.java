package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopStaffCall;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ShopStaffCallRepository extends JpaRepository<ShopStaffCall, UUID> {
    List<ShopStaffCall> findAllByTenantIdAndCompanyIdAndStatusOrderByCreatedAtDesc(UUID tenantId, UUID companyId, String status);
}