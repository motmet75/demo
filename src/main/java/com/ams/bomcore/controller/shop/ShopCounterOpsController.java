package com.ams.bomcore.controller.shop;

import com.ams.bomcore.controller.inventory.dto.InventoryViewDTO;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.ShopOrderRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.inventory.InventoryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Date;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/shop/staff/counter")
public class ShopCounterOpsController {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final InventoryService inventoryService;

    public ShopCounterOpsController(JdbcTemplate jdbcTemplate,
                                    TenantRepository tenantRepository,
                                    CompanyRepository companyRepository,
                                    ShopOrderRepository shopOrderRepository,
                                    InventoryService inventoryService) {
        this.jdbcTemplate = jdbcTemplate;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.shopOrderRepository = shopOrderRepository;
        this.inventoryService = inventoryService;
    }

    @GetMapping("/shift-summary")
    public ResponseEntity<?> shiftSummary(@RequestParam(required = false) UUID tenantId,
                                          @RequestParam(required = false) UUID companyId,
                                          @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                          @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                          @RequestParam Instant from,
                                          @RequestParam Instant to) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        if (to.isBefore(from) || to.equals(from)) {
            return ResponseEntity.badRequest().body(Map.of("message", "Invalid shift range"));
        }

        List<ShopOrder> orders = shopOrderRepository.searchStaffOrders(tId, cId, null, from, to);
        BigDecimal totalSales = BigDecimal.ZERO;
        BigDecimal cashIn = BigDecimal.ZERO;
        BigDecimal bankIn = BigDecimal.ZERO;
        BigDecimal debt = BigDecimal.ZERO;
        int completed = 0;
        int unpaid = 0;
        int cardSlips = 0;

        for (ShopOrder order : orders) {
            if (ShopOrder.STATUS_CANCELLED.equals(order.getStatus())) continue;
            BigDecimal net = netOrderAmount(order);
            totalSales = totalSales.add(net);
            boolean paid = ShopOrder.PAY_STATUS_PAID.equals(order.getPaymentStatus());
            if (!paid) {
                unpaid++;
                debt = debt.add(net);
                continue;
            }
            if (ShopOrder.STATUS_COMPLETED.equals(order.getStatus())) completed++;
            String method = order.getPaymentMethod();
            if (ShopOrder.PAYMENT_BANK_QR.equals(method)) {
                bankIn = bankIn.add(net);
                cardSlips++;
            } else if (ShopOrder.PAYMENT_SPLIT.equals(method)) {
                BigDecimal splitCash = nz(order.getSplitCashAmount()).min(net).max(BigDecimal.ZERO);
                cashIn = cashIn.add(splitCash);
                bankIn = bankIn.add(net.subtract(splitCash).max(BigDecimal.ZERO));
                cardSlips++;
            } else {
                cashIn = cashIn.add(net);
            }
        }

        BigDecimal paymentNoteTotal = paymentNoteTotal(tId, cId, from, to);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("orderCount", orders.size());
        result.put("completedOrderCount", completed);
        result.put("unpaidOrderCount", unpaid);
        result.put("cardSlipCount", cardSlips);
        result.put("totalSales", totalSales);
        result.put("cashIn", cashIn);
        result.put("bankingIn", bankIn);
        result.put("debtAmount", debt);
        result.put("paymentNoteTotal", paymentNoteTotal);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/inventory-snapshot")
    public ResponseEntity<?> inventorySnapshot(@RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(inventoryService.listInventoryViewByTenantAndCompany(tId, cId).stream()
                .map(this::safeInventoryMap)
                .toList());
    }

    @GetMapping("/payment-notes")
    public ResponseEntity<?> paymentNotes(@RequestParam(required = false) UUID tenantId,
                                          @RequestParam(required = false) UUID companyId,
                                          @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                          @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                          @RequestParam(required = false) LocalDate date) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(jdbcTemplate.queryForList("""
                SELECT id, note_number, note_date, object_name, recipient_name, address, reason,
                       amount, created_by, created_at
                FROM shop_payment_note
                WHERE tenant_id = ? AND company_id = ? AND note_date = ?
                ORDER BY created_at DESC
                """, tId, cId, Date.valueOf(targetDate)));
    }

    @PostMapping("/payment-notes")
    @Transactional
    public ResponseEntity<?> createPaymentNote(@RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                               Authentication authentication,
                                               @RequestBody Map<String, Object> body) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        String reason = stringValue(body.get("reason"));
        if (reason == null) return ResponseEntity.badRequest().body(Map.of("message", "Lý do chi là bắt buộc"));
        BigDecimal amount = decimalValue(body.get("amount"));
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            return ResponseEntity.badRequest().body(Map.of("message", "Số tiền phải lớn hơn 0"));
        }
        LocalDate noteDate = localDateValue(body.get("noteDate"), LocalDate.now());
        String noteNumber = nextPaymentNoteNumber(tId, cId);
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO shop_payment_note
                (id, tenant_id, company_id, note_number, note_date, object_name, recipient_name,
                 address, reason, amount, created_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now())
                """, id, tId, cId, noteNumber, Date.valueOf(noteDate), stringValue(body.get("objectName")),
                stringValue(body.get("recipientName")), stringValue(body.get("address")), reason,
                amount, currentUsername(authentication));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of(
                "id", id,
                "noteNumber", noteNumber,
                "noteDate", noteDate,
                "amount", amount
        ));
    }

    @GetMapping("/inventory-reconciliations")
    public ResponseEntity<?> inventoryReconciliations(@RequestParam(required = false) UUID tenantId,
                                                      @RequestParam(required = false) UUID companyId,
                                                      @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                      @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                                      @RequestParam(required = false) LocalDate date) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(jdbcTemplate.queryForList("""
                SELECT id, check_date, inventory_id, material_id, material_code, material_name,
                       warehouse_id, warehouse_code, warehouse_name, batch_no, unit,
                       system_qty, actual_qty, difference_qty, reason, created_by, created_at
                FROM shop_inventory_reconciliation
                WHERE tenant_id = ? AND company_id = ? AND check_date = ?
                ORDER BY created_at DESC, material_code
                """, tId, cId, Date.valueOf(targetDate)));
    }

    @PostMapping("/inventory-reconciliations")
    @Transactional
    public ResponseEntity<?> saveInventoryReconciliation(@RequestParam(required = false) UUID tenantId,
                                                         @RequestParam(required = false) UUID companyId,
                                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                                         Authentication authentication,
                                                         @RequestBody Map<String, Object> body) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        LocalDate checkDate = localDateValue(body.get("checkDate"), LocalDate.now());
        Object rawRows = body.get("rows");
        if (!(rawRows instanceof List<?> rows)) {
            return ResponseEntity.badRequest().body(Map.of("message", "rows is required"));
        }
        int saved = 0;
        for (Object raw : rows) {
            if (!(raw instanceof Map<?, ?> row)) continue;
            BigDecimal actual = decimalOrNull(row.get("actualQty"));
            if (actual == null) continue;
            BigDecimal system = decimalValue(row.get("systemQty"));
            BigDecimal diff = actual.subtract(system);
            jdbcTemplate.update("""
                    INSERT INTO shop_inventory_reconciliation
                    (id, tenant_id, company_id, check_date, inventory_id, material_id, material_code,
                     material_name, warehouse_id, warehouse_code, warehouse_name, batch_no, unit,
                     system_qty, actual_qty, difference_qty, reason, created_by, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now())
                    """,
                    UUID.randomUUID(), tId, cId, Date.valueOf(checkDate),
                    uuidOrNull(row.get("inventoryId")), uuidOrNull(row.get("materialId")),
                    stringValue(row.get("materialCode")), stringValue(row.get("materialName")),
                    uuidOrNull(row.get("warehouseId")), stringValue(row.get("warehouseCode")),
                    stringValue(row.get("warehouseName")), stringValue(row.get("batchNo")),
                    stringValue(row.get("unit")), system, actual, diff,
                    stringValue(row.get("reason")), currentUsername(authentication));
            saved++;
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("saved", saved, "checkDate", checkDate));
    }

    @GetMapping("/shift-handovers")
    public ResponseEntity<?> shiftHandovers(@RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                            @RequestParam(required = false) LocalDate date) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        LocalDate targetDate = date != null ? date : LocalDate.now();
        return ResponseEntity.ok(jdbcTemplate.queryForList("""
                SELECT id, shift_date, shift_name, opened_at, closed_at, handover_by, handover_to,
                       opening_cash, cash_sales, bank_sales, debt_amount, other_amount,
                       payment_note_total, expected_cash, actual_cash, difference_cash,
                       order_count, card_slip_count, unpaid_order_count, cash_denominations,
                       notes, created_by, created_at
                FROM shop_shift_handover
                WHERE tenant_id = ? AND company_id = ? AND shift_date = ?
                ORDER BY created_at DESC
                """, tId, cId, Date.valueOf(targetDate)));
    }

    @PostMapping("/shift-handovers")
    @Transactional
    public ResponseEntity<?> createShiftHandover(@RequestParam(required = false) UUID tenantId,
                                                 @RequestParam(required = false) UUID companyId,
                                                 @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                 @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                                 Authentication authentication,
                                                 @RequestBody Map<String, Object> body) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        LocalDate shiftDate = localDateValue(body.get("shiftDate"), LocalDate.now());
        UUID id = UUID.randomUUID();
        jdbcTemplate.update("""
                INSERT INTO shop_shift_handover
                (id, tenant_id, company_id, shift_date, shift_name, opened_at, closed_at,
                 handover_by, handover_to, opening_cash, cash_sales, bank_sales, debt_amount,
                 other_amount, payment_note_total, expected_cash, actual_cash, difference_cash,
                 order_count, card_slip_count, unpaid_order_count, cash_denominations, notes,
                 created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, now())
                """,
                id, tId, cId, Date.valueOf(shiftDate), stringValue(body.get("shiftName")),
                timestampOrNull(body.get("openedAt")), timestampOrNull(body.get("closedAt")),
                stringValue(body.get("handoverBy")), stringValue(body.get("handoverTo")),
                decimalValue(body.get("openingCash")), decimalValue(body.get("cashSales")),
                decimalValue(body.get("bankSales")), decimalValue(body.get("debtAmount")),
                decimalValue(body.get("otherAmount")), decimalValue(body.get("paymentNoteTotal")),
                decimalValue(body.get("expectedCash")), decimalValue(body.get("actualCash")),
                decimalValue(body.get("differenceCash")), intValue(body.get("orderCount")),
                intValue(body.get("cardSlipCount")), intValue(body.get("unpaidOrderCount")),
                jsonValue(body.get("cashDenominations")), stringValue(body.get("notes")),
                currentUsername(authentication));
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id, "shiftDate", shiftDate));
    }

    private Map<String, Object> safeInventoryMap(InventoryViewDTO row) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("inventoryId", row.getInventoryId());
        map.put("id", row.getInventoryId());
        map.put("tenantId", row.getTenantId());
        map.put("companyId", row.getCompanyId());
        map.put("materialId", row.getMaterialId());
        map.put("materialCode", row.getMaterialCode());
        map.put("materialName", row.getMaterialName());
        map.put("warehouseId", row.getWarehouseId());
        map.put("warehouseCode", row.getWarehouseCode());
        map.put("warehouseName", row.getWarehouseName());
        map.put("quantityOnHand", row.getQuantityOnHand());
        map.put("quantityTotal", row.getQuantityTotal());
        map.put("quantityReserved", row.getQuantityReserved());
        map.put("quantityLocked", row.getQuantityLocked());
        map.put("availableQuantity", nz(row.getQuantityOnHand()).subtract(nz(row.getQuantityLocked())).max(BigDecimal.ZERO));
        map.put("batchNo", row.getBatchNo());
        map.put("contractCode", row.getContractCode());
        map.put("orderToDeduction", row.getOrderToDeduction());
        map.put("unit", row.getUnit());
        map.put("expirationDateTime", row.getExpirationDateTime());
        map.put("productionDateTime", row.getProductionDateTime());
        map.put("createdAt", row.getCreatedAt());
        map.put("updatedAt", row.getUpdatedAt());
        map.put("visible", row.getVisible());
        map.put("approved", row.getApproved());
        map.put("locked", row.getLocked());
        map.put("materialQuotaPercentage", row.getMaterialQuotaPercentage());
        map.put("userName", row.getUserName());
        return map;
    }

    private UUID resolve(UUID param, String header) {
        if (header != null && !header.isBlank()) {
            try { return UUID.fromString(header); } catch (Exception ignored) {}
        }
        return param;
    }

    private void validateScope(UUID tenantId, UUID companyId) {
        if (tenantId == null || companyId == null) throw new IllegalArgumentException("tenantId and companyId are required");
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("Tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("Company not found"));
        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalArgumentException("Company does not belong to tenant");
        }
    }

    private BigDecimal paymentNoteTotal(UUID tenantId, UUID companyId, Instant from, Instant to) {
        BigDecimal value = jdbcTemplate.queryForObject("""
                SELECT COALESCE(SUM(amount), 0)
                FROM shop_payment_note
                WHERE tenant_id = ? AND company_id = ? AND created_at >= ? AND created_at < ?
                """, BigDecimal.class, tenantId, companyId, Timestamp.from(from), Timestamp.from(to));
        return nz(value);
    }

    private String nextPaymentNoteNumber(UUID tenantId, UUID companyId) {
        Long count = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM shop_payment_note WHERE tenant_id = ? AND company_id = ?
                """, Long.class, tenantId, companyId);
        return "PC" + String.format("%06d", (count == null ? 0 : count) + 1);
    }

    private BigDecimal netOrderAmount(ShopOrder order) {
        return nz(order.getTotalAmount()).subtract(nz(order.getDiscountAmount())).max(BigDecimal.ZERO);
    }

    private BigDecimal nz(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private String currentUsername(Authentication authentication) {
        if (authentication == null) return "system";
        Object principal = authentication.getPrincipal();
        if (principal instanceof User user) return user.getUsername();
        return authentication.getName() != null ? authentication.getName() : "system";
    }

    private String stringValue(Object raw) {
        if (raw == null) return null;
        String value = String.valueOf(raw).trim();
        return value.isBlank() ? null : value;
    }

    private BigDecimal decimalValue(Object raw) {
        BigDecimal value = decimalOrNull(raw);
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal decimalOrNull(Object raw) {
        String value = stringValue(raw);
        if (value == null) return null;
        return new BigDecimal(value.replace(",", ""));
    }

    private Integer intValue(Object raw) {
        String value = stringValue(raw);
        if (value == null) return 0;
        return Integer.parseInt(value);
    }

    private UUID uuidOrNull(Object raw) {
        String value = stringValue(raw);
        if (value == null) return null;
        try { return UUID.fromString(value); } catch (Exception ignored) { return null; }
    }

    private LocalDate localDateValue(Object raw, LocalDate fallback) {
        String value = stringValue(raw);
        if (value == null) return fallback;
        return LocalDate.parse(value);
    }

    private Timestamp timestampOrNull(Object raw) {
        String value = stringValue(raw);
        if (value == null) return null;
        return Timestamp.from(Instant.parse(value));
    }

    private String jsonValue(Object raw) {
        if (raw == null) return null;
        if (raw instanceof String value) return value;
        try {
            return objectMapper.writeValueAsString(raw);
        } catch (Exception e) {
            return "[]";
        }
    }
}
