package com.ams.bomcore.repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.controller.inventory.dto.InventoryViewDTO;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.material.Material;

/**
 * Spring Data JPA repository for InventoryEntity.
 */
@Repository
public interface InventoryRepository extends JpaRepository<InventoryEntity, UUID> {

    /**
     * OPTIMIZED FOR BATCH IMPORT:
     * Fetches all inventory records for a specific tenant and company.
     * Uses JOIN FETCH on material and warehouse to avoid N+1 lazy loading 
     * during the in-memory map construction in the Import Service.
     */
    @Query("SELECT i FROM InventoryEntity i " +
           "JOIN FETCH i.material m " +
           "JOIN FETCH i.warehouse w " +
           "WHERE i.tenantId = :tenantId AND i.companyId = :companyId")
    List<InventoryEntity> findAllByTenantIdAndCompanyId(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);

    @Query("SELECT COALESCE(SUM(i.quantityOnHand - COALESCE(i.quantityLocked, 0)), 0) FROM InventoryEntity i WHERE i.material.id = :materialId")
    BigDecimal sumAvailableByMaterialId(@Param("materialId") UUID materialId);

    // Find all inventory entries for a given material
    List<InventoryEntity> findByMaterial(Material material);

    // Find all inventory entries for a given warehouse code
    @Query("SELECT i FROM InventoryEntity i WHERE i.warehouse.code = :warehouseCode")
    List<InventoryEntity> findByWarehouseCode(@Param("warehouseCode") String warehouseCode);

    // Find the inventory entry for a material in a specific warehouse identified by code
    @Query("SELECT i FROM InventoryEntity i WHERE i.material = :material AND i.warehouse.code = :warehouseCode")
    Optional<InventoryEntity> findByMaterialAndWarehouseCode(@Param("material") Material material, @Param("warehouseCode") String warehouseCode);

    // Find inventory by material + warehouse code + batchNo
    @Query("SELECT i FROM InventoryEntity i WHERE i.material = :material AND i.warehouse.code = :warehouseCode AND i.batchNo = :batchNo")
    Optional<InventoryEntity> findByMaterialAndWarehouseCodeAndBatchNo(@Param("material") Material material, @Param("warehouseCode") String warehouseCode, @Param("batchNo") String batchNo);

    // Find inventory by scoped business key
    @Query("SELECT i FROM InventoryEntity i WHERE i.material = :material AND i.warehouse.code = :warehouseCode AND i.batchNo = :batchNo AND i.tenantId = :tenantId AND i.companyId = :companyId")
    Optional<InventoryEntity> findByMaterialAndWarehouseCodeAndBatchNoAndTenantIdAndCompanyId(
            @Param("material") Material material, 
            @Param("warehouseCode") String warehouseCode, 
            @Param("batchNo") String batchNo, 
            @Param("tenantId") UUID tenantId, 
            @Param("companyId") UUID companyId);

    // Projection for grid display
    @Query("SELECT new com.ams.bomcore.controller.inventory.dto.InventoryViewDTO("
            + "i.id, i.tenantId, i.companyId, m.id, m.materialCode, m.materialName, w.id, w.code, w.name, "
            + "i.quantityOnHand, i.quantityTotal, i.quantityReserved, i.quantityLocked, i.batchNo, i.contractCode, i.orderToDeduction, i.unit, i.unitPrice, i.currency, "
            + "i.expirationDateTime, i.productionDateTime, i.createdAt, i.updatedAt, i.visible, i.approved, i.locked, i.materialQuotaPercentage) "
            + "FROM InventoryEntity i "
            + "JOIN i.material m "
            + "JOIN i.warehouse w "
            + "WHERE i.tenantId = :tenantId AND i.companyId = :companyId")
    List<InventoryViewDTO> findAllInventoryView(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);

    @Modifying
    @Query("UPDATE InventoryEntity i SET i.orderToDeduction = :tag, i.updatedAt = :now WHERE i.id = :id")
    void updateOrderToDeduction(@Param("id") UUID id, @Param("tag") String tag, @Param("now") Instant now);

    @Modifying
    @Query("UPDATE InventoryEntity i SET i.orderToDeduction = NULL, i.updatedAt = :now WHERE i.id = :id")
    void clearOrderToDeduction(@Param("id") UUID id, @Param("now") Instant now);

    /**
     * Clear order_to_deduction for all rows of a tenant/company — restored from original.
     */
    @Modifying
    @Query("UPDATE InventoryEntity i SET i.orderToDeduction = NULL, i.updatedAt = :now WHERE i.tenantId = :tenantId AND i.companyId = :companyId AND i.orderToDeduction IS NOT NULL")
    void clearAllOrderToDeduction(@Param("tenantId") UUID tenantId,
                                  @Param("companyId") UUID companyId,
                                  @Param("now") Instant now);

    @Modifying
    @Query("UPDATE InventoryEntity i SET i.quantityOnHand = :qty, i.updatedAt = :now WHERE i.id = :id")
    void updateQuantityOnHand(@Param("id") UUID id, @Param("qty") BigDecimal qty, @Param("now") Instant now);

    @Modifying
    @Query("UPDATE InventoryEntity i SET i.quantityLocked = :qty, i.updatedAt = :now WHERE i.id = :id")
    void updateQuantityLocked(@Param("id") UUID id, @Param("qty") BigDecimal qty, @Param("now") Instant now);

    @Modifying
    @Query("UPDATE InventoryEntity i SET i.quantityReserved = :qty, i.updatedAt = :now WHERE i.id = :id")
    void updateQuantityReserved(@Param("id") UUID id, @Param("qty") BigDecimal qty, @Param("now") Instant now);
}