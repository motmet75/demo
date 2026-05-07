package com.ams.bomcore.service.bom;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.bom.BomCalculationEntity;
import com.ams.bomcore.domain.bom.BomCalculationItemEntity;
import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.repository.BomCalculationRepository;
import com.ams.bomcore.repository.BomItemRepository;
import com.ams.bomcore.repository.BomRepository;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.ModelRepository;

/**
 * Service responsible for BOM calculation: load active BOM, explode it, aggregate materials,
 * check inventory availability and persist calculation records.
 *
 * Important: This service does NOT lock inventory. Locking happens in a separate service.
 */
@Service
public class BomCalculationService {

    private final BomRepository bomRepository;
    private final BomItemRepository bomItemRepository;
    private final InventoryRepository inventoryRepository;
    private final BomCalculationRepository bomCalculationRepository;
    private final ModelRepository modelRepository;

    public BomCalculationService(BomRepository bomRepository,
                                 BomItemRepository bomItemRepository,
                                 InventoryRepository inventoryRepository,
                                 BomCalculationRepository bomCalculationRepository,
                                 ModelRepository modelRepository) {
        this.bomRepository = bomRepository;
        this.bomItemRepository = bomItemRepository;
        this.inventoryRepository = inventoryRepository;
        this.bomCalculationRepository = bomCalculationRepository;
        this.modelRepository = modelRepository;
    }

    /**
     * Calculate required materials for an ACTIVE BOM model and persist a BomCalculation record.
     * @param model Model entity
     * @param tenantId tenant isolation identifier
     * @param targetQty desired target quantity (finished good count)
     * @return saved BomCalculationEntity containing calculation items
     */
    @Transactional
    public BomCalculationEntity calculate(Model model, UUID tenantId, BigDecimal targetQty) {
        return calculate(model, tenantId, model.getCompanyId(), targetQty);
    }

    @Transactional
    public BomCalculationEntity calculate(Model model, UUID tenantId, UUID companyId, BigDecimal targetQty) {
        if (model == null) {
			throw new IllegalArgumentException("Model is required");
		}

        BomEntity bom = bomRepository.findByModelAndTenantIdAndStatus(model, tenantId, "ACTIVE")
                .orElseThrow(() -> new IllegalArgumentException("No ACTIVE BOM found for model: " + model.getModelName() + " tenant: " + tenantId));

        List<BomItemEntity> items = bomItemRepository.findByBom(bom);

        // Build children map for tree traversal
        Map<UUID, List<BomItemEntity>> children = new HashMap<>();
        List<BomItemEntity> roots = new ArrayList<>();
        for (BomItemEntity it : items) {
            if (it.getParentItem() == null) {
                roots.add(it);
            } else {
                children.computeIfAbsent(it.getParentItem().getId(), k -> new ArrayList<>()).add(it);
            }
        }

        // Aggregation map: Material -> required quantity
        Map<Material, BigDecimal> aggregate = new HashMap<>();

        // For each root item, traverse and compute multipliers
        for (BomItemEntity root : roots) {
            traverseAndAccumulate(root, targetQty.multiply(root.getQuantity()), children, aggregate);
        }

        // Persist BomCalculation and items
        BomCalculationEntity calculation = new BomCalculationEntity();
        calculation.setBom(bom);
        calculation.setModelName(model.getModelName());
        calculation.setTenantId(bom.getTenantId());
        calculation.setCompanyId(companyId != null ? companyId : bom.getCompanyId());
        calculation.setTargetQty(targetQty);
        calculation.setStatus("COMPLETED");

        List<BomCalculationItemEntity> calcItems = new ArrayList<>();
        for (Map.Entry<Material, BigDecimal> e : aggregate.entrySet()) {
            Material mat = e.getKey();
            BigDecimal required = e.getValue();
            BigDecimal available = inventoryRepository.sumAvailableByMaterialId(mat.getId());
            if (available == null) {
				available = BigDecimal.ZERO;
			}
            BigDecimal shortage = required.subtract(available).max(BigDecimal.ZERO);

            BomCalculationItemEntity ci = new BomCalculationItemEntity();
            ci.setCalculation(calculation);
            ci.setMaterial(mat);
            ci.setRequiredQty(required);
            ci.setAvailableQty(available);
            ci.setShortageQty(shortage);
            ci.setTenantId(calculation.getTenantId());
            ci.setCompanyId(calculation.getCompanyId());
            calcItems.add(ci);
        }

        calculation.setItems(calcItems);

        // Save calculation (cascade will persist items)
        return bomCalculationRepository.save(calculation);
    }

    /**
     * Check availability for a model and target quantity. Delegates to calculate(...) then maps
     * the persisted calculation items into DTOs for controller consumption.
     * This method keeps all business logic inside the service layer.
     */
    @Transactional
    public List<BomCheckResult> checkAvailability(String modelCode, BigDecimal targetQty) {
        // delegate with empty tenantId (caller should prefer overload that provides tenant)
        return checkAvailability(modelCode, targetQty, null);
    }

    @Transactional
    public List<BomCheckResult> checkAvailability(String modelCode, BigDecimal targetQty, UUID tenantId) {
        // Resolve modelCode -> model
        Model model = modelRepository.findByModelCode(modelCode)
                .orElseThrow(() -> new IllegalArgumentException("Model not found for code: " + modelCode));

        BomCalculationEntity calc = calculate(model, tenantId, targetQty);
        List<BomCheckResult> out = new ArrayList<>();
        if (calc.getItems() != null) {
            for (BomCalculationItemEntity item : calc.getItems()) {
                BomCheckResult r = new BomCheckResult();
                r.setMaterialId(item.getMaterial().getId());
                r.setMaterialCode(item.getMaterial().getMaterialCode());
                r.setMaterialName(item.getMaterial().getMaterialName());
                r.setRequiredQty(item.getRequiredQty());
                r.setAvailableQty(item.getAvailableQty());
                r.setShortageQty(item.getShortageQty());
                out.add(r);
            }
        }
        return out;
    }

    public static class BomCheckResult {
        private UUID materialId;
        private String materialCode;
        private String materialName;
        private BigDecimal requiredQty;
        private BigDecimal availableQty;
        private BigDecimal shortageQty;

        public UUID getMaterialId() { return materialId; }
        public void setMaterialId(UUID materialId) { this.materialId = materialId; }
        public String getMaterialCode() { return materialCode; }
        public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
        public String getMaterialName() { return materialName; }
        public void setMaterialName(String materialName) { this.materialName = materialName; }
        public BigDecimal getRequiredQty() { return requiredQty; }
        public void setRequiredQty(BigDecimal requiredQty) { this.requiredQty = requiredQty; }
        public BigDecimal getAvailableQty() { return availableQty; }
        public void setAvailableQty(BigDecimal availableQty) { this.availableQty = availableQty; }
        public BigDecimal getShortageQty() { return shortageQty; }
        public void setShortageQty(BigDecimal shortageQty) { this.shortageQty = shortageQty; }
    }

    private void traverseAndAccumulate(BomItemEntity node, BigDecimal multiplier,
                                       Map<UUID, List<BomItemEntity>> children,
                                       Map<Material, BigDecimal> aggregate) {
        // accumulate for this node's material
        Material mat = node.getMaterial();
        aggregate.merge(mat, multiplier, BigDecimal::add);

        List<BomItemEntity> childs = children.get(node.getId());
        if (childs == null || childs.isEmpty()) {
            return;
        }
        for (BomItemEntity c : childs) {
            BigDecimal childMultiplier = multiplier.multiply(c.getQuantity());
            traverseAndAccumulate(c, childMultiplier, children, aggregate);
        }
    }
}