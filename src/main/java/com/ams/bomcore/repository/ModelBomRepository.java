package com.ams.bomcore.repository;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.modelbom.ModelBom;

@Repository
public interface ModelBomRepository extends JpaRepository<ModelBom, UUID> {

}
