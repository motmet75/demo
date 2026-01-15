package com.ams.bomcore.repository;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

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

}