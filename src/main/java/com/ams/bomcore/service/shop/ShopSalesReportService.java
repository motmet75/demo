package com.ams.bomcore.service.shop;

import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.InventoryMovementEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.shop.ShopMaterialAudit;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopOrderItem;
import com.ams.bomcore.repository.InventoryMovementRepository;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.ShopMaterialAuditRepository;
import com.ams.bomcore.repository.ShopOrderItemRepository;
import com.ams.bomcore.repository.ShopOrderRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ShopSalesReportService {

    private static final String REF_SHOP_ORDER = "SHOP_ORDER";

    private final ShopOrderRepository shopOrderRepository;
    private final ShopOrderItemRepository shopOrderItemRepository;
    private final ShopMaterialAuditRepository auditRepository;
    private final InventoryMovementRepository movementRepository;
    private final InventoryRepository inventoryRepository;
    private final MaterialRepository materialRepository;

    public ShopSalesReportService(ShopOrderRepository shopOrderRepository,
                                  ShopOrderItemRepository shopOrderItemRepository,
                                  ShopMaterialAuditRepository auditRepository,
                                  InventoryMovementRepository movementRepository,
                                  InventoryRepository inventoryRepository,
                                  MaterialRepository materialRepository) {
        this.shopOrderRepository = shopOrderRepository;
        this.shopOrderItemRepository = shopOrderItemRepository;
        this.auditRepository = auditRepository;
        this.movementRepository = movementRepository;
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
    }

    @Transactional(readOnly = true)
    public SalesIncomeReport report(UUID tenantId, UUID companyId, LocalDate from, LocalDate to, String periodValue, ZoneId zone) {
        ZoneId effectiveZone = zone != null ? zone : ZoneId.systemDefault();
        LocalDate endDate = to != null ? to : LocalDate.now(effectiveZone);
        LocalDate startDate = from != null ? from : endDate;
        if (endDate.isBefore(startDate)) {
            LocalDate tmp = startDate;
            startDate = endDate;
            endDate = tmp;
        }

        ReportPeriod period = parsePeriod(periodValue);
        Instant startInstant = startDate.atStartOfDay(effectiveZone).toInstant();
        Instant endInstant = endDate.plusDays(1).atStartOfDay(effectiveZone).toInstant();
        List<ShopOrder> orders = shopOrderRepository
                .findAllByTenantIdAndCompanyIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        tenantId, companyId, startInstant, endInstant)
                .stream()
                .filter(order -> !ShopOrder.STATUS_CANCELLED.equals(order.getStatus()))
                .toList();

        if (orders.isEmpty()) {
            return new SalesIncomeReport(startDate, endDate, period.name(), effectiveZone.getId(), Instant.now(),
                    new SalesSummary(0, 0, 0, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                            BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO, 0, 0),
                    List.of(), List.of(), List.of());
        }

        List<UUID> orderIds = orders.stream().map(ShopOrder::getId).toList();
        Map<UUID, ShopOrder> ordersById = orders.stream()
                .collect(Collectors.toMap(ShopOrder::getId, order -> order, (a, b) -> a, LinkedHashMap::new));

        List<ShopOrderItem> items = shopOrderItemRepository.findAllByOrderIds(orderIds);
        Map<UUID, List<ShopOrderItem>> itemsByOrder = items.stream()
                .collect(Collectors.groupingBy(item -> item.getOrder().getId(), LinkedHashMap::new, Collectors.toList()));
        Map<UUID, ShopOrderItem> itemById = items.stream()
                .collect(Collectors.toMap(ShopOrderItem::getId, item -> item, (a, b) -> a));

        List<ShopMaterialAudit> audits = auditRepository.findAllByTenantCompanyAndOrderIds(tenantId, companyId, orderIds);
        Map<UUID, Long> auditCountByOrder = audits.stream()
                .collect(Collectors.groupingBy(ShopMaterialAudit::getOrderId, Collectors.counting()));

        List<InventoryMovementEntity> movements = movementRepository
                .findAllByTenantCompanyReferenceIds(tenantId, companyId, REF_SHOP_ORDER, orderIds);
        Map<UUID, Long> movementCountByOrder = movements.stream()
                .collect(Collectors.groupingBy(InventoryMovementEntity::getReferenceId, Collectors.counting()));

        Map<UUID, InventoryEntity> inventoryById = inventoryById(movements);
        Map<UUID, String> materialUnits = materialUnits(audits, movements);

        Map<UUID, OrderMetrics> metricsByOrder = new HashMap<>();
        List<OrderRow> orderRows = new ArrayList<>();
        TotalsAccumulator summary = new TotalsAccumulator();
        Map<String, PeriodAccumulator> periodAccumulators = new TreeMap<>();

        for (ShopOrder order : orders) {
            List<ShopOrderItem> orderItems = itemsByOrder.getOrDefault(order.getId(), List.of());
            OrderMetrics metrics = orderMetrics(order, orderItems);
            metricsByOrder.put(order.getId(), metrics);
            int auditCount = auditCountByOrder.getOrDefault(order.getId(), 0L).intValue();
            int movementCount = movementCountByOrder.getOrDefault(order.getId(), 0L).intValue();
            boolean paid = ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus());

            orderRows.add(new OrderRow(order.getId(), order.getOrderCode(), order.getOrderNumber(), order.getCreatedAt(),
                    order.getCompletedAt(), order.getStatus(), order.getPaymentStatus(), order.getPaymentMethod(),
                    metrics.lineCount, metrics.itemQuantity, metrics.grossSales, metrics.discountAmount,
                    metrics.deliveryFee, metrics.netSales, metrics.rawCost, metrics.income,
                    order.getMaterialAuditStatus(), order.getMaterialDeductedAt(), auditCount, movementCount));

            summary.add(metrics, paid, auditCount, movementCount);
            PeriodBucket bucket = bucket(order.getCreatedAt(), period, effectiveZone);
            periodAccumulators.computeIfAbsent(bucket.key(), ignored -> new PeriodAccumulator(bucket))
                    .add(metrics, paid, auditCount, movementCount);
        }

        List<PeriodRow> periodRows = periodAccumulators.values().stream()
                .map(PeriodAccumulator::toRow)
                .toList();
        List<DeductionRow> deductionRows = deductionRows(audits, movements, ordersById, itemById, inventoryById,
                materialUnits, metricsByOrder);

        return new SalesIncomeReport(startDate, endDate, period.name(), effectiveZone.getId(), Instant.now(),
                summary.toSummary(), periodRows, orderRows, deductionRows);
    }

    private Map<UUID, InventoryEntity> inventoryById(List<InventoryMovementEntity> movements) {
        List<UUID> inventoryIds = movements.stream()
                .map(InventoryMovementEntity::getInventoryId)
                .filter(id -> id != null)
                .distinct()
                .toList();
        if (inventoryIds.isEmpty()) return Map.of();
        return inventoryRepository.findAllById(inventoryIds).stream()
                .collect(Collectors.toMap(InventoryEntity::getId, inventory -> inventory, (a, b) -> a));
    }

    private Map<UUID, String> materialUnits(List<ShopMaterialAudit> audits, List<InventoryMovementEntity> movements) {
        Set<UUID> materialIds = new HashSet<>();
        audits.stream().map(ShopMaterialAudit::getMaterialId).filter(id -> id != null).forEach(materialIds::add);
        movements.stream().map(this::movementMaterialId).filter(id -> id != null).forEach(materialIds::add);
        if (materialIds.isEmpty()) return Map.of();
        Map<UUID, String> units = new HashMap<>();
        for (Material material : materialRepository.findAllById(materialIds)) {
            units.put(material.getId(), material.getUnit());
        }
        return units;
    }

    private List<DeductionRow> deductionRows(List<ShopMaterialAudit> audits,
                                             List<InventoryMovementEntity> movements,
                                             Map<UUID, ShopOrder> ordersById,
                                             Map<UUID, ShopOrderItem> itemById,
                                             Map<UUID, InventoryEntity> inventoryById,
                                             Map<UUID, String> materialUnits,
                                             Map<UUID, OrderMetrics> metricsByOrder) {
        Map<MovementKey, List<InventoryMovementEntity>> movementsByOrderMaterial = movements.stream()
                .collect(Collectors.groupingBy(movement -> new MovementKey(movement.getReferenceId(), movementMaterialId(movement)),
                        LinkedHashMap::new, Collectors.toList()));
        Set<MovementKey> auditKeys = audits.stream()
                .map(audit -> new MovementKey(audit.getOrderId(), audit.getMaterialId()))
                .collect(Collectors.toSet());
        Set<MovementKey> attachedMovementKeys = new HashSet<>();
        List<DeductionRow> rows = new ArrayList<>();

        for (ShopMaterialAudit audit : audits) {
            ShopOrder order = ordersById.get(audit.getOrderId());
            if (order == null) continue;
            ShopOrderItem item = audit.getOrderItemId() == null ? null : itemById.get(audit.getOrderItemId());
            OrderMetrics metrics = metricsByOrder.get(audit.getOrderId());
            MovementKey key = new MovementKey(audit.getOrderId(), audit.getMaterialId());
            List<InventoryMovementEntity> matchingMovements = movementsByOrderMaterial.getOrDefault(key, List.of());
            if (!matchingMovements.isEmpty() && attachedMovementKeys.add(key)) {
                for (InventoryMovementEntity movement : matchingMovements) {
                    rows.add(toDeductionRow(audit, movement, order, item,
                            inventoryById.get(movement.getInventoryId()), materialUnits, metrics));
                }
            } else {
                rows.add(toDeductionRow(audit, null, order, item, null, materialUnits, metrics));
            }
        }

        for (InventoryMovementEntity movement : movements) {
            MovementKey key = new MovementKey(movement.getReferenceId(), movementMaterialId(movement));
            if (auditKeys.contains(key)) continue;
            ShopOrder order = ordersById.get(movement.getReferenceId());
            if (order == null) continue;
            rows.add(toDeductionRow(null, movement, order, null, inventoryById.get(movement.getInventoryId()),
                    materialUnits, metricsByOrder.get(order.getId())));
        }
        return rows;
    }

    private DeductionRow toDeductionRow(ShopMaterialAudit audit,
                                        InventoryMovementEntity movement,
                                        ShopOrder order,
                                        ShopOrderItem item,
                                        InventoryEntity inventory,
                                        Map<UUID, String> materialUnits,
                                        OrderMetrics metrics) {
        UUID materialId = audit != null ? audit.getMaterialId() : movementMaterialId(movement);
        String materialCode = audit != null ? audit.getMaterialCode() : movementMaterialCode(movement);
        String materialName = audit != null ? audit.getMaterialName() : movementMaterialName(movement);
        String movementUnit = movement == null ? null : movement.getUnit();
        String materialUnit = materialUnits.getOrDefault(materialId, movementUnit);
        BigDecimal movementQty = movement == null ? null : qtyNullable(movement.getQuantity());
        BigDecimal inventoryUnitPrice = inventory == null ? null : moneyNullable(inventory.getUnitPrice());
        BigDecimal inventoryCostAmount = inventoryUnitPrice != null && movementQty != null
                ? moneyNullable(inventoryUnitPrice.multiply(movementQty))
                : null;
        BigDecimal itemRawCost = itemRawCost(item);
        BigDecimal itemLineTotal = item == null ? null : moneyNullable(item.getLineTotal());
        BigDecimal itemIncome = itemLineTotal != null && itemRawCost != null ? moneyNullable(itemLineTotal.subtract(itemRawCost)) : null;

        return new DeductionRow(
                audit == null ? null : audit.getId(),
                order.getId(), order.getOrderCode(), order.getOrderNumber(), order.getCreatedAt(), order.getMaterialDeductedAt(),
                order.getStatus(), order.getPaymentStatus(),
                audit == null ? null : audit.getOrderItemId(),
                audit == null ? null : audit.getModelId(),
                audit != null ? audit.getModelName() : (item == null ? null : item.getModelName()),
                item == null ? null : qtyNullable(item.getQuantity()),
                item == null ? null : moneyNullable(item.getUnitPrice()),
                itemLineTotal,
                item == null ? null : moneyNullable(item.getUnitRawCost()),
                itemRawCost,
                itemIncome,
                item == null ? null : item.getSelectedOptions(),
                materialId, materialCode, materialName, materialUnit,
                audit == null ? null : qtyNullable(audit.getRequiredQty()),
                audit == null ? null : qtyNullable(audit.getDeductedQty()),
                audit == null ? null : qtyNullable(audit.getWaitingQty()),
                audit == null ? null : audit.getStatus(),
                audit == null ? null : audit.getCreatedAt(),
                audit == null ? null : audit.getResolvedAt(),
                movement == null ? null : movement.getId(),
                movement == null ? null : movement.getInventoryId(),
                movement == null ? null : coalesce(movement.getBatchNo(), inventory == null ? null : inventory.getBatchNo()),
                movementQty,
                movementUnit,
                movement == null ? null : movement.getMovementType(),
                movement == null ? null : movement.getCreatedAt(),
                inventoryUnitPrice,
                inventory == null ? null : inventory.getCurrency(),
                inventoryCostAmount,
                metrics == null ? BigDecimal.ZERO : metrics.grossSales,
                metrics == null ? BigDecimal.ZERO : metrics.discountAmount,
                metrics == null ? BigDecimal.ZERO : metrics.netSales,
                metrics == null ? BigDecimal.ZERO : metrics.rawCost,
                metrics == null ? BigDecimal.ZERO : metrics.income
        );
    }

    private OrderMetrics orderMetrics(ShopOrder order, List<ShopOrderItem> items) {
        BigDecimal gross = money(order.getTotalAmount());
        BigDecimal discount = money(order.getDiscountAmount());
        if (discount.compareTo(gross) > 0) discount = gross;
        BigDecimal deliveryFee = money(order.getDeliveryFee());
        BigDecimal rawCost = order.getTotalRawCost() != null ? money(order.getTotalRawCost()) : sumRawCost(items);
        BigDecimal net = money(gross.subtract(discount));
        if (net.compareTo(BigDecimal.ZERO) < 0) net = BigDecimal.ZERO;
        BigDecimal itemQuantity = qty(items.stream()
                .map(ShopOrderItem::getQuantity)
                .filter(qty -> qty != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        return new OrderMetrics(items.size(), itemQuantity, gross, discount, deliveryFee, net, rawCost, money(net.subtract(rawCost)));
    }

    private BigDecimal sumRawCost(List<ShopOrderItem> items) {
        return money(items.stream()
                .map(this::itemRawCost)
                .filter(cost -> cost != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private BigDecimal itemRawCost(ShopOrderItem item) {
        if (item == null || item.getUnitRawCost() == null || item.getQuantity() == null) return null;
        return moneyNullable(item.getUnitRawCost().multiply(item.getQuantity()));
    }

    private UUID movementMaterialId(InventoryMovementEntity movement) {
        return movement == null || movement.getMaterial() == null ? null : movement.getMaterial().getId();
    }

    private String movementMaterialCode(InventoryMovementEntity movement) {
        return movement == null || movement.getMaterial() == null ? null : movement.getMaterial().getMaterialCode();
    }

    private String movementMaterialName(InventoryMovementEntity movement) {
        return movement == null || movement.getMaterial() == null ? null : movement.getMaterial().getMaterialName();
    }

    private ReportPeriod parsePeriod(String value) {
        if (value == null || value.isBlank()) return ReportPeriod.DAY;
        try {
            return ReportPeriod.valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException ignored) {
            return ReportPeriod.DAY;
        }
    }

    private PeriodBucket bucket(Instant instant, ReportPeriod period, ZoneId zone) {
        LocalDate date = (instant != null ? instant : Instant.now()).atZone(zone).toLocalDate();
        return switch (period) {
            case DAY -> new PeriodBucket(date.toString(), date.toString(), date, date);
            case MONTH -> {
                YearMonth ym = YearMonth.from(date);
                yield new PeriodBucket(ym.toString(), ym.toString(), ym.atDay(1), ym.atEndOfMonth());
            }
            case QUARTER -> {
                int quarter = ((date.getMonthValue() - 1) / 3) + 1;
                LocalDate start = LocalDate.of(date.getYear(), (quarter - 1) * 3 + 1, 1);
                LocalDate end = start.plusMonths(3).minusDays(1);
                String key = date.getYear() + "-Q" + quarter;
                yield new PeriodBucket(key, key, start, end);
            }
            case YEAR -> {
                LocalDate start = LocalDate.of(date.getYear(), 1, 1);
                LocalDate end = LocalDate.of(date.getYear(), 12, 31);
                String key = String.valueOf(date.getYear());
                yield new PeriodBucket(key, key, start, end);
            }
        };
    }

    private static BigDecimal money(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal moneyNullable(BigDecimal value) {
        return value == null ? null : value.setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal qty(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value.setScale(4, RoundingMode.HALF_UP);
    }

    private static BigDecimal qtyNullable(BigDecimal value) {
        return value == null ? null : value.setScale(4, RoundingMode.HALF_UP);
    }

    private static String coalesce(String first, String second) {
        return first != null && !first.isBlank() ? first : second;
    }

    private enum ReportPeriod { DAY, MONTH, QUARTER, YEAR }

    private record MovementKey(UUID orderId, UUID materialId) {}
    private record PeriodBucket(String key, String label, LocalDate from, LocalDate to) {}

    private record OrderMetrics(int lineCount,
                                BigDecimal itemQuantity,
                                BigDecimal grossSales,
                                BigDecimal discountAmount,
                                BigDecimal deliveryFee,
                                BigDecimal netSales,
                                BigDecimal rawCost,
                                BigDecimal income) {}

    private static class TotalsAccumulator {
        private int orderCount;
        private int paidOrderCount;
        private int lineCount;
        private int deductionCount;
        private int movementCount;
        private BigDecimal itemQuantity = BigDecimal.ZERO;
        private BigDecimal grossSales = BigDecimal.ZERO;
        private BigDecimal discountAmount = BigDecimal.ZERO;
        private BigDecimal deliveryFee = BigDecimal.ZERO;
        private BigDecimal netSales = BigDecimal.ZERO;
        private BigDecimal rawCost = BigDecimal.ZERO;
        private BigDecimal income = BigDecimal.ZERO;

        void add(OrderMetrics metrics, boolean paid, int auditCount, int inventoryMovementCount) {
            orderCount += 1;
            if (paid) paidOrderCount += 1;
            lineCount += metrics.lineCount;
            deductionCount += auditCount;
            movementCount += inventoryMovementCount;
            itemQuantity = itemQuantity.add(metrics.itemQuantity);
            grossSales = grossSales.add(metrics.grossSales);
            discountAmount = discountAmount.add(metrics.discountAmount);
            deliveryFee = deliveryFee.add(metrics.deliveryFee);
            netSales = netSales.add(metrics.netSales);
            rawCost = rawCost.add(metrics.rawCost);
            income = income.add(metrics.income);
        }

        SalesSummary toSummary() {
            return new SalesSummary(orderCount, paidOrderCount, lineCount, qty(itemQuantity), money(grossSales),
                    money(discountAmount), money(deliveryFee), money(netSales), money(rawCost), money(income),
                    deductionCount, movementCount);
        }
    }

    private static final class PeriodAccumulator extends TotalsAccumulator {
        private final PeriodBucket bucket;

        private PeriodAccumulator(PeriodBucket bucket) {
            this.bucket = bucket;
        }

        PeriodRow toRow() {
            SalesSummary summary = toSummary();
            return new PeriodRow(bucket.key(), bucket.label(), bucket.from(), bucket.to(), summary.orderCount(),
                    summary.paidOrderCount(), summary.lineCount(), summary.itemQuantity(), summary.grossSales(),
                    summary.discountAmount(), summary.deliveryFee(), summary.netSales(), summary.rawCost(),
                    summary.income(), summary.deductionCount(), summary.movementCount());
        }
    }

    public record SalesIncomeReport(LocalDate from,
                                    LocalDate to,
                                    String period,
                                    String timeZone,
                                    Instant generatedAt,
                                    SalesSummary summary,
                                    List<PeriodRow> periodRows,
                                    List<OrderRow> orderRows,
                                    List<DeductionRow> deductionRows) {}

    public record SalesSummary(int orderCount,
                               int paidOrderCount,
                               int lineCount,
                               BigDecimal itemQuantity,
                               BigDecimal grossSales,
                               BigDecimal discountAmount,
                               BigDecimal deliveryFee,
                               BigDecimal netSales,
                               BigDecimal rawCost,
                               BigDecimal income,
                               int deductionCount,
                               int movementCount) {}

    public record PeriodRow(String periodKey,
                            String periodLabel,
                            LocalDate from,
                            LocalDate to,
                            int orderCount,
                            int paidOrderCount,
                            int lineCount,
                            BigDecimal itemQuantity,
                            BigDecimal grossSales,
                            BigDecimal discountAmount,
                            BigDecimal deliveryFee,
                            BigDecimal netSales,
                            BigDecimal rawCost,
                            BigDecimal income,
                            int deductionCount,
                            int movementCount) {}

    public record OrderRow(UUID orderId,
                           String orderCode,
                           Integer orderNumber,
                           Instant createdAt,
                           Instant completedAt,
                           String status,
                           String paymentStatus,
                           String paymentMethod,
                           int lineCount,
                           BigDecimal itemQuantity,
                           BigDecimal grossSales,
                           BigDecimal discountAmount,
                           BigDecimal deliveryFee,
                           BigDecimal netSales,
                           BigDecimal rawCost,
                           BigDecimal income,
                           String materialAuditStatus,
                           Instant materialDeductedAt,
                           int deductionCount,
                           int movementCount) {}

    public record DeductionRow(UUID auditId,
                               UUID orderId,
                               String orderCode,
                               Integer orderNumber,
                               Instant orderCreatedAt,
                               Instant materialDeductedAt,
                               String orderStatus,
                               String paymentStatus,
                               UUID orderItemId,
                               UUID modelId,
                               String modelName,
                               BigDecimal itemQuantity,
                               BigDecimal itemUnitPrice,
                               BigDecimal itemSaleAmount,
                               BigDecimal itemUnitRawCost,
                               BigDecimal itemRawCost,
                               BigDecimal itemIncome,
                               String selectedOptions,
                               UUID materialId,
                               String materialCode,
                               String materialName,
                               String materialUnit,
                               BigDecimal requiredQty,
                               BigDecimal deductedQty,
                               BigDecimal waitingQty,
                               String auditStatus,
                               Instant auditCreatedAt,
                               Instant auditResolvedAt,
                               UUID inventoryMovementId,
                               UUID inventoryId,
                               String batchNo,
                               BigDecimal movementQty,
                               String movementUnit,
                               String movementType,
                               Instant movementCreatedAt,
                               BigDecimal inventoryUnitPrice,
                               String inventoryCurrency,
                               BigDecimal inventoryCostAmount,
                               BigDecimal orderGrossSales,
                               BigDecimal orderDiscountAmount,
                               BigDecimal orderNetSales,
                               BigDecimal orderRawCost,
                               BigDecimal orderIncome) {}
}

