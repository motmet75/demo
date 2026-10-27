package com.ams.bomcore.repository;
import java.util.*;
import org.springframework.data.jpa.repository.JpaRepository;
import com.ams.bomcore.domain.service.ServiceBom;
public interface ServiceBomRepository extends JpaRepository<ServiceBom, UUID> {
    List<ServiceBom> findAllByTenantIdAndCompanyIdOrderByServiceCode(UUID tenantId, UUID companyId);
    Optional<ServiceBom> findByIdAndTenantIdAndCompanyId(UUID id, UUID tenantId, UUID companyId);
}
