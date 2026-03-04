package com.ams.bomcore.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.inventory.InventoryHistoryEntity;

@Repository
public interface InventoryHistoryRepository extends JpaRepository<InventoryHistoryEntity, UUID> {

    List<InventoryHistoryEntity> findByTenantIdAndCompanyId(UUID tenantId, UUID companyId);

    List<InventoryHistoryEntity> findByTenantIdAndCompanyIdAndSnapshotDate(UUID tenantId, UUID companyId, LocalDate snapshotDate);

    @Query("SELECT h FROM InventoryHistoryEntity h WHERE h.tenantId = :tenantId AND h.companyId = :companyId AND h.material.id = :materialId")
    List<InventoryHistoryEntity> findByTenantIdAndCompanyIdAndMaterialId(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("materialId") UUID materialId);

    @Query("SELECT h FROM InventoryHistoryEntity h WHERE h.tenantId = :tenantId AND h.companyId = :companyId AND h.warehouse.id = :warehouseId")
    List<InventoryHistoryEntity> findByTenantIdAndCompanyIdAndWarehouseId(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("warehouseId") UUID warehouseId);

    @Query("SELECT h FROM InventoryHistoryEntity h WHERE h.tenantId = :tenantId AND h.companyId = :companyId AND h.snapshotDate >= :fromDate AND h.snapshotDate <= :toDate")
    List<InventoryHistoryEntity> findByTenantIdAndCompanyIdAndDateRange(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId, @Param("fromDate") LocalDate fromDate, @Param("toDate") LocalDate toDate);
}
