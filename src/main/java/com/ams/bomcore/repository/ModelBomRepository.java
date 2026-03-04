package com.ams.bomcore.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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

    // find all by model ID
    @Query("SELECT mb FROM ModelBom mb WHERE mb.model.id = :modelId")
    List<ModelBom> findAllByModelId(@Param("modelId") UUID modelId);

    // find by model and tenant
    List<ModelBom> findAllByModelAndTenantId(Model model, UUID tenantId);

    // find by model and tenant and company
    List<ModelBom> findAllByModelAndTenantIdAndCompanyId(Model model, UUID tenantId, UUID companyId);

    // find by model ID and tenant and company
    @Query("SELECT mb FROM ModelBom mb WHERE mb.model.id = :modelId AND mb.tenantId = :tenantId AND mb.companyId = :companyId")
    List<ModelBom> findAllByModelIdAndTenantIdAndCompanyId(@Param("modelId") UUID modelId, @Param("tenantId") UUID tenantId, @Param("companyId") UUID companyId);

    // find by model and material with tenant/company scope
    Optional<ModelBom> findByModelAndMaterialAndTenantIdAndCompanyId(Model model, Material material, UUID tenantId, UUID companyId);

    // find all by tenant and company
    List<ModelBom> findAllByTenantIdAndCompanyId(UUID tenantId, UUID companyId);
}