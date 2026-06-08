package com.ams.bomcore.repository;

import com.ams.bomcore.domain.shop.ModelMenuOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ModelMenuOptionRepository extends JpaRepository<ModelMenuOption, UUID> {
    List<ModelMenuOption> findAllByModelIdAndTenantIdAndCompanyIdOrderByDisplayOrderAsc(UUID modelId, UUID tenantId, UUID companyId);
    List<ModelMenuOption> findAllByTenantIdAndCompanyIdOrderByDisplayOrderAsc(UUID tenantId, UUID companyId);
    void deleteAllByModelId(UUID modelId);
}
