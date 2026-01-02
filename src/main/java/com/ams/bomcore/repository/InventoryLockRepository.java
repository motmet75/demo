package com.ams.bomcore.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.inventory.InventoryLockEntity;

@Repository
public interface InventoryLockRepository extends JpaRepository<InventoryLockEntity, UUID> {

    List<InventoryLockEntity> findByMaterial_IdAndStatus(UUID materialId, String status);

}