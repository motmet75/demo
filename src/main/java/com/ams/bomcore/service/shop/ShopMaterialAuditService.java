package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.shop.ModelMenuOption;
import com.ams.bomcore.domain.shop.ShopMaterialAudit;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopOrderItem;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.ModelMenuOptionRepository;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.repository.ShopMaterialAuditRepository;
import com.ams.bomcore.repository.ShopOrderItemRepository;
import com.ams.bomcore.repository.ShopOrderRepository;
import com.ams.bomcore.service.bom.BomService;
import com.ams.bomcore.service.inventory.OrderDeductionService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

@Service
public class ShopMaterialAuditService {

    private static final BigDecimal EPSILON = new BigDecimal("0.0001");
    private static final String REF_SHOP_ORDER = "SHOP_ORDER";
    private static final List<String> OPEN_STATUSES = List.of(
            ShopMaterialAudit.STATUS_RESERVED,
            ShopMaterialAudit.STATUS_WAITING_STOCK,
            ShopMaterialAudit.STATUS_PARTIAL
    );

    private final ShopMaterialAuditRepository auditRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final ShopOrderItemRepository shopOrderItemRepository;
    private final ModelMenuOptionRepository menuOptionRepository;
    private final ModelRepository modelRepository;
    private final InventoryRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final BomService bomService;
    private final ShopPricingService shopPricingService;
    private final OrderDeductionService orderDeductionService;

    public ShopMaterialAuditService(ShopMaterialAuditRepository auditRepository,
                                    ShopOrderRepository shopOrderRepository,
                                    ShopOrderItemRepository shopOrderItemRepository,
                                    ModelMenuOptionRepository menuOptionRepository,
                                    ModelRepository modelRepository,
                                    InventoryRepository inventoryRepository,
                                    MaterialRepository materialRepository,
                                    BomService bomService,
                                    ShopPricingService shopPricingService,
                                    OrderDeductionService orderDeductionService) {
        this.auditRepository = auditRepository;
        this.shopOrderRepository = shopOrderRepository;
        this.shopOrderItemRepository = shopOrderItemRepository;
        this.menuOptionRepository = menuOptionRepository;
        this.modelRepository = modelRepository;
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.bomService = bomService;
        this.shopPricingService = shopPricingService;
        this.orderDeductionService = orderDeductionService;
    }

    @Transactional
    public AuditResult recordOrderDemand(ShopOrder order, String source) {
        List<ShopMaterialAudit> existingRows = auditRepository.findAllByOrderIdOrderByMaterialCodeAsc(order.getId());
        boolean hasDeductedMaterial = existingRows.stream()
                .anyMatch(row -> orZero(row.getDeductedQty()).compareTo(EPSILON) > 0
                        || ShopMaterialAudit.STATUS_DEDUCTED.equals(row.getStatus()));
        if (hasDeductedMaterial) {
            return refreshExistingDemand(order, existingRows, source);
        }

        auditRepository.deleteAllByOrderId(order.getId());

        List<MaterialRequirement> requirements = buildOrderRequirements(order);
        if (requirements.isEmpty()) {
            order.setAuditMaterialLater(false);
            order.setMaterialAuditStatus(ShopMaterialAudit.STATUS_NO_BOM);
            order.setMaterialAuditNote("No active BOM material requirement found for this order.");
            order.setInventoryCheckedAt(Instant.now());
            shopOrderRepository.save(order);
            return new AuditResult(order.getId(), ShopMaterialAudit.STATUS_NO_BOM, false, BigDecimal.ZERO, List.of());
        }

        Map<UUID, BigDecimal> available = availableByMaterial(order.getTenantId(), order.getCompanyId());
        subtractOpenDemand(available, order.getTenantId(), order.getCompanyId(), order.getId());

        List<ShopMaterialAudit> rows = new ArrayList<>();
        BigDecimal totalWaiting = BigDecimal.ZERO;
        for (MaterialRequirement req : requirements) {
            BigDecimal before = positive(available.getOrDefault(req.materialId, BigDecimal.ZERO));
            BigDecimal required = scale(req.requiredQty);
            BigDecimal waiting = positive(required.subtract(before));
            BigDecimal remainingAvailable = before.subtract(required);
            available.put(req.materialId, remainingAvailable);

            ShopMaterialAudit row = new ShopMaterialAudit();
            row.setTenantId(order.getTenantId());
            row.setCompanyId(order.getCompanyId());
            row.setOrderId(order.getId());
            row.setOrderItemId(req.orderItemId);
            row.setModelId(req.modelId);
            row.setModelName(req.modelName);
            row.setOrderCode(order.getOrderCode());
            row.setOrderNumber(order.getOrderNumber());
            row.setMaterialId(req.materialId);
            row.setMaterialCode(req.materialCode);
            row.setMaterialName(req.materialName);
            row.setMaterialUnit(req.materialUnit);
            row.setRequiredQty(required);
            row.setAvailableBeforeQty(scale(before));
            row.setDeductedQty(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
            row.setWaitingQty(waiting);
            row.setStatus(waiting.compareTo(EPSILON) > 0
                    ? ShopMaterialAudit.STATUS_WAITING_STOCK
                    : ShopMaterialAudit.STATUS_RESERVED);
            row.setSource(source);
            row.setRemark(waiting.compareTo(EPSILON) > 0
                    ? "Waiting stock for " + req.materialCode + ": " + waiting.stripTrailingZeros().toPlainString()
                    : null);
            rows.add(row);
            totalWaiting = totalWaiting.add(waiting);
        }

        auditRepository.saveAll(rows);
        boolean hasShortage = totalWaiting.compareTo(EPSILON) > 0;
        order.setAuditMaterialLater(hasShortage);
        order.setMaterialAuditStatus(hasShortage ? ShopMaterialAudit.STATUS_WAITING_STOCK : ShopMaterialAudit.STATUS_RESERVED);
        order.setMaterialAuditNote(hasShortage
                ? waitingNote(rows)
                : "Material demand reserved for later deduction.");
        order.setInventoryCheckedAt(Instant.now());
        shopOrderRepository.save(order);
        enrichAuditUnits(rows);
        return new AuditResult(order.getId(), order.getMaterialAuditStatus(), hasShortage, scale(totalWaiting), rows);
    }

    private AuditResult refreshExistingDemand(ShopOrder order, List<ShopMaterialAudit> rows, String source) {
        Map<UUID, BigDecimal> available = availableByMaterial(order.getTenantId(), order.getCompanyId());
        subtractOpenDemand(available, order.getTenantId(), order.getCompanyId(), order.getId());

        BigDecimal totalWaiting = BigDecimal.ZERO;
        for (ShopMaterialAudit row : rows) {
            BigDecimal required = scale(orZero(row.getRequiredQty()));
            BigDecimal deducted = scale(orZero(row.getDeductedQty()));
            BigDecimal remaining = positive(required.subtract(deducted));
            row.setSource(source);

            if (remaining.compareTo(EPSILON) <= 0) {
                markDeducted(row);
                continue;
            }

            BigDecimal before = positive(available.getOrDefault(row.getMaterialId(), BigDecimal.ZERO));
            BigDecimal waiting = positive(remaining.subtract(before));
            available.put(row.getMaterialId(), before.subtract(remaining));
            row.setAvailableBeforeQty(scale(before));
            row.setWaitingQty(scale(waiting));

            if (waiting.compareTo(EPSILON) > 0) {
                row.setStatus(deducted.compareTo(EPSILON) > 0
                        ? ShopMaterialAudit.STATUS_PARTIAL
                        : ShopMaterialAudit.STATUS_WAITING_STOCK);
                row.setRemark("Waiting stock for " + safe(row.getMaterialCode()) + ": "
                        + waiting.stripTrailingZeros().toPlainString());
                totalWaiting = totalWaiting.add(waiting);
            } else {
                row.setStatus(ShopMaterialAudit.STATUS_RESERVED);
                row.setRemark("Material demand reserved for later deduction.");
            }
        }

        auditRepository.saveAll(rows);
        boolean hasShortage = totalWaiting.compareTo(EPSILON) > 0;
        boolean hasPartial = rows.stream().anyMatch(row -> ShopMaterialAudit.STATUS_PARTIAL.equals(row.getStatus()));
        order.setAuditMaterialLater(hasShortage);
        order.setMaterialAuditStatus(hasShortage
                ? (hasPartial ? ShopMaterialAudit.STATUS_PARTIAL : ShopMaterialAudit.STATUS_WAITING_STOCK)
                : ShopMaterialAudit.STATUS_RESERVED);
        order.setMaterialAuditNote(hasShortage
                ? waitingNote(rows)
                : "Material demand reserved for later deduction.");
        order.setInventoryCheckedAt(Instant.now());
        shopOrderRepository.save(order);
        enrichAuditUnits(rows);
        return new AuditResult(order.getId(), order.getMaterialAuditStatus(), hasShortage, scale(totalWaiting), rows);
    }
    @Transactional
    public AuditResult deductOrderMaterials(ShopOrder order, String source) {
        List<ShopMaterialAudit> rows = auditRepository.findAllByOrderIdOrderByMaterialCodeAsc(order.getId());
        if (rows.isEmpty()) {
            recordOrderDemand(order, source);
            rows = auditRepository.findAllByOrderIdOrderByMaterialCodeAsc(order.getId());
        }

        BigDecimal totalWaiting = BigDecimal.ZERO;
        for (ShopMaterialAudit row : rows) {
            if (ShopMaterialAudit.STATUS_DEDUCTED.equals(row.getStatus())
                    || ShopMaterialAudit.STATUS_NO_BOM.equals(row.getStatus())) {
                continue;
            }

            BigDecimal required = scale(orZero(row.getRequiredQty()));
            BigDecimal alreadyDeducted = scale(orZero(row.getDeductedQty()));
            BigDecimal remaining = positive(required.subtract(alreadyDeducted));
            if (remaining.compareTo(EPSILON) <= 0) {
                markDeducted(row);
                continue;
            }

            row.setAvailableBeforeQty(scale(availableForMaterial(row.getMaterialId(), row.getTenantId(), row.getCompanyId())));
            OrderDeductionService.ConsumptionResult result = orderDeductionService.consumeMaterial(
                    row.getMaterialId(), remaining, row.getTenantId(), row.getCompanyId(),
                    REF_SHOP_ORDER, order.getId(), "Shop order material deduction", null,
                    shopMovementNotes(order, row, source));

            BigDecimal unfulfilled = positive(result.getUnfulfilledBaseQty());
            BigDecimal deductedNow = positive(remaining.subtract(unfulfilled));
            row.setDeductedQty(scale(alreadyDeducted.add(deductedNow)));
            row.setWaitingQty(scale(unfulfilled));
            row.setSource(source);

            if (unfulfilled.compareTo(EPSILON) > 0) {
                row.setStatus(row.getDeductedQty().compareTo(EPSILON) > 0
                        ? ShopMaterialAudit.STATUS_PARTIAL
                        : ShopMaterialAudit.STATUS_WAITING_STOCK);
                row.setRemark("Waiting stock for " + safe(row.getMaterialCode()) + ": "
                        + unfulfilled.stripTrailingZeros().toPlainString());
                totalWaiting = totalWaiting.add(unfulfilled);
            } else {
                markDeducted(row);
            }
            auditRepository.save(row);
        }

        List<ShopMaterialAudit> refreshed = enrichAuditUnits(auditRepository.findAllByOrderIdOrderByMaterialCodeAsc(order.getId()));
        totalWaiting = refreshed.stream()
                .map(ShopMaterialAudit::getWaitingQty)
                .filter(Objects::nonNull)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        boolean hasShortage = totalWaiting.compareTo(EPSILON) > 0;
        order.setAuditMaterialLater(hasShortage);
        order.setMaterialAuditStatus(hasShortage ? ShopMaterialAudit.STATUS_PARTIAL : ShopMaterialAudit.STATUS_DEDUCTED);
        order.setMaterialAuditNote(hasShortage
                ? waitingNote(refreshed)
                : "Material deducted from real inventory.");
        order.setMaterialDeductedAt(Instant.now());
        shopOrderRepository.save(order);
        return new AuditResult(order.getId(), order.getMaterialAuditStatus(), hasShortage, scale(totalWaiting), refreshed);
    }

    @Transactional(readOnly = true)
    public List<ShopMaterialAudit> listOrderAudit(UUID orderId, UUID tenantId, UUID companyId) {
        return enrichAuditUnits(auditRepository.findAllByOrderIdOrderByMaterialCodeAsc(orderId).stream()
                .filter(row -> tenantId.equals(row.getTenantId()) && companyId.equals(row.getCompanyId()))
                .toList());
    }

    @Transactional(readOnly = true)
    public List<ShopMaterialAudit> listOpenAudit(UUID tenantId, UUID companyId) {
        return enrichAuditUnits(auditRepository.findAllByTenantIdAndCompanyIdAndStatusInOrderByCreatedAtDesc(
                tenantId, companyId, OPEN_STATUSES));
    }

    @Transactional(readOnly = true)
    public List<MaterialUsageReportRow> report(UUID tenantId, UUID companyId, Instant from, Instant to) {
        List<ShopMaterialAudit> rows = auditRepository
                .findAllByTenantIdAndCompanyIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        tenantId, companyId, from, to);
        Map<UUID, String> units = unitByMaterial(materialIds(rows));
        Map<UUID, ReportAccumulator> acc = new LinkedHashMap<>();
        for (ShopMaterialAudit row : rows) {
            ReportAccumulator a = acc.computeIfAbsent(row.getMaterialId(),
                    ignored -> new ReportAccumulator(row.getMaterialId(), row.getMaterialCode(), row.getMaterialName(),
                            units.getOrDefault(row.getMaterialId(), "pcs")));
            a.requiredQty = a.requiredQty.add(orZero(row.getRequiredQty()));
            a.deductedQty = a.deductedQty.add(orZero(row.getDeductedQty()));
            a.waitingQty = a.waitingQty.add(orZero(row.getWaitingQty()));
            a.orderIds.add(row.getOrderId());
        }
        return acc.values().stream()
                .map(a -> new MaterialUsageReportRow(a.materialId, a.materialCode, a.materialName,
                        a.materialUnit, scale(a.requiredQty), scale(a.deductedQty), scale(a.waitingQty), a.orderIds.size()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MenuAvailabilityRow> menuAvailability(UUID tenantId, UUID companyId) {
        return menuAvailability(tenantId, companyId, LocalDate.now());
    }

    @Transactional(readOnly = true)
    public List<MenuAvailabilityRow> menuAvailability(UUID tenantId, UUID companyId, LocalDate businessDate) {
        Map<UUID, BigDecimal> available = availableByMaterial(tenantId, companyId);
        subtractOpenDemand(available, tenantId, companyId, null);
        LocalDate effectiveDate = businessDate != null ? businessDate : LocalDate.now();

        return modelRepository.findAllByTenantIdAndCompanyId(tenantId, companyId).stream()
                .filter(model -> model.getSellingPrice() != null && Boolean.TRUE.equals(model.getIsActive()))
                .map(model -> availabilityForModel(model, tenantId, companyId, available, effectiveDate))
                .toList();
    }

    @Transactional
    public MenuAvailabilityRow updateAvailabilityOverride(UUID modelId, BigDecimal units, UUID tenantId, UUID companyId) {
        return updateAvailabilityOverride(modelId, units, tenantId, companyId, LocalDate.now());
    }

    @Transactional
    public MenuAvailabilityRow updateAvailabilityOverride(UUID modelId, BigDecimal units, UUID tenantId, UUID companyId, LocalDate businessDate) {
        Model model = modelRepository.findById(modelId)
                .orElseThrow(() -> new IllegalArgumentException("Model not found: " + modelId));
        if (!tenantId.equals(model.getTenantId()) || !companyId.equals(model.getCompanyId())) {
            throw new IllegalArgumentException("Model does not belong to this company");
        }
        LocalDate effectiveDate = businessDate != null ? businessDate : LocalDate.now();
        BigDecimal storedDailyCap = null;
        if (units != null) {
            /*
             * Counter/iPad screens collect "left units" for the rest of today.
             * The order validator works from a daily cap and subtracts already-sold
             * quantity, so persist sold-so-far + requested remaining. This keeps
             * the UI intuitive while preserving automatic countdown after orders.
             */
            storedDailyCap = orZero(soldToday(modelId, tenantId, companyId, effectiveDate)).add(units);
        }
        model.setShopAvailableUnitsOverride(storedDailyCap);
        model.setShopAvailableUnitsOverrideDate(units != null ? effectiveDate : null);
        modelRepository.save(model);
        Map<UUID, BigDecimal> available = availableByMaterial(tenantId, companyId);
        subtractOpenDemand(available, tenantId, companyId, null);
        return availabilityForModel(model, tenantId, companyId, available, effectiveDate);
    }

    private MenuAvailabilityRow availabilityForModel(Model model, UUID tenantId, UUID companyId,
                                                     Map<UUID, BigDecimal> availableByMaterial) {
        return availabilityForModel(model, tenantId, companyId, availableByMaterial, LocalDate.now());
    }

    private MenuAvailabilityRow availabilityForModel(Model model, UUID tenantId, UUID companyId,
                                                     Map<UUID, BigDecimal> availableByMaterial,
                                                     LocalDate businessDate) {
        BigDecimal dailyLimit = todayOverride(model, businessDate);
        BigDecimal soldToday = dailyLimit != null ? soldToday(model.getId(), tenantId, companyId, businessDate) : null;
        BigDecimal remainingToday = dailyLimit != null ? dailyLimit.subtract(orZero(soldToday)).max(BigDecimal.ZERO) : null;
        BigDecimal manualRemainingUnits = dailyLimit != null ? remainingToday : null;
        Map<UUID, MaterialRequirement> perUnit = buildModelRequirements(model, tenantId, companyId);
        if (perUnit.isEmpty()) {
            BigDecimal effective = dailyLimit != null ? remainingToday : null;
            return new MenuAvailabilityRow(model.getId(), model.getModelCode(), model.getModelName(),
                    null, manualRemainingUnits, effective,
                    false, List.of(), dailyLimit, soldToday, remainingToday);
        }

        BigDecimal calculated = null;
        List<MaterialLimitRow> limits = new ArrayList<>();
        for (MaterialRequirement req : perUnit.values()) {
            BigDecimal requiredPerUnit = scale(req.requiredQty);
            if (requiredPerUnit.compareTo(EPSILON) <= 0) continue;
            BigDecimal available = positive(availableByMaterial.getOrDefault(req.materialId, BigDecimal.ZERO));
            BigDecimal possible = available.divide(requiredPerUnit, 0, RoundingMode.DOWN);
            if (calculated == null || possible.compareTo(calculated) < 0) {
                calculated = possible;
            }
            limits.add(new MaterialLimitRow(req.materialId, req.materialCode, req.materialName, req.materialUnit,
                    requiredPerUnit, scale(available), possible));
        }

        BigDecimal effective = dailyLimit != null ? remainingToday : calculated;
        return new MenuAvailabilityRow(model.getId(), model.getModelCode(), model.getModelName(),
                calculated, manualRemainingUnits, effective, true, limits, dailyLimit, soldToday, remainingToday);
    }

    private BigDecimal todayOverride(Model model, LocalDate businessDate) {
        BigDecimal units = model.getShopAvailableUnitsOverride();
        if (units == null) return null;
        LocalDate date = model.getShopAvailableUnitsOverrideDate();
        if (date == null) return null;
        LocalDate effectiveDate = businessDate != null ? businessDate : LocalDate.now();
        return !date.isAfter(effectiveDate) ? units : null;
    }

    private BigDecimal soldToday(UUID modelId, UUID tenantId, UUID companyId, LocalDate businessDate) {
        LocalDate effectiveDate = businessDate != null ? businessDate : LocalDate.now();
        java.time.ZoneId zone = java.time.ZoneId.systemDefault();
        Instant from = effectiveDate.atStartOfDay(zone).toInstant();
        Instant to = effectiveDate.plusDays(1).atStartOfDay(zone).toInstant();
        return orZero(shopOrderItemRepository.sumSoldQuantityForModelInDay(modelId, tenantId, companyId, from, to, null));
    }

    private List<MaterialRequirement> buildOrderRequirements(ShopOrder order) {
        Map<RequirementKey, MaterialRequirement> requirements = new LinkedHashMap<>();
        List<ShopOrderItem> items = shopOrderItemRepository.findAllByOrder_Id(order.getId());
        for (ShopOrderItem item : items) {
            if (item.getModel() == null) continue;

            UUID baseModelId = item.getModel().getId();
            List<ModelMenuOption> optionGroups = menuOptionRepository
                    .findAllByModelIdAndTenantIdAndCompanyIdOrderByDisplayOrderAsc(
                            baseModelId, order.getTenantId(), order.getCompanyId());
            UUID bomModelId = shopPricingService.resolveEffectiveBomModel(
                    baseModelId, item.getSelectedOptions(), optionGroups);
            var bomOpt = bomService.getActiveBomForModel(bomModelId, order.getTenantId());
            if (bomOpt.isEmpty()) continue;

            List<BomItemEntity> bomItems = bomService.getBomItems(
                    bomOpt.get().getId(), order.getTenantId(), order.getCompanyId());
            BomTree tree = buildTree(bomItems);
            collectOrderRequirements(tree.roots, BigDecimal.ONE, tree.children, item, requirements);
        }
        return new ArrayList<>(requirements.values());
    }

    private Map<UUID, MaterialRequirement> buildModelRequirements(Model model, UUID tenantId, UUID companyId) {
        Map<UUID, MaterialRequirement> requirements = new LinkedHashMap<>();
        var bomOpt = bomService.getActiveBomForModel(model.getId(), tenantId);
        if (bomOpt.isEmpty()) return requirements;

        List<BomItemEntity> bomItems = bomService.getBomItems(bomOpt.get().getId(), tenantId, companyId);
        BomTree tree = buildTree(bomItems);
        collectModelRequirements(tree.roots, BigDecimal.ONE, tree.children, model, requirements);
        return requirements;
    }

    private void collectOrderRequirements(List<BomItemEntity> nodes, BigDecimal parentMultiplier,
                                          Map<UUID, List<BomItemEntity>> childMap,
                                          ShopOrderItem item,
                                          Map<RequirementKey, MaterialRequirement> requirements) {
        BigDecimal itemQty = item.getQuantity() != null ? item.getQuantity() : BigDecimal.ONE;
        for (BomItemEntity node : nodes) {
            addOrderRequirement(item, node, parentMultiplier.multiply(itemQty), requirements);
            List<BomItemEntity> children = childMap.get(node.getId());
            if (children != null && !children.isEmpty()) {
                collectOrderRequirements(children, parentMultiplier.multiply(node.getQuantity()), childMap, item, requirements);
            }
        }
    }

    private void collectModelRequirements(List<BomItemEntity> nodes, BigDecimal parentMultiplier,
                                          Map<UUID, List<BomItemEntity>> childMap,
                                          Model model,
                                          Map<UUID, MaterialRequirement> requirements) {
        for (BomItemEntity node : nodes) {
            addModelRequirement(model, node, parentMultiplier, requirements);
            List<BomItemEntity> children = childMap.get(node.getId());
            if (children != null && !children.isEmpty()) {
                collectModelRequirements(children, parentMultiplier.multiply(node.getQuantity()), childMap, model, requirements);
            }
        }
    }

    private void addOrderRequirement(ShopOrderItem item, BomItemEntity node, BigDecimal multiplier,
                                     Map<RequirementKey, MaterialRequirement> requirements) {
        if (node.getMaterial() == null || node.getQuantity() == null) return;
        UUID materialId = node.getMaterial().getId();
        RequirementKey key = new RequirementKey(item.getId(), materialId);
        MaterialRequirement req = requirements.computeIfAbsent(key,
                ignored -> MaterialRequirement.forItem(item, node));
        req.requiredQty = req.requiredQty.add(node.getQuantity().multiply(multiplier));
    }

    private void addModelRequirement(Model model, BomItemEntity node, BigDecimal multiplier,
                                     Map<UUID, MaterialRequirement> requirements) {
        if (node.getMaterial() == null || node.getQuantity() == null) return;
        UUID materialId = node.getMaterial().getId();
        MaterialRequirement req = requirements.computeIfAbsent(materialId,
                ignored -> MaterialRequirement.forModel(model, node));
        req.requiredQty = req.requiredQty.add(node.getQuantity().multiply(multiplier));
    }

    private BomTree buildTree(List<BomItemEntity> bomItems) {
        Map<UUID, List<BomItemEntity>> children = new HashMap<>();
        List<BomItemEntity> roots = new ArrayList<>();
        for (BomItemEntity bi : bomItems) {
            if (bi.getParentItem() == null) {
                roots.add(bi);
            } else {
                children.computeIfAbsent(bi.getParentItem().getId(), ignored -> new ArrayList<>()).add(bi);
            }
        }
        return new BomTree(roots, children);
    }

    private Map<UUID, BigDecimal> availableByMaterial(UUID tenantId, UUID companyId) {
        Map<UUID, BigDecimal> available = new HashMap<>();
        for (InventoryEntity inv : inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId)) {
            if (inv.getMaterial() == null || !Boolean.TRUE.equals(inv.getVisible()) || Boolean.TRUE.equals(inv.getLocked())) {
                continue;
            }
            BigDecimal usable = orZero(inv.getQuantityOnHand()).subtract(orZero(inv.getQuantityLocked()));
            available.merge(inv.getMaterial().getId(), usable, BigDecimal::add);
        }
        return available;
    }

    private BigDecimal availableForMaterial(UUID materialId, UUID tenantId, UUID companyId) {
        return availableByMaterial(tenantId, companyId).getOrDefault(materialId, BigDecimal.ZERO);
    }

    private List<ShopMaterialAudit> enrichAuditUnits(List<ShopMaterialAudit> rows) {
        Map<UUID, String> units = unitByMaterial(materialIds(rows));
        for (ShopMaterialAudit row : rows) {
            row.setMaterialUnit(units.getOrDefault(row.getMaterialId(), "pcs"));
        }
        return rows;
    }

    private Set<UUID> materialIds(List<ShopMaterialAudit> rows) {
        Set<UUID> ids = new HashSet<>();
        for (ShopMaterialAudit row : rows) {
            if (row.getMaterialId() != null) {
                ids.add(row.getMaterialId());
            }
        }
        return ids;
    }

    private Map<UUID, String> unitByMaterial(Set<UUID> materialIds) {
        if (materialIds == null || materialIds.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> units = new HashMap<>();
        for (Material material : materialRepository.findAllById(materialIds)) {
            units.put(material.getId(), unitFor(material));
        }
        return units;
    }

    private void subtractOpenDemand(Map<UUID, BigDecimal> available, UUID tenantId, UUID companyId, UUID excludeOrderId) {
        for (ShopMaterialAudit row : auditRepository.findOpenDemand(tenantId, companyId, OPEN_STATUSES, excludeOrderId)) {
            BigDecimal outstanding = positive(orZero(row.getRequiredQty()).subtract(orZero(row.getDeductedQty())));
            available.merge(row.getMaterialId(), outstanding.negate(), BigDecimal::add);
        }
    }

    private void markDeducted(ShopMaterialAudit row) {
        row.setWaitingQty(BigDecimal.ZERO.setScale(4, RoundingMode.HALF_UP));
        row.setStatus(ShopMaterialAudit.STATUS_DEDUCTED);
        row.setResolvedAt(Instant.now());
        row.setRemark("Deducted from real inventory.");
    }

    private String shopMovementNotes(ShopOrder order, ShopMaterialAudit row, String source) {
        String orderLabel = order.getOrderNumber() != null
                ? "#" + order.getOrderNumber()
                : safe(order.getOrderCode());
        return "Shop order " + orderLabel
                + "; source=" + safe(source)
                + "; material=" + safe(row.getMaterialCode());
    }

    private String waitingNote(List<ShopMaterialAudit> rows) {
        return rows.stream()
                .filter(row -> orZero(row.getWaitingQty()).compareTo(EPSILON) > 0)
                .map(row -> safe(row.getMaterialCode()) + " waiting " + scale(row.getWaitingQty()).stripTrailingZeros().toPlainString())
                .limit(6)
                .reduce((a, b) -> a + "; " + b)
                .orElse("Waiting stock material audit later.");
    }

    private static String safe(String value) {
        return value != null && !value.isBlank() ? value : "material";
    }

    private static String unitFor(Material material) {
        if (material != null && material.getUnit() != null && !material.getUnit().isBlank()) {
            return material.getUnit().trim();
        }
        return "pcs";
    }

    private static BigDecimal orZero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private static BigDecimal positive(BigDecimal value) {
        return value.compareTo(BigDecimal.ZERO) < 0 ? BigDecimal.ZERO : value;
    }

    private static BigDecimal scale(BigDecimal value) {
        return orZero(value).setScale(4, RoundingMode.HALF_UP);
    }

    public record AuditResult(UUID orderId, String status, boolean auditMaterialLater,
                              BigDecimal waitingQty, List<ShopMaterialAudit> rows) {}

    public record MaterialUsageReportRow(UUID materialId, String materialCode, String materialName,
                                         String materialUnit,
                                         BigDecimal requiredQty, BigDecimal deductedQty,
                                         BigDecimal waitingQty, int orderCount) {}

    public record MenuAvailabilityRow(UUID modelId, String modelCode, String modelName,
                                      BigDecimal calculatedAvailableUnits,
                                      BigDecimal manualAvailableUnits,
                                      BigDecimal effectiveAvailableUnits,
                                      boolean hasBom,
                                      List<MaterialLimitRow> materialLimits,
                                      BigDecimal dailyLimitUnits,
                                      BigDecimal dailySoldUnits,
                                      BigDecimal dailyRemainingUnits) {}

    public record MaterialLimitRow(UUID materialId, String materialCode, String materialName,
                                   String materialUnit,
                                   BigDecimal requiredPerUnit, BigDecimal availableQty,
                                   BigDecimal possibleUnits) {}

    private record BomTree(List<BomItemEntity> roots, Map<UUID, List<BomItemEntity>> children) {}

    private record RequirementKey(UUID orderItemId, UUID materialId) {}

    private static class ReportAccumulator {
        private final UUID materialId;
        private final String materialCode;
        private final String materialName;
        private final String materialUnit;
        private BigDecimal requiredQty = BigDecimal.ZERO;
        private BigDecimal deductedQty = BigDecimal.ZERO;
        private BigDecimal waitingQty = BigDecimal.ZERO;
        private final Set<UUID> orderIds = new HashSet<>();

        private ReportAccumulator(UUID materialId, String materialCode, String materialName, String materialUnit) {
            this.materialId = materialId;
            this.materialCode = materialCode;
            this.materialName = materialName;
            this.materialUnit = materialUnit;
        }
    }

    private static class MaterialRequirement {
        private UUID orderItemId;
        private UUID modelId;
        private String modelName;
        private UUID materialId;
        private String materialCode;
        private String materialName;
        private String materialUnit;
        private BigDecimal requiredQty = BigDecimal.ZERO;

        private static MaterialRequirement forItem(ShopOrderItem item, BomItemEntity node) {
            MaterialRequirement req = base(node);
            req.orderItemId = item.getId();
            if (item.getModel() != null) {
                req.modelId = item.getModel().getId();
                req.modelName = item.getModelName();
            }
            return req;
        }

        private static MaterialRequirement forModel(Model model, BomItemEntity node) {
            MaterialRequirement req = base(node);
            req.modelId = model.getId();
            req.modelName = model.getModelName();
            return req;
        }

        private static MaterialRequirement base(BomItemEntity node) {
            MaterialRequirement req = new MaterialRequirement();
            req.materialId = node.getMaterial().getId();
            req.materialCode = node.getMaterial().getMaterialCode();
            req.materialName = node.getMaterial().getMaterialName();
            req.materialUnit = unitFor(node.getMaterial());
            return req;
        }
    }
}
