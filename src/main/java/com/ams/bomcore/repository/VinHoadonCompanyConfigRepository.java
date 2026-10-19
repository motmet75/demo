package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.VinHoadonCompanyConfig;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface VinHoadonCompanyConfigRepository extends JpaRepository<VinHoadonCompanyConfig, UUID> {
    Optional<VinHoadonCompanyConfig> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);
}
