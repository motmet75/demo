package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.service.bom.BomService;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class ShopPricingService {

    private final BomService bomService;
    private final InventoryRepository inventoryRepository;

    public ShopPricingService(BomService bomService, InventoryRepository inventoryRepository) {
        this.bomService = bomService;
        this.inventoryRepository = inventoryRepository;
    }

    public record CostLine(String materialCode, String materialName, BigDecimal quantity, BigDecimal unitPrice, BigDecimal lineCost) {}

    public record RawCostBreakdown(List<CostLine> lines, BigDecimal total) {}

    public RawCostBreakdown calculateRawCost(UUID modelId, BigDecimal orderQty, UUID tenantId, UUID companyId) {
        var bomOpt = bomService.getActiveBomForModel(modelId, tenantId);
        if (bomOpt.isEmpty()) {
            return new RawCostBreakdown(List.of(), BigDecimal.ZERO);
        }
        var bom = bomOpt.get();
        List<BomItemEntity> bomItems = bomService.getBomItems(bom.getId(), tenantId, companyId);

        List<InventoryEntity> allInventory = inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);

        List<CostLine> lines = new ArrayList<>();
        BigDecimal total = BigDecimal.ZERO;

        for (BomItemEntity item : bomItems) {
            if (item.getMaterial() == null) continue;

            UUID materialId = item.getMaterial().getId();
            BigDecimal avgUnitPrice = weightedAvgUnitPrice(allInventory, materialId);
            if (avgUnitPrice == null) {
                // fall back to Material.price
                avgUnitPrice = item.getMaterial().getPrice() != null ? item.getMaterial().getPrice() : BigDecimal.ZERO;
            }

            BigDecimal qty = item.getQuantity().multiply(orderQty);
            BigDecimal lineCost = qty.multiply(avgUnitPrice).setScale(4, RoundingMode.HALF_UP);
            total = total.add(lineCost);

            lines.add(new CostLine(
                    item.getMaterial().getMaterialCode(),
                    item.getMaterial().getMaterialName(),
                    qty,
                    avgUnitPrice,
                    lineCost
            ));
        }

        return new RawCostBreakdown(lines, total.setScale(4, RoundingMode.HALF_UP));
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
