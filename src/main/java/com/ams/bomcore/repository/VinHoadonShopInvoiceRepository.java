package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.VinHoadonShopInvoice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;

public interface VinHoadonShopInvoiceRepository extends JpaRepository<VinHoadonShopInvoice, UUID> {
    Optional<VinHoadonShopInvoice> findByIdAndTenantIdAndCompanyId(UUID id, UUID tenantId, UUID companyId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    Optional<VinHoadonShopInvoice> findWithLockByIdAndTenantIdAndCompanyId(UUID id, UUID tenantId, UUID companyId);
}
