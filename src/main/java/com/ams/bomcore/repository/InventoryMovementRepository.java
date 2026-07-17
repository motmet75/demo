package com.ams.bomcore.repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.inventory.InventoryMovementEntity;

@Repository
public interface InventoryMovementRepository extends JpaRepository<InventoryMovementEntity, UUID> {

    List<InventoryMovementEntity> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    List<InventoryMovementEntity> findByTenantIdAndCompanyIdAndMovementType(UUID tenantId, UUID companyId, String movementType);

    @Query("SELECT m FROM InventoryMovementEntity m WHERE m.tenantId = :tenantId AND m.companyId = :companyId AND m.material.id = :materialId")
    List<InventoryMovementEntity> findByTenantIdAndCompanyIdAndMaterialId(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("materialId") UUID materialId);

    @Query("SELECT m FROM InventoryMovementEntity m WHERE m.tenantId = :tenantId AND m.companyId = :companyId AND m.createdAt >= :fromDate AND m.createdAt <= :toDate")
    List<InventoryMovementEntity> findByTenantIdAndCompanyIdAndDateRange(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("fromDate") Instant fromDate, @Param("toDate") Instant toDate);

    List<InventoryMovementEntity> findByReferenceTypeAndReferenceId(String referenceType, UUID referenceId);

    @Query("SELECT m FROM InventoryMovementEntity m JOIN FETCH m.material " +
            "WHERE m.tenantId = :tenantId AND m.companyId = :companyId " +
            "AND m.referenceType = :referenceType AND m.referenceId IN :referenceIds " +
            "ORDER BY m.createdAt DESC")
    List<InventoryMovementEntity> findAllByTenantCompanyReferenceIds(@Param("tenantId") UUID tenantId,
                                                                    @Param("companyId") UUID companyId,
                                                                    @Param("referenceType") String referenceType,
                                                                    @Param("referenceIds") List<UUID> referenceIds);

    @Query("SELECT m FROM InventoryMovementEntity m WHERE m.tenantId = :tenantId AND m.companyId = :companyId ORDER BY m.createdAt DESC")
    List<InventoryMovementEntity> findAllByTenantAndCompanyOrderByCreatedAtDesc(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);
}
