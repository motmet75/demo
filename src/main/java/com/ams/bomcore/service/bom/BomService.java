package com.ams.bomcore.service.bom;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.modelbom.ModelBom;
import com.ams.bomcore.repository.BomItemRepository;
import com.ams.bomcore.repository.BomRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.ModelBomRepository;
import com.ams.bomcore.repository.ModelRepository;

/**
 * Full BOM CRUD service.
 *
 * Key rule: one model can have many BOMs (versions). Only ONE may be ACTIVE at a time.
 * syncBomFromModelBoms() creates/refreshes BomEntity + BomItemEntities from model_bom rows.
 * If no BOM exists for the model yet, it creates one and sets it ACTIVE.
 * If an ACTIVE BOM already exists it creates a new version and activates it (deactivates old).
 */
@Service
public class BomService {

    private final BomRepository bomRepository;
    private final BomItemRepository bomItemRepository;
    private final ModelRepository modelRepository;
    private final ModelBomRepository modelBomRepository;
    private final MaterialRepository materialRepository;

    public BomService(BomRepository bomRepository,
                      BomItemRepository bomItemRepository,
                      ModelRepository modelRepository,
                      ModelBomRepository modelBomRepository,
                      MaterialRepository materialRepository) {
        this.bomRepository = bomRepository;
        this.bomItemRepository = bomItemRepository;
        this.modelRepository = modelRepository;
        this.modelBomRepository = modelBomRepository;
        this.materialRepository = materialRepository;
    }

    // ── Read ─────────────────────────────────────────────────────────

    public List<BomEntity> listByTenantAndCompany(UUID tenantId, UUID companyId) {
        return bomRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);
    }

    public Optional<BomEntity> getById(UUID id) {
        return bomRepository.findById(id);
    }

    public Optional<BomEntity> getActiveBomForModel(UUID modelId, UUID tenantId) {
        return modelRepository.findById(modelId)
                .flatMap(m -> bomRepository.findByModelAndTenantIdAndStatus(m, tenantId, "ACTIVE"));
    }

    public List<BomItemEntity> getBomItems(UUID bomId, UUID tenantId, UUID companyId) {
        return bomItemRepository.findByBomIdAndTenantIdAndCompanyId(bomId, tenantId, companyId);
    }

    // ── BOM CRUD ─────────────────────────────────────────────────────

    /**
     * Create a new BOM for a model at a given version.
     * Validates uniqueness (model+tenant+version).
     * If status=ACTIVE, deactivates any existing ACTIVE BOM for this model+tenant.
     */
    @Transactional(rollbackFor = Exception.class)
    public BomEntity createBom(UUID modelId, UUID tenantId, UUID companyId,
                                Integer version, String status) {
        Model model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));

        // uniqueness check
        if (bomRepository.findByModelAndTenantIdAndVersion(model, tenantId, version).isPresent()) {
            throw new IllegalArgumentException("BOM version " + version + " already exists for this model");
        }

        if ("ACTIVE".equals(status)) {
            deactivateCurrentActive(model, tenantId);
        }

        BomEntity bom = new BomEntity();
        bom.setId(UUID.randomUUID());
        bom.setModel(model);
        bom.setTenantId(tenantId);
        bom.setCompanyId(companyId);
        bom.setVersion(version);
        bom.setStatus(status != null ? status : "DRAFT");
        return bomRepository.save(bom);
    }

    /**
     * Update BOM status (e.g. DRAFT → ACTIVE, ACTIVE → ARCHIVED).
     * Activating a BOM deactivates the previously ACTIVE one.
     */
    @Transactional(rollbackFor = Exception.class)
    public BomEntity updateBomStatus(UUID bomId, String newStatus) {
        BomEntity bom = bomRepository.findById(bomId)
                .orElseThrow(() -> new IllegalArgumentException("BOM not found: " + bomId));

        if ("ACTIVE".equals(newStatus) && !newStatus.equals(bom.getStatus())) {
            deactivateCurrentActive(bom.getModel(), bom.getTenantId());
        }
        bom.setStatus(newStatus);
        return bomRepository.save(bom);
    }

    /** Delete a BOM and all its items. Cannot delete an ACTIVE BOM. */
    @Transactional(rollbackFor = Exception.class)
    public void deleteBom(UUID bomId) {
        BomEntity bom = bomRepository.findById(bomId)
                .orElseThrow(() -> new IllegalArgumentException("BOM not found: " + bomId));
        if ("ACTIVE".equals(bom.getStatus())) {
            throw new IllegalStateException("Cannot delete an ACTIVE BOM. Archive it first.");
        }
        bomItemRepository.deleteByBom(bom);
        bomRepository.delete(bom);
    }

    // ── BOM Item CRUD ────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public BomItemEntity addBomItem(UUID bomId, UUID materialId, BigDecimal quantity,
                                     Integer level, UUID parentItemId,
                                     UUID tenantId, UUID companyId) {
        BomEntity bom = bomRepository.findById(bomId)
                .orElseThrow(() -> new IllegalArgumentException("BOM not found: " + bomId));
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Material not found: " + materialId));
        BomItemEntity parent = null;
        if (parentItemId != null) {
            parent = bomItemRepository.findById(parentItemId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent item not found: " + parentItemId));
        }

        BomItemEntity item = new BomItemEntity();
        item.setId(UUID.randomUUID());
        item.setBom(bom);
        item.setMaterial(material);
        item.setQuantity(quantity);
        item.setLevel(level != null ? level : 1);
        item.setParentItem(parent);
        item.setTenantId(tenantId);
        item.setCompanyId(companyId);
        return bomItemRepository.save(item);
    }

    @Transactional(rollbackFor = Exception.class)
    public BomItemEntity updateBomItem(UUID itemId, UUID materialId, BigDecimal quantity,
                                        Integer level, UUID tenantId, UUID companyId) {
        BomItemEntity item = bomItemRepository.findById(itemId)
                .orElseThrow(() -> new IllegalArgumentException("BOM item not found: " + itemId));
        if (materialId != null) {
            Material mat = materialRepository.findById(materialId)
                    .orElseThrow(() -> new IllegalArgumentException("Material not found: " + materialId));
            item.setMaterial(mat);
        }
        if (quantity != null) item.setQuantity(quantity);
        if (level != null) item.setLevel(level);
        if (tenantId != null) item.setTenantId(tenantId);
        if (companyId != null) item.setCompanyId(companyId);
        return bomItemRepository.save(item);
    }

    @Transactional(rollbackFor = Exception.class)
    public void deleteBomItem(UUID itemId) {
        if (!bomItemRepository.existsById(itemId)) {
            throw new IllegalArgumentException("BOM item not found: " + itemId);
        }
        bomItemRepository.deleteById(itemId);
    }

    // ── Sync from ModelBom ────────────────────────────────────────────

    /**
     * Sync (create or update) a BomEntity + BomItemEntities from the model_bom rows for a model.
     *
     * Rules:
     * - Load all ModelBom rows for the model (tenant+company scoped).
     * - If the model has NO BOM at all → create new BomEntity version=1, status=ACTIVE.
     * - If the model has an existing ACTIVE BOM → create a NEW version (max+1), set to ACTIVE,
     *   archive the old ACTIVE BOM (status=ARCHIVED). This preserves history.
     * - Populate BomItemEntities from ModelBom rows (level=1, no parent).
     * - Returns the newly created/synced BomEntity.
     */
    @Transactional(rollbackFor = Exception.class)
    public BomEntity syncBomFromModelBoms(UUID modelId, UUID tenantId, UUID companyId) {
        Model model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));

        List<ModelBom> modelBoms = modelBomRepository.findAllByModelIdAndTenantIdAndCompanyId(
                modelId, tenantId, companyId);
        if (modelBoms.isEmpty()) {
            // fallback without company scope
            modelBoms = modelBomRepository.findAllByModelAndTenantId(model, tenantId);
        }
        if (modelBoms.isEmpty()) {
            throw new IllegalStateException("No ModelBom rows found for model: " + modelId
                    + ". Import model-BOM data first.");
        }

        // Determine next version number
        List<BomEntity> existing = bomRepository.findAllByModelAndTenantId(model, tenantId);
        int nextVersion = existing.stream()
                .mapToInt(b -> b.getVersion() != null ? b.getVersion() : 0)
                .max().orElse(0) + 1;

        // Archive current ACTIVE (if any)
        Optional<BomEntity> currentActive = bomRepository.findByModelAndTenantIdAndStatus(model, tenantId, "ACTIVE");
        currentActive.ifPresent(b -> { b.setStatus("ARCHIVED"); bomRepository.save(b); });

        // Create new BOM
        BomEntity bom = new BomEntity();
        bom.setId(UUID.randomUUID());
        bom.setModel(model);
        bom.setTenantId(tenantId);
        bom.setCompanyId(companyId);
        bom.setVersion(nextVersion);
        bom.setStatus("ACTIVE");
        bom = bomRepository.save(bom);

        // Create BomItems from ModelBom rows (flat, level=1)
        List<BomItemEntity> items = new ArrayList<>();
        for (ModelBom mb : modelBoms) {
            BomItemEntity item = new BomItemEntity();
            item.setId(UUID.randomUUID());
            item.setBom(bom);
            item.setMaterial(mb.getMaterial());
            item.setQuantity(mb.getQtyPerUnit() != null ? mb.getQtyPerUnit() : BigDecimal.ONE);
            item.setLevel(1);
            item.setTenantId(tenantId);
            item.setCompanyId(companyId);
            items.add(bomItemRepository.save(item));
        }

        return bom;
    }

    /**
     * Validate that an ACTIVE BOM exists for a model before order creation.
     * Returns the active BOM or throws IllegalStateException.
     */
    public BomEntity validateActiveBomForOrder(UUID modelId, UUID tenantId) {
        Model model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));
        return bomRepository.findByModelAndTenantIdAndStatus(model, tenantId, "ACTIVE")
                .orElseThrow(() -> new IllegalStateException(
                        "No ACTIVE BOM found for model " + model.getModelCode()
                                + ". Please sync BOM before creating order."));
    }

    // ── Private helpers ───────────────────────────────────────────────

    private void deactivateCurrentActive(Model model, UUID tenantId) {
        bomRepository.findByModelAndTenantIdAndStatus(model, tenantId, "ACTIVE")
                .ifPresent(b -> { b.setStatus("ARCHIVED"); bomRepository.save(b); });
    }
}
