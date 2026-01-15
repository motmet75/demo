package com.ams.bomcore.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.inventory.WarehouseEntity;

@Repository
public interface WarehouseRepository extends JpaRepository<WarehouseEntity, UUID> {

    Optional<WarehouseEntity> findByCode(String code);

}