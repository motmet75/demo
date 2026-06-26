package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ShopVoucher;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ShopVoucherRepository extends JpaRepository<ShopVoucher, UUID> {
    List<ShopVoucher> findAllByTenantIdAndCompanyIdOrderByCreatedAtDesc(UUID tenantId, UUID companyId);
    List<ShopVoucher> findAllByCustomerIdAndTenantIdAndCompanyIdOrderByCreatedAtDesc(UUID customerId, UUID tenantId, UUID companyId);
    Optional<ShopVoucher> findByTenantIdAndCompanyIdAndCode(UUID tenantId, UUID companyId, String code);
    boolean existsByTenantIdAndCompanyIdAndCode(UUID tenantId, UUID companyId, String code);
}
