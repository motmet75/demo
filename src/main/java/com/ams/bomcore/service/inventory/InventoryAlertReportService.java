package com.ams.bomcore.service.inventory;

import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.OrderConsumptionLogEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.shop.ShopMaterialAudit;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.OrderConsumptionLogRepository;
import com.ams.bomcore.repository.ShopMaterialAuditRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class InventoryAlertReportService {

    private static final ZoneId REPORT_ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final List<String> OPEN_AUDIT_STATUSES = List.of(
            ShopMaterialAudit.STATUS_RESERVED,
            ShopMaterialAudit.STATUS_WAITING_STOCK,
            ShopMaterialAudit.STATUS_PARTIAL
    );

    private final InventoryRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final ShopMaterialAuditRepository shopMaterialAuditRepository;
    private final OrderConsumptionLogRepository orderConsumptionLogRepository;

    public InventoryAlertReportService(InventoryRepository inventoryRepository,
                                       MaterialRepository materialRepository,
                                       ShopMaterialAuditRepository shopMaterialAuditRepository,
                                       OrderConsumptionLogRepository orderConsumptionLogRepository) {
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.shopMaterialAuditRepository = shopMaterialAuditRepository;
        this.orderConsumptionLogRepository = orderConsumptionLogRepository;
    }

    @Transactional(readOnly = true)
    public InventoryAlertReport buildReport(UUID tenantId, UUID companyId, LocalDate targetDate,
                                            Integer lookbackDays, Integer forecastDays,
                                            String forecastMode, Integer expirationDays) {
        LocalDate effectiveTargetDate = targetDate != null ? targetDate : LocalDate.now(REPORT_ZONE).plusDays(1);
        int effectiveLookbackDays = clamp(lookbackDays == null ? 28 : lookbackDays, 1, 365);
        int effectiveForecastDays = clamp(forecastDays == null ? 1 : forecastDays, 1, 30);
        int effectiveExpirationDays = clamp(expirationDays == null ? 30 : expirationDays, 0, 3650);
        ForecastMode mode = ForecastMode.from(forecastMode);

        LocalDate historyStart = effectiveTargetDate.minusDays(effectiveLookbackDays);
        LocalDate historyEnd = effectiveTargetDate;
        Instant historyStartInstant = historyStart.atStartOfDay(REPORT_ZONE).toInstant();
        Instant historyEndInstant = historyEnd.atStartOfDay(REPORT_ZONE).toInstant();

        Map<UUID, MaterialAccumulator> materials = new LinkedHashMap<>();
        for (Material material : materialRepository.findAllByTenantIdAndCompanyId(tenantId, companyId)) {
            materials.put(material.getId(), MaterialAccumulator.from(material));
        }

        List<ExpirationRow> expirationRows = new ArrayList<>();
        LocalDate today = LocalDate.now(REPORT_ZONE);
        LocalDate expirationCutoff = today.plusDays(effectiveExpirationDays);
        for (InventoryEntity inventory : inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId)) {
            if (inventory.getMaterial() == null || !Boolean.TRUE.equals(inventory.getVisible())) {
                continue;
            }
            Material material = inventory.getMaterial();
            MaterialAccumulator acc = materials.computeIfAbsent(material.getId(), ignored -> MaterialAccumulator.from(material));
            BigDecimal onHand = orZero(inventory.getQuantityOnHand());
            BigDecimal locked = orZero(inventory.getQuantityLocked());
            BigDecimal available = onHand.subtract(locked);
            acc.quantityOnHand = acc.quantityOnHand.add(onHand);
            acc.quantityLocked = acc.quantityLocked.add(locked);
            acc.availableQty = acc.availableQty.add(available);
            acc.quantityTotal = acc.quantityTotal.add(orZero(inventory.getQuantityTotal()));
            acc.batchCount++;

            if (inventory.getExpirationDateTime() != null && onHand.compareTo(BigDecimal.ZERO) > 0) {
                LocalDate expirationDate = inventory.getExpirationDateTime().atZone(REPORT_ZONE).toLocalDate();
                if (!expirationDate.isAfter(expirationCutoff)) {
                    long daysUntilExpiration = ChronoUnit.DAYS.between(today, expirationDate);
                    expirationRows.add(new ExpirationRow(
                            inventory.getId(),
                            material.getId(),
                            material.getMaterialCode(),
                            material.getMaterialName(),
                            unitFor(material),
                            inventory.getWarehouse() != null ? inventory.getWarehouse().getCode() : null,
                            inventory.getWarehouse() != null ? inventory.getWarehouse().getName() : null,
                            inventory.getBatchNo(),
                            scale(onHand),
                            scale(available),
                            inventory.getExpirationDateTime(),
                            daysUntilExpiration,
                            daysUntilExpiration < 0 ? "EXPIRED" : "EXPIRING"
                    ));
                }
            }
        }

        addOpenDemand(materials, tenantId, companyId);

        Map<UUID, Map<LocalDate, BigDecimal>> usageByMaterialDate =
                loadUsageByMaterialDate(tenantId, companyId, historyStartInstant, historyEndInstant);
        List<LocalDate> sampleDates = sampleDates(historyStart, historyEnd, effectiveTargetDate, mode);

        List<MaterialAlertRow> materialRows = new ArrayList<>();
        int lowStockCount = 0;
        int forecastShortageCount = 0;
        BigDecimal totalForecastShortage = BigDecimal.ZERO;

        for (MaterialAccumulator acc : materials.values()) {
            Map<LocalDate, BigDecimal> usageByDate = usageByMaterialDate.getOrDefault(acc.materialId, Map.of());
            BigDecimal historicalUsageQty = BigDecimal.ZERO;
            int sourceDaysWithUsage = 0;
            for (LocalDate sampleDate : sampleDates) {
                BigDecimal dayUsage = usageByDate.getOrDefault(sampleDate, BigDecimal.ZERO);
                historicalUsageQty = historicalUsageQty.add(dayUsage);
                if (dayUsage.compareTo(BigDecimal.ZERO) > 0) {
                    sourceDaysWithUsage++;
                }
            }

            int sampleDayCount = Math.max(sampleDates.size(), 1);
            BigDecimal forecastQty = historicalUsageQty
                    .divide(BigDecimal.valueOf(sampleDayCount), 6, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(effectiveForecastDays));
            BigDecimal netAvailable = acc.availableQty.subtract(acc.committedQty);
            BigDecimal availablePercentage = percentage(netAvailable, acc.quantityTotal);

            boolean enabled = acc.inventoryAlertEnabled == null || Boolean.TRUE.equals(acc.inventoryAlertEnabled);
            boolean qtyAlert = enabled && acc.inventoryAlertQuantity != null
                    && netAvailable.compareTo(acc.inventoryAlertQuantity) <= 0;
            boolean percentageAlert = enabled && acc.inventoryAlertPercentage != null
                    && availablePercentage != null
                    && availablePercentage.compareTo(acc.inventoryAlertPercentage) <= 0;
            boolean negativeNetAlert = netAvailable.compareTo(BigDecimal.ZERO) < 0;
            boolean lowStockAlert = qtyAlert || percentageAlert || negativeNetAlert;
            if (lowStockAlert) {
                lowStockCount++;
            }

            BigDecimal forecastShortageQty = positive(forecastQty.subtract(netAvailable));
            boolean forecastShortage = forecastShortageQty.compareTo(BigDecimal.ZERO) > 0;
            if (forecastShortage) {
                forecastShortageCount++;
                totalForecastShortage = totalForecastShortage.add(forecastShortageQty);
            }

            materialRows.add(new MaterialAlertRow(
                    acc.materialId,
                    acc.materialCode,
                    acc.materialName,
                    acc.unit,
                    scale(acc.quantityOnHand),
                    scale(acc.quantityLocked),
                    scale(acc.availableQty),
                    scale(acc.committedQty),
                    scale(netAvailable),
                    scale(acc.quantityTotal),
                    scaleNullable(availablePercentage),
                    acc.inventoryAlertEnabled,
                    scaleNullable(acc.inventoryAlertQuantity),
                    scaleNullable(acc.inventoryAlertPercentage),
                    lowStockAlert,
                    lowStockReason(qtyAlert, percentageAlert, negativeNetAlert),
                    scale(historicalUsageQty),
                    sampleDayCount,
                    sourceDaysWithUsage,
                    scale(forecastQty),
                    scale(forecastShortageQty),
                    forecastShortage,
                    mode.label(),
                    acc.batchCount
            ));
        }

        materialRows.sort(Comparator
                .comparing(MaterialAlertRow::forecastShortage).reversed()
                .thenComparing(MaterialAlertRow::lowStockAlert).reversed()
                .thenComparing(MaterialAlertRow::materialCode, Comparator.nullsLast(String::compareToIgnoreCase)));
        expirationRows.sort(Comparator
                .comparingLong(ExpirationRow::daysUntilExpiration)
                .thenComparing(ExpirationRow::materialCode, Comparator.nullsLast(String::compareToIgnoreCase)));

        Summary summary = new Summary(
                materialRows.size(),
                lowStockCount,
                forecastShortageCount,
                expirationRows.size(),
                scale(totalForecastShortage)
        );

        return new InventoryAlertReport(
                Instant.now(),
                effectiveTargetDate,
                effectiveLookbackDays,
                effectiveForecastDays,
                mode.name(),
                mode.label(),
                effectiveExpirationDays,
                summary,
                materialRows,
                expirationRows
        );
    }

    private void addOpenDemand(Map<UUID, MaterialAccumulator> materials, UUID tenantId, UUID companyId) {
        for (ShopMaterialAudit row : shopMaterialAuditRepository.findOpenDemand(
                tenantId, companyId, OPEN_AUDIT_STATUSES, null)) {
            if (row.getMaterialId() == null) {
                continue;
            }
            MaterialAccumulator acc = materials.computeIfAbsent(row.getMaterialId(), ignored -> MaterialAccumulator.from(row));
            BigDecimal outstanding = positive(orZero(row.getRequiredQty()).subtract(orZero(row.getDeductedQty())));
            acc.committedQty = acc.committedQty.add(outstanding);
        }
    }

    private Map<UUID, Map<LocalDate, BigDecimal>> loadUsageByMaterialDate(UUID tenantId, UUID companyId,
                                                                           Instant from, Instant to) {
        Map<UUID, Map<LocalDate, BigDecimal>> usage = new HashMap<>();

        for (ShopMaterialAudit row : shopMaterialAuditRepository
                .findAllByTenantIdAndCompanyIdAndCreatedAtGreaterThanEqualAndCreatedAtLessThanOrderByCreatedAtDesc(
                        tenantId, companyId, from, to)) {
            if (row.getMaterialId() == null || row.getCreatedAt() == null) {
                continue;
            }
            BigDecimal qty = orZero(row.getRequiredQty());
            if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                qty = orZero(row.getDeductedQty());
            }
            addUsage(usage, row.getMaterialId(), row.getCreatedAt(), qty);
        }

        for (OrderConsumptionLogEntity row : orderConsumptionLogRepository
                .findForecastUsageRows(tenantId, companyId, from, to)) {
            if (row.getMaterial() == null || row.getCreatedAt() == null) {
                continue;
            }
            BigDecimal qty = orZero(row.getRealConsumptionQty());
            if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                qty = orZero(row.getEffectivePlannedQty());
            }
            if (qty.compareTo(BigDecimal.ZERO) <= 0) {
                qty = orZero(row.getPlannedQty());
            }
            addUsage(usage, row.getMaterial().getId(), row.getCreatedAt(), qty);
        }

        return usage;
    }

    private void addUsage(Map<UUID, Map<LocalDate, BigDecimal>> usage, UUID materialId, Instant createdAt,
                          BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
            return;
        }
        LocalDate date = createdAt.atZone(REPORT_ZONE).toLocalDate();
        usage.computeIfAbsent(materialId, ignored -> new HashMap<>())
                .merge(date, qty, BigDecimal::add);
    }

    private List<LocalDate> sampleDates(LocalDate startInclusive, LocalDate endExclusive, LocalDate targetDate,
                                        ForecastMode mode) {
        List<LocalDate> dates = new ArrayList<>();
        for (LocalDate date = startInclusive; date.isBefore(endExclusive); date = date.plusDays(1)) {
            if (mode.matches(date, targetDate)) {
                dates.add(date);
            }
        }
        return dates;
    }

    private String lowStockReason(boolean qtyAlert, boolean percentageAlert, boolean negativeNetAlert) {
        if (negativeNetAlert) {
            return "OPEN_DEMAND_EXCEEDS_AVAILABLE";
        }
        if (qtyAlert && percentageAlert) {
            return "QTY_AND_PERCENTAGE";
        }
        if (qtyAlert) {
            return "QTY";
        }
        if (percentageAlert) {
            return "PERCENTAGE";
        }
        return null;
    }

    private BigDecimal percentage(BigDecimal numerator, BigDecimal denominator) {
        if (denominator == null || denominator.compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        return numerator.multiply(ONE_HUNDRED).divide(denominator, 6, RoundingMode.HALF_UP);
    }

    private int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
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

    private static BigDecimal scaleNullable(BigDecimal value) {
        return value == null ? null : scale(value);
    }

    private static String unitFor(Material material) {
        if (material != null && material.getUnit() != null && !material.getUnit().isBlank()) {
            return material.getUnit().trim();
        }
        return "pcs";
    }

    private enum ForecastMode {
        DAILY_AVG("Daily average"),
        SAME_WEEKDAY("Same weekday"),
        WEEKEND_PATTERN("Weekend or weekday");

        private final String label;

        ForecastMode(String label) {
            this.label = label;
        }

        static ForecastMode from(String value) {
            if (value == null || value.isBlank()) {
                return DAILY_AVG;
            }
            try {
                return ForecastMode.valueOf(value.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                return DAILY_AVG;
            }
        }

        String label() {
            return label;
        }

        boolean matches(LocalDate date, LocalDate targetDate) {
            return switch (this) {
                case SAME_WEEKDAY -> date.getDayOfWeek() == targetDate.getDayOfWeek();
                case WEEKEND_PATTERN -> isWeekend(date) == isWeekend(targetDate);
                case DAILY_AVG -> true;
            };
        }

        private static boolean isWeekend(LocalDate date) {
            DayOfWeek day = date.getDayOfWeek();
            return day == DayOfWeek.SATURDAY || day == DayOfWeek.SUNDAY;
        }
    }

    private static class MaterialAccumulator {
        private UUID materialId;
        private String materialCode;
        private String materialName;
        private String unit;
        private Boolean inventoryAlertEnabled = Boolean.TRUE;
        private BigDecimal inventoryAlertQuantity;
        private BigDecimal inventoryAlertPercentage;
        private BigDecimal quantityOnHand = BigDecimal.ZERO;
        private BigDecimal quantityLocked = BigDecimal.ZERO;
        private BigDecimal availableQty = BigDecimal.ZERO;
        private BigDecimal committedQty = BigDecimal.ZERO;
        private BigDecimal quantityTotal = BigDecimal.ZERO;
        private int batchCount;

        static MaterialAccumulator from(Material material) {
            MaterialAccumulator acc = new MaterialAccumulator();
            acc.materialId = material.getId();
            acc.materialCode = material.getMaterialCode();
            acc.materialName = material.getMaterialName();
            acc.unit = unitFor(material);
            acc.inventoryAlertEnabled = material.getInventoryAlertEnabled();
            acc.inventoryAlertQuantity = material.getInventoryAlertQuantity();
            acc.inventoryAlertPercentage = material.getInventoryAlertPercentage();
            return acc;
        }

        static MaterialAccumulator from(ShopMaterialAudit row) {
            MaterialAccumulator acc = new MaterialAccumulator();
            acc.materialId = row.getMaterialId();
            acc.materialCode = row.getMaterialCode();
            acc.materialName = row.getMaterialName();
            acc.unit = row.getMaterialUnit() != null ? row.getMaterialUnit() : "pcs";
            return acc;
        }
    }

    public record InventoryAlertReport(Instant generatedAt,
                                       LocalDate targetDate,
                                       int lookbackDays,
                                       int forecastDays,
                                       String forecastMode,
                                       String forecastModeLabel,
                                       int expirationDays,
                                       Summary summary,
                                       List<MaterialAlertRow> materialRows,
                                       List<ExpirationRow> expirationRows) {
    }

    public record Summary(int materialCount,
                          int lowStockCount,
                          int forecastShortageCount,
                          int expiringBatchCount,
                          BigDecimal totalForecastShortageQty) {
    }

    public record MaterialAlertRow(UUID materialId,
                                   String materialCode,
                                   String materialName,
                                   String unit,
                                   BigDecimal quantityOnHand,
                                   BigDecimal quantityLocked,
                                   BigDecimal availableQty,
                                   BigDecimal committedQty,
                                   BigDecimal netAvailableQty,
                                   BigDecimal quantityTotal,
                                   BigDecimal availablePercentage,
                                   Boolean inventoryAlertEnabled,
                                   BigDecimal inventoryAlertQuantity,
                                   BigDecimal inventoryAlertPercentage,
                                   boolean lowStockAlert,
                                   String lowStockReason,
                                   BigDecimal historicalUsageQty,
                                   int sampleDays,
                                   int sourceDaysWithUsage,
                                   BigDecimal forecastQty,
                                   BigDecimal forecastShortageQty,
                                   boolean forecastShortage,
                                   String forecastBasis,
                                   int batchCount) {
    }

    public record ExpirationRow(UUID inventoryId,
                                UUID materialId,
                                String materialCode,
                                String materialName,
                                String unit,
                                String warehouseCode,
                                String warehouseName,
                                String batchNo,
                                BigDecimal quantityOnHand,
                                BigDecimal availableQty,
                                Instant expirationDateTime,
                                long daysUntilExpiration,
                                String status) {
    }
}
