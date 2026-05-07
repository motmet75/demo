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

import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.repository.BomItemRepository;
import com.ams.bomcore.repository.InventoryRepository;


/**
 * Handles the two deduction flows for inventory:
 *
 * <h3>Flow 1 — Tag for deduction ({@link #assignDeduction})</h3>
 * Marks which inventory rows should be consumed first for an order, and how much
 * physical stock to pull from each row.
 *
 * <p>For each row the physical tag qty = base portion × quotaFactor, where
 * {@code quotaFactor = materialQuotaPercentage / 100} (default 1 when null/zero/100).
 * The extra qty above the base (physicalTag − base portion) is also added to
 * {@code quantityReserved} on that row so the warehouse knows it is earmarked for
 * scrap/waste on this order.
 *
 * <p>Sorting rule: rows with a non-null {@code orderToDeduction} label are ranked
 * <strong>alphabetically ascending</strong> by that label (e.g. "A" before "B").
 * Rows without a label go last.  Within the same label, FEFO (earliest
 * expiration first) is used as a tiebreaker.
 *
 * <h3>Flow 2 — Production consumption ({@link #consumeForProduction})</h3>
 * Physically issues material to a production order based on a BOM item.
 * <ol>
 *   <li>Find all inventory rows for the BOM item's material, visible and unlocked.</li>
 *   <li>Sort by {@code orderToDeduction} label alphabetically ascending (null → last),
 *       FEFO as tiebreaker.</li>
 *   <li>For each row: physicalDeduct = basePortion × quotaFactor.
 *       Deduct from {@code quantityOnHand}.</li>
 *   <li>Consumption quantity reported = base qty (not inflated by quota).
 *       The extra quota qty is the scrap/waste component already reserved in Flow 1.</li>
 * </ol>
 */
@Service
public class OrderDeductionService {

    private final InventoryRepository inventoryRepository;
    private final BomItemRepository   bomItemRepository;

    public OrderDeductionService(InventoryRepository inventoryRepository,
                                 BomItemRepository bomItemRepository) {
        this.inventoryRepository = inventoryRepository;
        this.bomItemRepository   = bomItemRepository;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Flow 1 — assign deduction tags
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Recalculate and persist {@code orderToDeduction} quantity-string for a
     * single material so the UI/warehouse knows which lots to pick first and
     * how much physical stock to pull from each.
     *
     * <p>For each selected row:
     * <ul>
     *   <li>{@code physicalTag = basePortion × quotaFactor}
     *       (quotaFactor = materialQuotaPercentage / 100; default 1)</li>
     *   <li>The tag string written to {@code orderToDeduction} is the physical qty.</li>
     *   <li>The extra scrap qty {@code (physicalTag − basePortion)} is <em>added</em> to
     *       {@code quantityReserved} so it is visible as earmarked stock.</li>
     * </ul>
     *
     * @param materialId  material to process
     * @param requiredQty total BASE quantity needed (e.g. BomItem.quantity × orderQty)
     * @param tenantId    tenant scope
     * @param companyId   company scope
     * @return updated inventory rows (in-memory state reflects DB writes)
     */
    @Transactional(rollbackFor = Exception.class)
    public List<InventoryEntity> assignDeduction(UUID materialId, BigDecimal requiredQty,
                                                 UUID tenantId, UUID companyId) {

        List<InventoryEntity> rows = inventoryRepository
                .findByTenantIdAndCompanyId(tenantId, companyId)
                .stream()
                .filter(e -> e.getMaterial() != null
                        && e.getMaterial().getId().equals(materialId)
                        && Boolean.TRUE.equals(e.getVisible())
                        && !Boolean.TRUE.equals(e.getLocked()))
                .sorted(deductionLabelComparator())
                .toList();

        // Clear existing tags for this material — targeted update, no other fields touched
        Instant now = Instant.now();
        rows.forEach(r -> {
            if (r.getOrderToDeduction() != null) {
                inventoryRepository.clearOrderToDeduction(r.getId(), now);
                r.setOrderToDeduction(null);
            }
        });

        // `remaining` = outstanding BASE qty still to be assigned
        BigDecimal remaining = requiredQty;
        List<InventoryEntity> updated = new ArrayList<>();

        for (InventoryEntity row : rows) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
				break;
			}

            BigDecimal available = orZero(row.getQuantityOnHand());
            BigDecimal locked    = orZero(row.getQuantityLocked());
            BigDecimal usable    = available.subtract(locked);
            if (usable.compareTo(BigDecimal.ZERO) <= 0) {
				continue;
			}

            // quota factor for this row
            BigDecimal factor = quotaFactor(row.getMaterialQuotaPercentage());

            // Max base qty this row can cover (physical usable / factor)
            BigDecimal maxBase = usable.divide(factor, 10, RoundingMode.HALF_UP);

            // Base portion assigned to this row
            BigDecimal basePortion = remaining.min(maxBase).setScale(4, RoundingMode.HALF_UP);

            // Physical qty to pull = basePortion × factor
            BigDecimal physicalTag = basePortion.multiply(factor).setScale(4, RoundingMode.HALF_UP);

            // Extra scrap/waste qty = physical - base  (zero when factor == 1)
            BigDecimal extraScrap = physicalTag.subtract(basePortion).setScale(4, RoundingMode.HALF_UP);

            // ── Write 1: tag with the PHYSICAL qty ──────────────────────────
            String tag = physicalTag.stripTrailingZeros().toPlainString();
            inventoryRepository.updateOrderToDeduction(row.getId(), tag, now);
            row.setOrderToDeduction(tag);

            // ── Write 2: reserve the extra scrap qty ────────────────────────
            // Only touch quantityReserved when there is actual extra material.
            if (extraScrap.compareTo(BigDecimal.ZERO) > 0) {
                BigDecimal newReserved = orZero(row.getQuantityReserved()).add(extraScrap)
                        .setScale(4, RoundingMode.HALF_UP);
                inventoryRepository.updateQuantityReserved(row.getId(), newReserved, now);
                row.setQuantityReserved(newReserved);
            }

            row.setUpdatedAt(now);
            updated.add(row);
            remaining = remaining.subtract(basePortion);
        }

        return updated;
    }

    /**
     * Clear all {@code orderToDeduction} marks for a tenant/company.
     */
    @Transactional(rollbackFor = Exception.class)
    public void clearAll(UUID tenantId, UUID companyId) {
        // Targeted bulk update — only order_to_deduction and updated_at are written
        inventoryRepository.clearAllOrderToDeduction(tenantId, companyId, Instant.now());
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Flow 2 — production consumption (issue to production order)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Issue material to production for a single BOM item and an order quantity.
     *
     * <p><strong>Consumption = base qty only</strong> (BomItem.quantity × orderQty).
     * The quota factor inflates how much physical stock is deducted from
     * {@code quantityOnHand}, but the reported "consumed" qty to the BOM/order
     * is always the base figure.
     *
     * <p>The extra scrap qty (physical − base) was already added to
     * {@code quantityReserved} during {@link #assignDeduction}; it is NOT
     * re-reserved here to avoid double-counting.
     *
     * @param bomItemId BOM item that defines the material and base quantity per unit
     * @param orderQty  number of finished-goods units being produced
     * @param tenantId  tenant scope
     * @param companyId company scope
     * @return result describing what was deducted from which rows
     */
    @Transactional(rollbackFor = Exception.class)
    public ConsumptionResult consumeForProduction(UUID bomItemId, BigDecimal orderQty,
                                                  UUID tenantId, UUID companyId) {

        BomItemEntity bomItem = bomItemRepository.findById(bomItemId)
                .orElseThrow(() -> new InventoryException("BOM item not found: " + bomItemId));

        if (bomItem.getMaterial() == null) {
            throw new InventoryException("BOM item has no material assigned: " + bomItemId);
        }

        UUID materialId = bomItem.getMaterial().getId();

        // Base qty = raw BOM requirement (before quota adjustment).
        BigDecimal baseQty = bomItem.getQuantity().multiply(orderQty);

        List<InventoryEntity> rows = inventoryRepository
                .findByTenantIdAndCompanyId(tenantId, companyId)
                .stream()
                .filter(e -> e.getMaterial() != null
                        && e.getMaterial().getId().equals(materialId)
                        && Boolean.TRUE.equals(e.getVisible())
                        && !Boolean.TRUE.equals(e.getLocked()))
                .sorted(deductionLabelComparator())
                .toList();

        // `remaining` tracks outstanding BASE qty still to be fulfilled.
        BigDecimal remaining = baseQty;
        List<ConsumptionLine> lines = new ArrayList<>();

        for (InventoryEntity row : rows) {
            if (remaining.compareTo(BigDecimal.ZERO) <= 0) {
				break;
			}

            BigDecimal available = orZero(row.getQuantityOnHand());
            BigDecimal locked    = orZero(row.getQuantityLocked());
            BigDecimal usable    = available.subtract(locked);
            if (usable.compareTo(BigDecimal.ZERO) <= 0) {
				continue;
			}

            BigDecimal factor = quotaFactor(row.getMaterialQuotaPercentage());

            // Max base qty this row can cover
            BigDecimal maxBase = usable.divide(factor, 10, RoundingMode.HALF_UP);

            // Base portion fulfilled by this row
            BigDecimal basePortion = remaining.min(maxBase).setScale(4, RoundingMode.HALF_UP);

            // Physical qty deducted from quantityOnHand = basePortion × factor
            BigDecimal physicalDeduct = basePortion.multiply(factor).setScale(4, RoundingMode.HALF_UP);

            BigDecimal newQty = available.subtract(physicalDeduct).setScale(4, RoundingMode.HALF_UP);

            // ── Targeted update: only quantity_on_hand and updated_at are written ──
            Instant now = Instant.now();
            inventoryRepository.updateQuantityOnHand(row.getId(), newQty, now);
            row.setQuantityOnHand(newQty);
            row.setUpdatedAt(now);

            lines.add(new ConsumptionLine(row.getId(), row.getBatchNo(),
                    row.getOrderToDeduction(), basePortion, physicalDeduct,
                    factor, row.getMaterialQuotaPercentage()));
            remaining = remaining.subtract(basePortion);
        }

        boolean fulfilled = remaining.compareTo(new BigDecimal("0.0001")) <= 0;
        return new ConsumptionResult(materialId, baseQty, remaining, fulfilled, lines);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Shared helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Comparator: sort inventory by {@code orderToDeduction} label alphabetically
     * ascending (null / blank → placed last), then FEFO as tiebreaker.
     */
    private static Comparator<InventoryEntity> deductionLabelComparator() {
        return Comparator
                .comparing((InventoryEntity e) ->
                        (e.getOrderToDeduction() == null || e.getOrderToDeduction().isBlank())
                                ? "\uFFFF"
                                : e.getOrderToDeduction())
                .thenComparing(e -> e.getExpirationDateTime() == null
                        ? Instant.MAX : e.getExpirationDateTime());
    }

    /**
     * Derive the quota factor for a row.
     * <ul>
     *   <li>null / 0  → 1.0 (no waste)</li>
     *   <li>100       → 1.0 (100 % pass-through, no waste)</li>
     *   <li>105       → 1.05 (5 % extra physical stock consumed)</li>
     * </ul>
     */
    private static BigDecimal quotaFactor(BigDecimal materialQuotaPercentage) {
        if (materialQuotaPercentage == null
                || materialQuotaPercentage.compareTo(BigDecimal.ZERO) == 0
                || materialQuotaPercentage.compareTo(new BigDecimal("100")) == 0) {
            return BigDecimal.ONE;
        }
        return materialQuotaPercentage.divide(new BigDecimal("100"), 10, RoundingMode.HALF_UP);
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Result types
    // ─────────────────────────────────────────────────────────────────────────

    public static class ConsumptionResult {
        private final UUID       materialId;
        private final BigDecimal requiredBaseQty;
        private final BigDecimal unfulfilledBaseQty;
        private final boolean    fulfilled;
        private final List<ConsumptionLine> lines;

        public ConsumptionResult(UUID materialId, BigDecimal requiredBaseQty,
                                 BigDecimal unfulfilledBaseQty, boolean fulfilled,
                                 List<ConsumptionLine> lines) {
            this.materialId         = materialId;
            this.requiredBaseQty    = requiredBaseQty;
            this.unfulfilledBaseQty = unfulfilledBaseQty;
            this.fulfilled          = fulfilled;
            this.lines              = lines;
        }

        public UUID getMaterialId()                  { return materialId; }
        public BigDecimal getRequiredBaseQty()       { return requiredBaseQty; }
        public BigDecimal getUnfulfilledBaseQty()    { return unfulfilledBaseQty; }
        public boolean isFulfilled()                 { return fulfilled; }
        public List<ConsumptionLine> getLines()      { return lines; }
    }

    /**
     * One inventory row's contribution to a production consumption event.
     *
     * <ul>
     *   <li>{@code baseConsumed}    — base BOM qty fulfilled by this row</li>
     *   <li>{@code physicalDeducted} — actual stock removed from quantityOnHand
     *       (= baseConsumed × quotaFactor; equals baseConsumed when factor = 1)</li>
     *   <li>{@code extraScrap}      — physicalDeducted − baseConsumed (the waste/scrap
     *       component; 0 when quotaFactor = 1)</li>
     * </ul>
     */
    public static class ConsumptionLine {
        private final UUID       inventoryId;
        private final String     batchNo;
        private final String     orderToDeductionLabel;
        private final BigDecimal baseConsumed;
        private final BigDecimal physicalDeducted;
        private final BigDecimal quotaFactor;
        private final BigDecimal materialQuotaPercentage;

        public ConsumptionLine(UUID inventoryId, String batchNo, String orderToDeductionLabel,
                               BigDecimal baseConsumed, BigDecimal physicalDeducted,
                               BigDecimal quotaFactor, BigDecimal materialQuotaPercentage) {
            this.inventoryId            = inventoryId;
            this.batchNo                = batchNo;
            this.orderToDeductionLabel  = orderToDeductionLabel;
            this.baseConsumed           = baseConsumed;
            this.physicalDeducted       = physicalDeducted;
            this.quotaFactor            = quotaFactor;
            this.materialQuotaPercentage = materialQuotaPercentage;
        }

        public UUID getInventoryId()                { return inventoryId; }
        public String getBatchNo()                  { return batchNo; }
        public String getOrderToDeductionLabel()    { return orderToDeductionLabel; }
        public BigDecimal getBaseConsumed()         { return baseConsumed; }
        public BigDecimal getPhysicalDeducted()     { return physicalDeducted; }
        /** Extra scrap/waste qty = physicalDeducted − baseConsumed. */
        public BigDecimal getExtraScrap()           { return physicalDeducted.subtract(baseConsumed); }
        public BigDecimal getQuotaFactor()          { return quotaFactor; }
        public BigDecimal getMaterialQuotaPercentage() { return materialQuotaPercentage; }
    }
}