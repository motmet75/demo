package com.ams.bomcore.repository;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.bom.BomEntity;

@Repository
public interface BomRepository extends JpaRepository<BomEntity, UUID> {

	Optional<BomEntity> findByModelNameAndStatus(String modelName, String status);

}