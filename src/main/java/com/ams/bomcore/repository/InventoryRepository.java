package com.ams.bomcore.repository;

import java.math.BigDecimal;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.inventory.InventoryEntity;

@Repository
public interface InventoryRepository extends JpaRepository<InventoryEntity, UUID> {

    @Query("SELECT COALESCE(SUM(i.quantityOnHand - COALESCE(i.quantityLocked, 0)), 0) FROM InventoryEntity i WHERE i.material.id = :materialId")
    BigDecimal sumAvailableByMaterialId(@Param("materialId") UUID materialId);
    

}
