package com.ams.bomcore.service.inventory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.repository.InventoryRepository;

/**
 * Updates the {@code order_to_deduction} field on inventory rows.
 *
 * <p>Business rules:
 * <ul>
 *   <li>Rows are sorted by {@code originType} (frontend arranges priority) then
 *       {@code expirationDateTime} ascending (FEFO — first-expired first-out).</li>
 *   <li>For each material the caller provides a total required qty.  The service
 *       walks the sorted inventory rows and assigns enough qty per row until the
 *       requirement is met, storing the deduction quantity string (e.g. "12.5")
 *       in {@code orderToDeduction}.</li>
 *   <li>Previously-set {@code orderToDeduction} for the same material/tenant/company
 *       is cleared before re-calculation.</li>
 * </ul>
 */
@Service
public class OrderDeductionService {

    private final InventoryRepository inventoryRepository;

    public OrderDeductionService(InventoryRepository inventoryRepository) {
        this.inventoryRepository = inventoryRepository;
    }

    /**
     * Recalculate and persist {@code orderToDeduction} for a single material.
     *
     * @param materialId  material to process
     * @param requiredQty total quantity needed across all selected orders
     * @param tenantId    tenant scope
     * @param companyId   company scope
     * @return list of updated inventory rows
     */
    @Transactional(rollbackFor = Exception.class)
    public List<InventoryEntity> assignDeduction(UUID materialId, BigDecimal requiredQty,
                                                  UUID tenantId, UUID companyId) {
        List<InventoryEntity> rows = inventoryRepository.findByTenantIdAndCompanyId(tenantId, companyId)
                .stream()
                .filter(e -> e.getMaterial() != null
                        && e.getMaterial().getId().equals(materialId)
                        && Boolean.TRUE.equals(e.getVisible())
                        && !Boolean.TRUE.equals(e.getLocked()))
                .sorted(Comparator
                        .comparing((InventoryEntity e) -> e.getOriginType() == null ? "" : e.getOriginType())
                        .thenComparing(e -> e.getExpirationDateTime() == null ? Instant.MAX : e.getExpirationDateTime()))
                .toList();

        // Clear existing deduction tags for this material
        for (InventoryEntity row : rows) {
            if (row.getOrderToDeduction() != null) {
                row.setOrderToDeduction(null);
                inventoryRepository.save(row);
            }
        }

        BigDecimal remaining = requiredQty;
        List<InventoryEntity> updated = new ArrayList<>();

        for (InventoryEntity row : rows) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) break;
            BigDecimal available = row.getQuantityOnHand() == null ? BigDecimal.ZERO : row.getQuantityOnHand();
            BigDecimal locked    = row.getQuantityLocked()  == null ? BigDecimal.ZERO : row.getQuantityLocked();
            BigDecimal usable    = available.subtract(locked);
            if (usable.compareTo(BigDecimal.ZERO) <= 0) continue;

            BigDecimal deduct = remaining.min(usable).setScale(4, RoundingMode.HALF_UP);
            row.setOrderToDeduction(deduct.stripTrailingZeros().toPlainString());
            inventoryRepository.save(row);
            updated.add(row);
            remaining = remaining.subtract(deduct);
        }

        return updated;
    }

    /**
     * Clear all {@code orderToDeduction} marks for a tenant/company.
     */
    @Transactional(rollbackFor = Exception.class)
    public void clearAll(UUID tenantId, UUID companyId) {
        List<InventoryEntity> rows = inventoryRepository.findByTenantIdAndCompanyId(tenantId, companyId);
        for (InventoryEntity row : rows) {
            if (row.getOrderToDeduction() != null) {
                row.setOrderToDeduction(null);
                inventoryRepository.save(row);
            }
        }
    }
}
