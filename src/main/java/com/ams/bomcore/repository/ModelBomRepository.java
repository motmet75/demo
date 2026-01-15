package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.modelbom.ModelBom;

@Repository
public interface ModelBomRepository extends JpaRepository<ModelBom, UUID> {

    Optional<ModelBom> findByModelAndMaterial(Model model, Material material);

    List<ModelBom> findAllByModelAndMaterial(Model model, Material material);

    // find all BOM entries for a given model
    List<ModelBom> findAllByModel(Model model);

    // delete all BOM entries for a given model (used when deleting model)
    void deleteAllByModel(Model model);

}