package com.ams.bomcore.service.bom;

import java.math.BigDecimal;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.bom.BomCalculationEntity;
import com.ams.bomcore.domain.bom.BomCalculationItemEntity;
import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.repository.BomCalculationRepository;
import com.ams.bomcore.repository.BomItemRepository;
import com.ams.bomcore.repository.BomRepository;
import com.ams.bomcore.repository.InventoryRepository;

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

    public BomCalculationService(BomRepository bomRepository,
                                 BomItemRepository bomItemRepository,
                                 InventoryRepository inventoryRepository,
                                 BomCalculationRepository bomCalculationRepository) {
        this.bomRepository = bomRepository;
        this.bomItemRepository = bomItemRepository;
        this.inventoryRepository = inventoryRepository;
        this.bomCalculationRepository = bomCalculationRepository;
    }

    /**
     * Calculate required materials for an ACTIVE BOM model and persist a BomCalculation record.
     * @param modelName BOM model name
     * @param targetQty desired target quantity (finished good count)
     * @return saved BomCalculationEntity containing calculation items
     */
    @Transactional
    public BomCalculationEntity calculate(String modelName, BigDecimal targetQty) {
        BomEntity bom = bomRepository.findByModelNameAndStatus(modelName, "ACTIVE")
                .orElseThrow(() -> new IllegalArgumentException("No ACTIVE BOM found for model: " + modelName));

        List<BomItemEntity> items = bomItemRepository.findByBom(bom);

        // Build children map for tree traversal
        Map<UUID, List<BomItemEntity>> children = new HashMap<>();
        Map<UUID, BomItemEntity> byId = new HashMap<>();
        List<BomItemEntity> roots = new ArrayList<>();
        for (BomItemEntity it : items) {
            byId.put(it.getId(), it);
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
            // root multiplier: targetQty * root.quantity
            traverseAndAccumulate(root, targetQty.multiply(root.getQuantity()), children, aggregate);
        }

        // Persist BomCalculation and items
        BomCalculationEntity calculation = new BomCalculationEntity();
        calculation.setBom(bom);
        calculation.setModelName(modelName);
        calculation.setTargetQty(targetQty);
        calculation.setStatus("COMPLETED");

        List<BomCalculationItemEntity> calcItems = new ArrayList<>();
        for (Map.Entry<Material, BigDecimal> e : aggregate.entrySet()) {
            Material mat = e.getKey();
            BigDecimal required = e.getValue();
            BigDecimal available = inventoryRepository.sumAvailableByMaterialId(mat.getId());
            if (available == null) available = BigDecimal.ZERO;
            BigDecimal shortage = required.subtract(available).max(BigDecimal.ZERO);

            BomCalculationItemEntity ci = new BomCalculationItemEntity();
            ci.setCalculation(calculation);
            ci.setMaterial(mat);
            ci.setRequiredQty(required);
            ci.setAvailableQty(available);
            ci.setShortageQty(shortage);
            calcItems.add(ci);
        }

        calculation.setItems(calcItems);

        // Save calculation (cascade will persist items)
        return bomCalculationRepository.save(calculation);
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
