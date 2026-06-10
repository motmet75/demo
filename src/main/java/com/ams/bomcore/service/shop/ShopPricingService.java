package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.shop.ModelMenuOption;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.service.bom.BomService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ShopPricingService {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final BomService bomService;
    private final InventoryRepository inventoryRepository;

    public ShopPricingService(BomService bomService, InventoryRepository inventoryRepository) {
        this.bomService = bomService;
        this.inventoryRepository = inventoryRepository;
    }

    public record CostLine(String materialCode, String materialName, BigDecimal quantity, BigDecimal unitPrice, BigDecimal lineCost) {}

    public record RawCostBreakdown(List<CostLine> lines, BigDecimal total) {}

    /**
     * Resolves which model's BOM to use for a given order item.
     * If any selected choice carries a {@code modelId} field, that model's BOM is used instead
     * of the item's own model BOM (e.g. Small/Medium/Large each backed by a different BOM model).
     * Only the first matching choice with a valid modelId wins.
     */
    public UUID resolveEffectiveBomModel(UUID baseModelId, String selectedOptions, List<ModelMenuOption> optionGroups) {
        if (selectedOptions == null || selectedOptions.isBlank() || optionGroups == null || optionGroups.isEmpty()) {
            return baseModelId;
        }
        try {
            Map<String, Object> selected = MAPPER.readValue(selectedOptions, new TypeReference<>() {});
            for (ModelMenuOption group : optionGroups) {
                Object chosenRaw = selected.get(group.getGroupName());
                if (chosenRaw == null) continue;
                // Normalize to a single label (take first element for multi-select)
                String chosenLabel = (chosenRaw instanceof List<?> list && !list.isEmpty())
                        ? list.get(0).toString() : chosenRaw.toString();
                List<Map<String, Object>> choiceDefs = MAPPER.readValue(group.getChoices(), new TypeReference<>() {});
                for (Map<String, Object> choice : choiceDefs) {
                    if (chosenLabel.equals(String.valueOf(choice.get("label")))) {
                        Object mid = choice.get("modelId");
                        if (mid != null && !mid.toString().isBlank()) {
                            try { return UUID.fromString(mid.toString()); } catch (IllegalArgumentException ignored) {}
                        }
                    }
                }
            }
        } catch (Exception ignored) {}
        return baseModelId;
    }

    /** Convenience overload — resolves effective BOM model from selectedOptions, then calculates raw cost. */
    public RawCostBreakdown calculateRawCost(UUID modelId, BigDecimal orderQty,
            String selectedOptions, List<ModelMenuOption> optionGroups,
            UUID tenantId, UUID companyId) {
        UUID effectiveModelId = resolveEffectiveBomModel(modelId, selectedOptions, optionGroups);
        return calculateRawCostForModel(effectiveModelId, orderQty, tenantId, companyId);
    }

    /** Backward-compatible overload — no selectedOptions, uses model's own BOM directly. */
    public RawCostBreakdown calculateRawCost(UUID modelId, BigDecimal orderQty, UUID tenantId, UUID companyId) {
        return calculateRawCostForModel(modelId, orderQty, tenantId, companyId);
    }

    private RawCostBreakdown calculateRawCostForModel(UUID modelId, BigDecimal orderQty, UUID tenantId, UUID companyId) {
        var bomOpt = bomService.getActiveBomForModel(modelId, tenantId);
        if (bomOpt.isEmpty()) {
            return new RawCostBreakdown(List.of(), BigDecimal.ZERO);
        }
        var bom = bomOpt.get();
        List<BomItemEntity> bomItems = bomService.getBomItems(bom.getId(), tenantId, companyId);
        List<InventoryEntity> allInventory = inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);

        // Build parent→children map and collect root items (parentItem == null)
        Map<UUID, List<BomItemEntity>> childMap = new HashMap<>();
        List<BomItemEntity> roots = new ArrayList<>();
        for (BomItemEntity bi : bomItems) {
            if (bi.getParentItem() == null) {
                roots.add(bi);
            } else {
                UUID parentId = bi.getParentItem().getId();
                childMap.computeIfAbsent(parentId, k -> new ArrayList<>()).add(bi);
            }
        }

        // Accumulate effective material quantities by traversing the BOM tree.
        // Each node's effective qty = product of all ancestor quantities × orderQty.
        Map<UUID, BigDecimal> materialQtyMap = new LinkedHashMap<>();
        Map<UUID, Material> materialById = new LinkedHashMap<>();
        for (BomItemEntity root : roots) {
            accumulateBomQty(root, orderQty.multiply(root.getQuantity()), childMap, materialQtyMap, materialById);
        }

        List<CostLine> lines = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Map.Entry<UUID, BigDecimal> entry : materialQtyMap.entrySet()) {
            UUID materialId = entry.getKey();
            BigDecimal qty = entry.getValue();
            Material material = materialById.get(materialId);
            if (material == null) continue;

            BigDecimal avgUnitPrice = weightedAvgUnitPrice(allInventory, materialId);
            if (avgUnitPrice == null) {
                avgUnitPrice = material.getPrice() != null ? material.getPrice() : BigDecimal.ZERO;
            }
            BigDecimal lineCost = qty.multiply(avgUnitPrice).setScale(4, RoundingMode.HALF_UP);
            total = total.add(lineCost);
            lines.add(new CostLine(material.getMaterialCode(), material.getMaterialName(), qty, avgUnitPrice, lineCost));
        }

        return new RawCostBreakdown(lines, total.setScale(4, RoundingMode.HALF_UP));
    }

    /**
     * Recursively accumulates material quantities through the BOM tree.
     * multiplier = product of all ancestor node quantities × orderQty already applied.
     */
    private void accumulateBomQty(BomItemEntity node, BigDecimal multiplier,
                                   Map<UUID, List<BomItemEntity>> childMap,
                                   Map<UUID, BigDecimal> qtyMap,
                                   Map<UUID, Material> materialById) {
        Material mat = node.getMaterial();
        if (mat != null) {
            UUID matId = mat.getId();
            if (matId != null) {
                qtyMap.merge(matId, multiplier, BigDecimal::add);
                materialById.putIfAbsent(matId, mat);
            }
        }
        List<BomItemEntity> children = childMap.get(node.getId());
        if (children == null || children.isEmpty()) return;
        for (BomItemEntity child : children) {
            if (child.getQuantity() == null) continue;
            accumulateBomQty(child, multiplier.multiply(child.getQuantity()), childMap, qtyMap, materialById);
        }
    }

    private BigDecimal weightedAvgUnitPrice(List<InventoryEntity> allInventory, UUID materialId) {
        BigDecimal sumQty = BigDecimal.ZERO;
        BigDecimal sumValue = BigDecimal.ZERO;
        for (InventoryEntity inv : allInventory) {
            if (inv.getMaterial() == null || !inv.getMaterial().getId().equals(materialId)) continue;
            BigDecimal qty = inv.getQuantityOnHand() != null ? inv.getQuantityOnHand() : BigDecimal.ZERO;
            BigDecimal price = inv.getUnitPrice() != null ? inv.getUnitPrice() : BigDecimal.ZERO;
            if (qty.compareTo(BigDecimal.ZERO) > 0) {
                sumQty = sumQty.add(qty);
                sumValue = sumValue.add(qty.multiply(price));
            }
        }
        if (sumQty.compareTo(BigDecimal.ZERO) == 0) return null;
        return sumValue.divide(sumQty, 6, RoundingMode.HALF_UP);
    }
}
