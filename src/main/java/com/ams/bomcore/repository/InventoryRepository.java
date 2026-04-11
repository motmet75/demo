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

@Repository
public interface InventoryRepository extends JpaRepository<InventoryEntity, UUID> {

    @Query("SELECT COALESCE(SUM(i.quantityOnHand - COALESCE(i.quantityLocked, 0)), 0) FROM InventoryEntity i WHERE i.material.id = :materialId")
    BigDecimal sumAvailableByMaterialId(@Param("materialId") UUID materialId);

    // Find all inventory entries for a given material
    List<InventoryEntity> findByMaterial(Material material);

    // Find all inventory entries for a given warehouse code (joins warehouse relationship)
    @Query("SELECT i FROM InventoryEntity i WHERE i.warehouse.code = :warehouseCode")
    List<InventoryEntity> findByWarehouseCode(@Param("warehouseCode") String warehouseCode);

    // Find the inventory entry for a material in a specific warehouse identified by code
    @Query("SELECT i FROM InventoryEntity i WHERE i.material = :material AND i.warehouse.code = :warehouseCode")
    Optional<InventoryEntity> findByMaterialAndWarehouseCode(@Param("material") Material material, @Param("warehouseCode") String warehouseCode);

    // Find inventory by material + warehouse code + batchNo (batch-level business key)
    @Query("SELECT i FROM InventoryEntity i WHERE i.material = :material AND i.warehouse.code = :warehouseCode AND i.batchNo = :batchNo")
    Optional<InventoryEntity> findByMaterialAndWarehouseCodeAndBatchNo(@Param("material") Material material, @Param("warehouseCode") String warehouseCode, @Param("batchNo") String batchNo);

    // Find inventory by material + warehouse code + batchNo + tenantId + companyId (tenant-scoped business key)
    @Query("SELECT i FROM InventoryEntity i WHERE i.material = :material AND i.warehouse.code = :warehouseCode AND i.batchNo = :batchNo AND i.tenantId = :tenantId AND i.companyId = :companyId")
    Optional<InventoryEntity> findByMaterialAndWarehouseCodeAndBatchNoAndTenantIdAndCompanyId(@Param("material") Material material, @Param("warehouseCode") String warehouseCode, @Param("batchNo") String batchNo, @Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);

    // New: find all inventory entries for tenant + company
    @Query("SELECT i FROM InventoryEntity i WHERE i.tenantId = :tenantId AND i.companyId = :companyId")
    List<InventoryEntity> findByTenantIdAndCompanyId(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);

    // Projection for grid display: join Inventory -> Material -> Warehouse in one query to avoid N+1
    @Query("SELECT new com.ams.bomcore.controller.inventory.dto.InventoryViewDTO("
            + "i.id, i.tenantId, i.companyId, m.id, m.materialCode, m.materialName, w.id, w.code, w.name, "
            + "i.quantityOnHand, i.quantityTotal, i.quantityReserved, i.quantityLocked, i.batchNo, i.contractCode, i.orderToDeduction, i.unit, i.unitPrice, i.currency, "
            + "i.expirationDateTime, i.productionDateTime, i.createdAt, i.visible, i.approved, i.locked, i.materialQuotaPercentage) "
            + "FROM InventoryEntity i "
            + "JOIN i.material m "
            + "JOIN i.warehouse w "
            + "WHERE i.tenantId = :tenantId AND i.companyId = :companyId")
    List<InventoryViewDTO> findAllInventoryView(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);

    // projection for tenant+company-scoped inventory view
    @Query("SELECT new com.ams.bomcore.controller.inventory.dto.InventoryViewDTO("
            + "i.id, i.tenantId, i.companyId, m.id, m.materialCode, m.materialName, w.id, w.code, w.name, "
            + "i.quantityOnHand, i.quantityTotal, i.quantityReserved, i.quantityLocked, i.batchNo, i.contractCode, i.orderToDeduction, i.unit, i.unitPrice, i.currency, "
            + "i.expirationDateTime, i.productionDateTime, i.createdAt, i.visible, i.approved, i.locked, i.materialQuotaPercentage) "
            + "FROM InventoryEntity i "
            + "JOIN i.material m "
            + "JOIN i.warehouse w "
            + "WHERE i.tenantId = :tenantId AND i.companyId = :companyId")
    List<InventoryViewDTO> findInventoryViewByTenantAndCompany(@Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);

    // projection filtered by companyId only
    @Query("SELECT new com.ams.bomcore.controller.inventory.dto.InventoryViewDTO("
            + "i.id, i.tenantId, i.companyId, m.id, m.materialCode, m.materialName, w.id, w.code, w.name, "
            + "i.quantityOnHand, i.quantityTotal, i.quantityReserved, i.quantityLocked, i.batchNo, i.contractCode, i.orderToDeduction, i.unit, i.unitPrice, i.currency, "
            + "i.expirationDateTime, i.productionDateTime, i.createdAt, i.visible, i.approved, i.locked, i.materialQuotaPercentage) "
            + "FROM InventoryEntity i "
            + "JOIN i.material m "
            + "JOIN i.warehouse w "
            + "WHERE i.companyId = :companyId")
    List<InventoryViewDTO> findInventoryViewByCompanyId(@Param("companyId") UUID companyId);

    /**
     * Update ONLY order_to_deduction and updated_at — no other fields are touched.
     */
    @Modifying
    @Query("UPDATE InventoryEntity i SET i.orderToDeduction = :tag, i.updatedAt = :now WHERE i.id = :id")
    void updateOrderToDeduction(@Param("id") UUID id,
                                @Param("tag") String tag,
                                @Param("now") Instant now);

    /**
     * Clear order_to_deduction for a single row — no other fields are touched.
     */
    @Modifying
    @Query("UPDATE InventoryEntity i SET i.orderToDeduction = NULL, i.updatedAt = :now WHERE i.id = :id")
    void clearOrderToDeduction(@Param("id") UUID id, @Param("now") Instant now);

    /**
     * Clear order_to_deduction for all rows of a tenant/company — no other fields touched.
     */
    @Modifying
    @Query("UPDATE InventoryEntity i SET i.orderToDeduction = NULL, i.updatedAt = :now WHERE i.tenantId = :tenantId AND i.companyId = :companyId AND i.orderToDeduction IS NOT NULL")
    void clearAllOrderToDeduction(@Param("tenantId") UUID tenantId,
                                  @Param("companyId") UUID companyId,
                                  @Param("now") Instant now);

    /**
     * Update ONLY quantity_on_hand and updated_at — no other fields are touched.
     */
    @Modifying
    @Query("UPDATE InventoryEntity i SET i.quantityOnHand = :qty, i.updatedAt = :now WHERE i.id = :id")
    void updateQuantityOnHand(@Param("id") UUID id,
                              @Param("qty") BigDecimal qty,
                              @Param("now") Instant now);

    /**
     * Update ONLY quantity_reserved and updated_at — no other fields are touched.
     * Used to reserve the extra scrap/waste qty arising from materialQuotaPercentage > 100.
     */
    @Modifying
    @Query("UPDATE InventoryEntity i SET i.quantityReserved = :qty, i.updatedAt = :now WHERE i.id = :id")
    void updateQuantityReserved(@Param("id") UUID id,
                                @Param("qty") BigDecimal qty,
                                @Param("now") Instant now);

}