package com.ams.bomcore.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
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

    // New: find all inventory entries for tenant + company
    @Query("SELECT i FROM InventoryEntity i WHERE i.tenantId = :tenantId AND i.companyId = :companyId")
    List<InventoryEntity> findByTenantIdAndCompanyId(@Param("tenantId") String tenantId, @Param("companyId") String companyId);

    // Projection for grid display: join Inventory -> Material -> Warehouse in one query to avoid N+1
    @Query("SELECT new com.ams.bomcore.controller.inventory.dto.InventoryViewDTO("
            + "i.id, i.tenantId, i.companyId, m.id, m.materialCode, m.materialName, w.id, w.code, w.name, "
            + "i.quantityOnHand, i.quantityLocked, i.batchNo, i.expirationDateTime, i.productionDateTime, i.createdAt) "
            + "FROM InventoryEntity i "
            + "JOIN i.material m "
            + "JOIN i.warehouse w "
            + "WHERE i.tenantId = :tenantId AND i.companyId = :companyId")
    List<InventoryViewDTO> findAllInventoryView(@Param("tenantId") String tenantId, @Param("companyId") String companyId);

    // New: projection for tenant+company-scoped inventory view
    @Query("SELECT new com.ams.bomcore.controller.inventory.dto.InventoryViewDTO("
            + "i.id, i.tenantId, i.companyId, m.id, m.materialCode, m.materialName, w.id, w.code, w.name, "
            + "i.quantityOnHand, i.quantityLocked, i.batchNo, i.expirationDateTime, i.productionDateTime, i.createdAt) "
            + "FROM InventoryEntity i "
            + "JOIN i.material m "
            + "JOIN i.warehouse w "
            + "WHERE i.tenantId = :tenantId AND i.companyId = :companyId")
    List<InventoryViewDTO> findInventoryViewByTenantAndCompany(@Param("tenantId") String tenantId, @Param("companyId") String companyId);

    // New: projection filtered by companyId only
    @Query("SELECT new com.ams.bomcore.controller.inventory.dto.InventoryViewDTO("
            + "i.id, i.tenantId, i.companyId, m.id, m.materialCode, m.materialName, w.id, w.code, w.name, "
            + "i.quantityOnHand, i.quantityLocked, i.batchNo, i.expirationDateTime, i.productionDateTime, i.createdAt) "
            + "FROM InventoryEntity i "
            + "JOIN i.material m "
            + "JOIN i.warehouse w "
            + "WHERE i.companyId = :companyId")
    List<InventoryViewDTO> findInventoryViewByCompanyId(@Param("companyId") String companyId);

}