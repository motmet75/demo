package com.ams.bomcore.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.bom.BomCalculationEntity;

@Repository
public interface BomCalculationRepository extends JpaRepository<BomCalculationEntity, UUID> {

}
