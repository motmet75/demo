package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.model.Model;

@Repository
public interface BomRepository extends JpaRepository<BomEntity, UUID> {

    Optional<BomEntity> findByModelAndTenantIdAndStatus(Model model, String tenantId, String status);

    Optional<BomEntity> findByModelAndTenantIdAndVersion(Model model, String tenantId, Integer version);

    List<BomEntity> findAllByModelAndTenantId(Model model, String tenantId);

    List<BomEntity> findAllByTenantIdAndCompanyId(String tenantId, String companyId);

}