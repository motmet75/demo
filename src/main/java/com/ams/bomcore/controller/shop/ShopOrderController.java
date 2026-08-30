package com.ams.bomcore.controller.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.shop.ShopAccessToken;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopPrintHistory;
import com.ams.bomcore.domain.shop.ShopStaffCall;
import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.ShopAccessTokenRepository;
import com.ams.bomcore.repository.ShopOrderRepository;
import com.ams.bomcore.repository.ShopPrintHistoryRepository;
import com.ams.bomcore.repository.ShopStaffCallRepository;
import com.ams.bomcore.repository.ShopTableRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.shop.ShopOrderService;
import com.ams.bomcore.service.shop.ShopLocalizedLabelService;
import com.ams.bomcore.service.shop.ShopMaterialAuditService;
import com.ams.bomcore.service.shop.ShopMenuTranslationService;
import com.ams.bomcore.service.shop.ShopPricingService;
import com.ams.bomcore.service.shop.ShopSalesReportService;
import com.ams.bomcore.util.RequestTimeZone;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.HttpServletRequest;
import com.ams.bomcore.service.shop.CounterDisplayCache;
import com.ams.bomcore.service.shop.ShopSalesReportService;
import com.ams.bomcore.service.shop.ShopHoursService;

import java.math.BigDecimal;
import java.net.InetAddress;
import java.time.Instant;
import java.time.ZoneId;
import java.util.*;
import java.util.regex.Pattern;

@RestController
public class ShopOrderController {
    private static final String STAFF_CALL_REASON_NEW_ORDER = "new_order";
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final ShopOrderService shopOrderService;
    private final ShopLocalizedLabelService shopLocalizedLabelService;
    private final ShopPricingService shopPricingService;
    private final ShopMaterialAuditService shopMaterialAuditService;
    private final ShopMenuTranslationService shopMenuTranslationService;
    private final ShopSalesReportService shopSalesReportService;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;
    private final ShopAccessTokenRepository shopAccessTokenRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final ShopStaffCallRepository shopStaffCallRepository;
    private final ShopPrintHistoryRepository shopPrintHistoryRepository;
    private final ShopTableRepository shopTableRepository;
    private final CounterDisplayCache counterDisplayCache;

    private static final ObjectMapper JSON_MAPPER = new ObjectMapper();
    private final ShopHoursService shopHoursService;
    private ResponseEntity<?> dailyLimitResponse(ShopOrderService.DailyMenuLimitExceededException e) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", e.getMessage());
        body.put("message", e.getMessage());
        body.put("code", "DAILY_MENU_LIMIT_EXCEEDED");
        body.put("modelId", e.getModelId());
        body.put("modelName", e.getModelName());
        body.put("limitUnits", e.getLimitUnits());
        body.put("soldUnits", e.getSoldUnits());
        body.put("remainingUnits", e.getRemainingUnits());
        body.put("requestedUnits", e.getRequestedUnits());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
    }

    private record CounterIpSnapshot(String publicIp, Instant updatedAt, List<String> allowedPublicIps, boolean allowAllNetworks) {}
    private record CounterNetworkRule(String counterPublicIp, List<String> allowedPublicIps, boolean allowAllNetworks) {}
    private record EmailList(List<String> emails, String invalid) {}

    public ShopOrderController(ShopOrderService shopOrderService,
                               ShopLocalizedLabelService shopLocalizedLabelService,
                               ShopPricingService shopPricingService,
                               ShopMaterialAuditService shopMaterialAuditService,
                               ShopMenuTranslationService shopMenuTranslationService,
                               ShopSalesReportService shopSalesReportService,
                               TenantRepository tenantRepository,
                               CompanyRepository companyRepository,
                               ShopAccessTokenRepository shopAccessTokenRepository,
                               ShopOrderRepository shopOrderRepository,
                               ShopStaffCallRepository shopStaffCallRepository,
                               ShopPrintHistoryRepository shopPrintHistoryRepository,
                               ShopTableRepository shopTableRepository,
                               CounterDisplayCache counterDisplayCache,
                               ShopHoursService shopHoursService) {
        this.shopOrderService = shopOrderService;
        this.shopLocalizedLabelService = shopLocalizedLabelService;
        this.shopPricingService = shopPricingService;
        this.shopMaterialAuditService = shopMaterialAuditService;
        this.shopMenuTranslationService = shopMenuTranslationService;
        this.shopSalesReportService = shopSalesReportService;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.shopAccessTokenRepository = shopAccessTokenRepository;
        this.shopOrderRepository = shopOrderRepository;
        this.shopStaffCallRepository = shopStaffCallRepository;
        this.shopPrintHistoryRepository = shopPrintHistoryRepository;
        this.shopTableRepository = shopTableRepository;
        this.counterDisplayCache = counterDisplayCache;
        this.shopHoursService = shopHoursService;
    }

    // ── PUBLIC endpoints (/shop/public/**) ────────────────────────────

    @Transactional
    @GetMapping("/shop/public/token/{token}")
    public ResponseEntity<?> resolveToken(@PathVariable String token) {
        ShopAccessToken sat = shopAccessTokenRepository.findByToken(token)
                .orElse(null);
        if (sat == null || !sat.isValid()) {
            return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", "Token not found or expired"));
        }
        sat.recordAccess();
        shopAccessTokenRepository.save(sat);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tenantId", sat.getTenantId());
        result.put("companyId", sat.getCompanyId());
        result.put("tableId", sat.getTableId());
        result.put("tokenType", sat.getTokenType());
        result.put("expiresAt", sat.getExpiresAt());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/shop/public/session")
    public ResponseEntity<?> getTokenSession(@RequestParam String t) {
        try {
            return ResponseEntity.ok(shopOrderService.getOrdersByToken(t));
        } catch (java.util.NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", "Token not found"));
        }
    }

    @GetMapping("/shop/public/menu")
    public ResponseEntity<?> getMenu(@RequestParam UUID tenantId, @RequestParam UUID companyId,
                                     @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        validateScope(tenantId, companyId);
        java.time.LocalDate businessDate = java.time.LocalDate.now(RequestTimeZone.resolve(timeZone));
        return ResponseEntity.ok(shopOrderService.getMenu(tenantId, companyId, businessDate));
    }

    @GetMapping("/shop/public/localized-labels")
    public ResponseEntity<?> getPublicLocalizedLabels(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return ResponseEntity.ok(shopLocalizedLabelService.labelMap(tenantId, companyId));
    }

    @GetMapping("/shop/public/tables")
    public ResponseEntity<?> listPublicTables(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return ResponseEntity.ok(shopOrderService.listTables(tenantId, companyId).stream()
                .filter(table -> Boolean.TRUE.equals(table.getIsActive()))
                .map(this::publicTableMap)
                .toList());
    }

    @PostMapping("/shop/public/group-order-slip")
    public ResponseEntity<?> generatePublicGroupOrderSlip(@RequestBody(required = false) Map<String, Object> body,
                                                          @RequestParam UUID tenantId,
                                                          @RequestParam UUID companyId) {
        try {
            validateScope(tenantId, companyId);
            Map<String, Object> requestBody = body != null ? body : Collections.emptyMap();
            Integer maxOrders = integerValue(requestBody.get("maxOrders"));
            if (maxOrders == null || maxOrders < 1 || maxOrders >= 100) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "maxOrders must be from 1 to 99",
                        "message", "maxOrders must be from 1 to 99"
                ));
            }
            ShopOrderService.GroupOrderSlipResult slip = shopOrderService.generateGroupOrderSlip(
                    stringValue(requestBody.get("name")),
                    stringValue(requestBody.get("phone")),
                    stringValue(requestBody.get("address")),
                    maxOrders,
                    stringValue(requestBody.get("language")),
                    tenantId,
                    companyId
            );
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("qrBase64", slip.qrBase64());
            result.put("qrUrl", slip.qrUrl());
            result.put("token", slip.token());
            result.put("slipNumber", slip.slipNumber());
            result.put("maxOrders", slip.maxOrders());
            result.put("language", slip.language());
            result.put("expiresAt", slip.expiresAt());
            result.put("name", slip.name());
            result.put("phone", slip.phone());
            result.put("address", slip.address());
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalArgumentException e) {
            String message = e.getMessage() != null ? e.getMessage() : "Cannot create group order slip";
            return ResponseEntity.badRequest().body(Map.of("error", message, "message", message));
        }
    }

    @GetMapping("/shop/public/tables/{tableId}")
    public ResponseEntity<?> getTable(@PathVariable UUID tableId,
                                       @RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return shopOrderService.listTables(tenantId, companyId).stream()
                .filter(t -> t.getId().equals(tableId))
                .findFirst()
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/shop/public/orders")
    public ResponseEntity<?> createOrder(@RequestBody ShopOrderService.CreateOrderRequest req,
                                         @RequestParam UUID tenantId, @RequestParam UUID companyId,
                                         @RequestHeader(value = "X-Time-Zone", required = false) String timeZone,
                                         HttpServletRequest request) {
        validateScope(tenantId, companyId);
        ZoneId zone = RequestTimeZone.resolve(timeZone);
        ResponseEntity<?> closed = rejectShopClosed(tenantId, companyId, zone);
        if (closed != null) return closed;
        ResponseEntity<?> rejected = rejectPublicOrderingIfIpMismatch(tenantId, companyId, clientPublicIp(request));
        if (rejected != null) return rejected;
        rejected = rejectPublicTokenOrder(req != null ? req.token() : null, tenantId, companyId);
        if (rejected != null) return rejected;
        try {
            ShopOrderResponseDto dto = shopOrderService.createOrder(req, tenantId, companyId, zone);
            createNewOrderStaffCall(dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(dto);
        } catch (ShopOrderService.DailyMenuLimitExceededException e) {
            return dailyLimitResponse(e);
        } catch (IllegalArgumentException e) {
            String message = e.getMessage() != null ? e.getMessage() : "Cannot create order";
            return ResponseEntity.badRequest().body(Map.of("error", message, "message", message));
        }
    }

    @GetMapping("/shop/public/orders/{orderCode}")
    public ResponseEntity<?> getOrderStatus(@PathVariable String orderCode) {
        return ResponseEntity.ok(shopOrderService.getOrderByCode(orderCode));
    }

    @PatchMapping("/shop/public/orders/{orderCode}/bank-payment")
    public ResponseEntity<?> switchPublicOrderToBankPayment(@PathVariable String orderCode) {
        try {
            return ResponseEntity.ok(shopOrderService.switchToQrPaymentByCustomer(orderCode));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/shop/public/orders/{orderCode}/counter-qr")
    public ResponseEntity<?> counterOrderQr(@PathVariable String orderCode) {
        return ResponseEntity.ok(Map.of("qrBase64", shopOrderService.generateCounterOrderQr(orderCode)));
    }

    @PatchMapping("/shop/public/orders/{orderCode}/pickup-scan")
    public ResponseEntity<?> pickupScan(@PathVariable String orderCode) {
        return ResponseEntity.ok(shopOrderService.markPickupScan(orderCode));
    }

    @PatchMapping("/shop/public/orders/{orderCode}/table")
    public ResponseEntity<?> changePublicOrderTable(@PathVariable String orderCode,
                                                     @RequestBody Map<String, Object> body) {
        try {
            UUID tableId = parseUuid(body.get("tableId"));
            if (tableId == null) return ResponseEntity.badRequest().body(Map.of("error", "tableId is required"));
            return ResponseEntity.ok(shopOrderService.changeTableByCustomer(
                    orderCode, tableId, stringValue(body.get("token"))));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/shop/public/active-pickup")
    public ResponseEntity<?> activePickup(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return shopOrderService.getActivePickup(tenantId, companyId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/shop/public/counter-display")
    public ResponseEntity<?> getCounterDisplay(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return counterDisplayCache.latest(tenantId, companyId)
                .<ResponseEntity<?>>map(p -> ResponseEntity.ok(Map.of(
                        "payload", p.payload(),
                        "pushedAt", p.pushedAt().toString()
                )))
                .orElse(ResponseEntity.noContent().build());
    }

    @GetMapping("/shop/public/ordering-status")
    public ResponseEntity<?> getOrderingStatus(@RequestParam UUID tenantId, @RequestParam UUID companyId,
                                               @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        validateScope(tenantId, companyId);
        ShopHoursService.OrderingStatus status = shopHoursService.getOrderingStatus(tenantId, companyId, RequestTimeZone.resolve(timeZone));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("open", status.open());
        body.put("reason", status.reason());
        body.put("reopensAt", status.reopensAt() != null ? status.reopensAt().toString() : null);
        return ResponseEntity.ok(body);
    }

    @GetMapping("/shop/staff/hours/shifts")
    public ResponseEntity<?> getShiftSchedule(@RequestParam(required = false) UUID tenantId,
                                              @RequestParam(required = false) UUID companyId,
                                              @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                              @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopHoursService.getShiftSchedule(tId, cId));
    }

    @PutMapping("/shop/staff/hours/shifts")
    public ResponseEntity<?> saveShiftSchedule(@RequestBody List<ShopHoursService.ShiftUpsertRequest> shifts,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            return ResponseEntity.ok(shopHoursService.saveShiftSchedule(tId, cId, shifts));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/shop/staff/hours/close-today")
    public ResponseEntity<?> closeToday(@RequestParam(required = false) UUID tenantId,
                                        @RequestParam(required = false) UUID companyId,
                                        @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                        @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                        @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopHoursService.OrderingStatus status = shopHoursService.closeToday(tId, cId, RequestTimeZone.resolve(timeZone), null);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("open", status.open());
        body.put("reason", status.reason());
        body.put("reopensAt", status.reopensAt() != null ? status.reopensAt().toString() : null);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/shop/staff/hours/reopen")
    public ResponseEntity<?> reopenShop(@RequestParam(required = false) UUID tenantId,
                                        @RequestParam(required = false) UUID companyId,
                                        @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                        @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                        @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopHoursService.OrderingStatus status = shopHoursService.reopenNow(tId, cId, RequestTimeZone.resolve(timeZone));
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("open", status.open());
        body.put("reason", status.reason());
        body.put("reopensAt", status.reopensAt() != null ? status.reopensAt().toString() : null);
        return ResponseEntity.ok(body);
    }

    @PostMapping("/shop/staff/counter-display/push")
    public ResponseEntity<?> pushCounterDisplay(@RequestBody(required = false) Map<String, Object> body,
                                                @RequestParam(required = false) UUID tenantId,
                                                @RequestParam(required = false) UUID companyId,
                                                @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        counterDisplayCache.push(tId, cId, body);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @Transactional
    @PostMapping("/shop/public/call-staff")
    public ResponseEntity<?> callStaff(@RequestBody(required = false) Map<String, Object> body) {
        try {
            if (body == null) body = Collections.emptyMap();
            String token = stringValue(body.get("token"));
            ShopAccessToken sat = null;
            if (token != null) {
                sat = shopAccessTokenRepository.findByToken(token).orElse(null);
                if (sat != null && !sat.isValid()) {
                    return ResponseEntity.status(HttpStatus.GONE).body(Map.of("error", "Token expired"));
                }
            }

            UUID tenantId = parseUuid(body.get("tenantId"));
            UUID companyId = parseUuid(body.get("companyId"));
            UUID tableId = parseUuid(body.get("tableId"));
            if (sat != null) {
                if (tenantId == null) tenantId = sat.getTenantId();
                if (companyId == null) companyId = sat.getCompanyId();
                if (tableId == null) tableId = sat.getTableId();
                if (!sat.getTenantId().equals(tenantId) || !sat.getCompanyId().equals(companyId)) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Token does not match shop"));
                }
            }

            validateScope(tenantId, companyId);
            String tableName = null;
            if (tableId != null) {
                ShopTable table = shopTableRepository.findById(tableId)
                        .orElseThrow(() -> new IllegalArgumentException("Table not found"));
                if (!tenantId.equals(table.getTenantId()) || !companyId.equals(table.getCompanyId())) {
                    throw new IllegalArgumentException("Table does not belong to this company");
                }
                tableName = table.getTableName();
            }

            String reason = stringValue(body.get("reason"));
            if (!"payment".equals(reason) && !"other".equals(reason)) reason = "other";
            String note = stringValue(body.get("note"));
            if (note != null && note.length() > 500) note = note.substring(0, 500);
            String customerName = stringValue(body.get("customerName"));
            if (customerName != null) {
                customerName = customerName.trim();
                if (customerName.length() > 120) customerName = customerName.substring(0, 120);
                if (customerName.isEmpty()) customerName = null;
            }

            ShopOrder order = resolveStaffCallOrder(
                    parseUuid(body.get("orderId")),
                    stringValue(body.get("orderCode")),
                    token,
                    tableId,
                    tenantId,
                    companyId
            );

            if (order == null) {
                if (customerName == null) {
                    return ResponseEntity.badRequest().body(Map.of("error", "customerName is required when no order has been placed"));
                }
                if (tableId == null) {
                    return ResponseEntity.badRequest().body(Map.of("error", "tableId is required when no order has been placed"));
                }
            }

            ShopStaffCall call = new ShopStaffCall();
            call.setTenantId(tenantId);
            call.setCompanyId(companyId);
            call.setTableId(tableId);
            call.setTableName(tableName);
            call.setReason(reason);
            call.setNote(note);
            call.setToken(token);
            call.setCustomerName(customerName);
            if (order != null) {
                call.setOrderId(order.getId());
                call.setOrderNumber(order.getOrderNumber());
                call.setDailySeq(order.getDailySeq());
                call.setOrderCode(order.getOrderCode());
            }
            call.setStatus(ShopStaffCall.STATUS_OPEN);
            return ResponseEntity.status(HttpStatus.CREATED).body(staffCallMap(shopStaffCallRepository.save(call)));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/shop/public/call-staff/latest")
    public ResponseEntity<?> getLatestPublicStaffCall(@RequestParam(required = false) String token,
                                                      @RequestParam(required = false) UUID tenantId,
                                                      @RequestParam(required = false) UUID companyId,
                                                      @RequestParam(required = false) UUID tableId) {
        Optional<ShopStaffCall> latest = Optional.empty();
        if (token != null && !token.isBlank()) {
            latest = shopStaffCallRepository.findFirstByTokenAndStatusOrderByCreatedAtDesc(token, ShopStaffCall.STATUS_OPEN);
        } else if (tenantId != null && companyId != null && tableId != null) {
            validateScope(tenantId, companyId);
            latest = shopStaffCallRepository.findFirstByTenantIdAndCompanyIdAndTableIdAndStatusOrderByCreatedAtDesc(
                    tenantId, companyId, tableId, ShopStaffCall.STATUS_OPEN);
        }
        if (latest.isEmpty()) return ResponseEntity.noContent().build();
        ShopStaffCall call = latest.get();
        if (!canReadPublicStaffCall(call, token, tenantId, companyId, tableId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Cannot read staff call"));
        }
        return ResponseEntity.ok(staffCallMap(call));
    }
    @GetMapping("/shop/public/call-staff/{id}")
    public ResponseEntity<?> getPublicStaffCall(@PathVariable UUID id,
                                                @RequestParam(required = false) String token,
                                                @RequestParam(required = false) UUID tenantId,
                                                @RequestParam(required = false) UUID companyId,
                                                @RequestParam(required = false) UUID tableId) {
        ShopStaffCall call = shopStaffCallRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Staff call not found"));
        if (!canReadPublicStaffCall(call, token, tenantId, companyId, tableId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("error", "Cannot read staff call"));
        }
        return ResponseEntity.ok(staffCallMap(call));
    }
    // ── STAFF endpoints (/shop/staff/**) ──────────────────────────────

    @GetMapping("/shop/staff/staff-calls")
    public ResponseEntity<?> listStaffCalls(@RequestParam(required = false) UUID tenantId,
                                             @RequestParam(defaultValue = "false") boolean includeHistory,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok((includeHistory
                ? shopStaffCallRepository.findAllByTenantIdAndCompanyIdOrderByCreatedAtDesc(tId, cId)
                : shopStaffCallRepository.findAllByTenantIdAndCompanyIdAndStatusOrderByCreatedAtDesc(tId, cId, ShopStaffCall.STATUS_OPEN))
                .stream().map(this::staffCallMap).toList());
    }

    @Transactional
    @PatchMapping("/shop/staff/staff-calls/{id}/reply")
    public ResponseEntity<?> replyStaffCall(@PathVariable UUID id,
                                            @RequestBody(required = false) Map<String, Object> body,
                                            @RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        String message = body == null ? null : stringValue(body.get("message"));
        if (message == null) return ResponseEntity.badRequest().body(Map.of("error", "message is required"));
        if (message.length() > 300) message = message.substring(0, 300);
        ShopStaffCall call = requireScopedStaffCall(id, tId, cId);
        call.setReplyMessage(message);
        call.setRepliedAt(Instant.now());
        return ResponseEntity.ok(staffCallMap(shopStaffCallRepository.save(call)));
    }
    @Transactional
    @PatchMapping("/shop/staff/staff-calls/{id}/dismiss")
    public ResponseEntity<?> dismissStaffCall(@PathVariable UUID id,
                                              @RequestParam(required = false) UUID tenantId,
                                              @RequestParam(required = false) UUID companyId,
                                              @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                              @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopStaffCall call = requireScopedStaffCall(id, tId, cId);
        call.setStatus(ShopStaffCall.STATUS_DISMISSED);
        call.setDismissedAt(Instant.now());
        return ResponseEntity.ok(staffCallMap(shopStaffCallRepository.save(call)));
    }

    @GetMapping("/shop/staff/printing-history")
    public ResponseEntity<?> listPrintHistory(@RequestParam(required = false) UUID tenantId,
                                              @RequestParam(required = false) UUID companyId,
                                              @RequestParam(required = false) String printType,
                                              @RequestParam(required = false) String sourceType,
                                              @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                              @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopPrintHistoryRepository.findTop200ByTenantIdAndCompanyIdOrderByPrintedAtDesc(tId, cId)
                .stream()
                .filter(p -> printType == null || printType.isBlank() || printType.equals(p.getPrintType()))
                .filter(p -> sourceType == null || sourceType.isBlank() || sourceType.equals(p.getSourceType()))
                .map(this::printHistoryMap)
                .toList());
    }

    @GetMapping("/shop/staff/localized-labels")
    public ResponseEntity<?> getStaffLocalizedLabels(@RequestParam(required = false) UUID tenantId,
                                                     @RequestParam(required = false) UUID companyId,
                                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopLocalizedLabelService.labelMap(tId, cId));
    }

    @Transactional
    @PostMapping("/shop/staff/printing-history")
    public ResponseEntity<?> createPrintHistory(@RequestBody(required = false) Map<String, Object> body,
                                                @RequestParam(required = false) UUID tenantId,
                                                @RequestParam(required = false) UUID companyId,
                                                @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                                @RequestHeader(value = "X-Username", required = false) String hUsername) {
        if (body == null) body = Collections.emptyMap();
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);

        String printType = bounded(stringValue(body.get("printType")), 50);
        String sourceType = bounded(stringValue(body.get("sourceType")), 50);
        if (printType == null) printType = "GENERAL";
        if (sourceType == null) sourceType = "GENERAL";

        UUID sourceId = parseUuidOrNull(body.get("sourceId"));
        String sourceCode = bounded(stringValue(body.get("sourceCode")), 120);
        String sourceNumber = bounded(stringValue(body.get("sourceNumber")), 60);
        String sourceKey = bounded(stringValue(body.get("sourceKey")), 180);
        if (sourceKey == null && sourceId != null) sourceKey = sourceId.toString();
        if (sourceKey == null && sourceCode != null) sourceKey = sourceCode;
        if (sourceKey == null && sourceNumber != null) sourceKey = sourceNumber;
        if (sourceKey == null) sourceKey = UUID.randomUUID().toString();

        Integer maxSlip = shopPrintHistoryRepository.maxSlipNumber(tId, cId);
        long copyCount = shopPrintHistoryRepository.countByTenantIdAndCompanyIdAndPrintTypeAndSourceTypeAndSourceKey(
                tId, cId, printType, sourceType, sourceKey);

        ShopPrintHistory history = new ShopPrintHistory();
        history.setTenantId(tId);
        history.setCompanyId(cId);
        history.setSlipNumber((maxSlip == null ? 0 : maxSlip) + 1);
        history.setCopyNumber((int) copyCount + 1);
        history.setPrintType(printType);
        history.setSourceType(sourceType);
        history.setSourceId(sourceId);
        history.setSourceKey(sourceKey);
        history.setSourceCode(sourceCode);
        history.setSourceNumber(sourceNumber);
        history.setTitle(bounded(stringValue(body.get("title")), 180));
        history.setAmount(decimalValue(body.get("amount")));
        history.setPrintedBy(bounded(stringValue(body.get("printedBy")) != null ? stringValue(body.get("printedBy")) : hUsername, 120));
        history.setNotes(stringValue(body.get("notes")));
        return ResponseEntity.status(HttpStatus.CREATED).body(printHistoryMap(shopPrintHistoryRepository.save(history)));
    }
    @GetMapping("/shop/staff/orders")
    public ResponseEntity<?> listOrders(@RequestParam(required = false) UUID tenantId,
                                         @RequestParam(required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                         @RequestParam(required = false) String status,
                                         @RequestParam(required = false) Boolean active,
                                         @RequestParam(required = false) Instant from,
                                         @RequestParam(required = false) Instant to,
                                         HttpServletRequest request) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        Object orders = Boolean.TRUE.equals(active)
                ? shopOrderService.listActiveOrders(tId, cId, from, to)
                : shopOrderService.listOrders(tId, cId, status, from, to);
        return staffOrdersResponse(orders, recordCounterPublicIp(cId, request));
    }
    @GetMapping("/shop/staff/orders/by-token")
    public ResponseEntity<?> getOrdersByToken(@RequestParam String token,
                                              @RequestParam(required = false) UUID tenantId,
                                              @RequestParam(required = false) UUID companyId,
                                              @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                              @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                              @RequestParam(required = false) Instant from,
                                              @RequestParam(required = false) Instant to) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.getOrdersByTokenForStaff(token, tId, cId, from, to));
    }

    @GetMapping("/shop/staff/orders/{orderId}")
    public ResponseEntity<?> getOrder(@PathVariable UUID orderId,
                                       @RequestParam(required = false) UUID tenantId,
                                       @RequestParam(required = false) UUID companyId,
                                       @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                       @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.getOrder(orderId, tId, cId));
    }

    @PostMapping("/shop/staff/orders")
    public ResponseEntity<?> createStaffOrder(@RequestBody ShopOrderService.CreateOrderRequest req,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                               @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            ShopOrderResponseDto dto = shopOrderService.createCounterOrder(req, tId, cId, RequestTimeZone.resolve(timeZone));
            return ResponseEntity.status(HttpStatus.CREATED).body(dto);
        } catch (ShopOrderService.DailyMenuLimitExceededException e) {
            return dailyLimitResponse(e);
        }
    }

    @PostMapping("/shop/staff/orders/scan-confirm")
    public ResponseEntity<?> confirmScannedOrder(@RequestBody Map<String, Object> body,
                                                  @RequestParam(required = false) UUID tenantId,
                                                  @RequestParam(required = false) UUID companyId,
                                                  @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                  @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            return ResponseEntity.ok(shopOrderService.confirmScannedOrder(stringValue(body.get("code")), tId, cId));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("message", e.getMessage()));
        } catch (IllegalStateException | IllegalArgumentException e) {
            return ResponseEntity.status(409).body(Map.of("message", e.getMessage()));
        }
    }

    @PostMapping("/shop/staff/materials/import-orders")
    public ResponseEntity<?> importMaterialOrders(@RequestBody ShopOrderService.BulkImportRequest req,
                                                   @RequestParam(required = false) UUID tenantId,
                                                   @RequestParam(required = false) UUID companyId,
                                                   @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                   @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            return ResponseEntity.ok(shopOrderService.importExternalOrders(req, tId, cId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/shop/staff/orders/{orderId}/tag-qr")
    public ResponseEntity<?> orderTagQr(@PathVariable UUID orderId,
                                         @RequestParam(required = false) UUID tenantId,
                                         @RequestParam(required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(Map.of("qrBase64", shopOrderService.generateOrderTagQr(orderId, tId, cId)));
    }

    @GetMapping("/shop/staff/orders/{orderId}/pickup-qr")
    public ResponseEntity<?> pickupQr(@PathVariable UUID orderId,
                                       @RequestParam(required = false) UUID tenantId,
                                       @RequestParam(required = false) UUID companyId,
                                       @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                       @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(Map.of("qrBase64", shopOrderService.generatePickupQr(orderId, tId, cId)));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/confirm")
    public ResponseEntity<?> confirm(@PathVariable UUID orderId,
                                      @RequestParam(required = false) UUID tenantId,
                                      @RequestParam(required = false) UUID companyId,
                                      @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                      @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.confirmOrder(orderId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/confirm-wait-payment")
    public ResponseEntity<?> confirmWaitPayment(@PathVariable UUID orderId,
                                                 @RequestParam(required = false) UUID tenantId,
                                                 @RequestParam(required = false) UUID companyId,
                                                 @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                 @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.confirmAndRequestPayment(orderId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/force-confirm")
    public ResponseEntity<?> forceConfirm(@PathVariable UUID orderId,
                                           @RequestParam(required = false) UUID tenantId,
                                           @RequestParam(required = false) UUID companyId,
                                           @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                           @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.forceConfirmOrder(orderId, tId, cId));
    }

    @PostMapping("/shop/staff/orders/{orderId}/earn-points")
    public ResponseEntity<?> earnPoints(@PathVariable UUID orderId,
                                         @RequestParam(required = false) UUID tenantId,
                                         @RequestParam(required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.earnPointsFromOrder(orderId, tId, cId));
    }

    @PostMapping("/shop/staff/customers/{customerId}/recalculate-points")
    public ResponseEntity<?> recalculatePoints(@PathVariable UUID customerId,
                                                @RequestParam(required = false) UUID tenantId,
                                                @RequestParam(required = false) UUID companyId,
                                                @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.recalculateCustomerPoints(customerId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/prepare")
    public ResponseEntity<?> prepare(@PathVariable UUID orderId,
                                      @RequestParam(required = false) UUID tenantId,
                                      @RequestParam(required = false) UUID companyId,
                                      @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                      @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            return ResponseEntity.ok(shopOrderService.startPreparing(orderId, tId, cId));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
        }
    }

    @PatchMapping("/shop/staff/orders/{orderId}/ready")
    public ResponseEntity<?> ready(@PathVariable UUID orderId,
                                    @RequestParam(required = false) UUID tenantId,
                                    @RequestParam(required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                    @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.markReady(orderId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/pickup")
    public ResponseEntity<?> pickup(@PathVariable UUID orderId,
                                     @RequestParam(required = false) UUID tenantId,
                                     @RequestParam(required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.pickupOrder(orderId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/complete")
    public ResponseEntity<?> complete(@PathVariable UUID orderId,
                                       @RequestParam(required = false) UUID tenantId,
                                       @RequestParam(required = false) UUID companyId,
                                       @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                       @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.completeOrder(orderId, tId, cId));
    }

    @PostMapping("/shop/staff/orders/sequence/reset")
    public ResponseEntity<?> resetSequence(@RequestBody(required = false) Map<String, Object> body,
                                            @RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        int resetTo = 0;
        if (body != null && body.get("resetTo") instanceof Number n) resetTo = n.intValue();
        shopOrderService.resetOrderSequence(resetTo, tId, cId);
        return ResponseEntity.ok(Map.of("resetTo", resetTo, "nextOrderNumber", resetTo + 1));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/number")
    public ResponseEntity<?> setOrderNumber(@PathVariable UUID orderId,
                                             @RequestBody Map<String, Object> body,
                                             @RequestParam(required = false) UUID tenantId,
                                             @RequestParam(required = false) UUID companyId,
                                             @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                             @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        int number = ((Number) body.get("orderNumber")).intValue();
        return ResponseEntity.ok(shopOrderService.setOrderNumber(orderId, number, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/revert")
    public ResponseEntity<?> revert(@PathVariable UUID orderId,
                                     @RequestParam(required = false) UUID tenantId,
                                     @RequestParam(required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.revertOrder(orderId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/switch-payment")
    public ResponseEntity<?> switchPayment(@PathVariable UUID orderId,
                                            @RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.switchToQrPayment(orderId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/split-payment")
    public ResponseEntity<?> splitPayment(@PathVariable UUID orderId,
                                          @RequestBody Map<String, Object> body,
                                          @RequestParam(required = false) UUID tenantId,
                                          @RequestParam(required = false) UUID companyId,
                                          @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                          @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        BigDecimal cashAmount = new BigDecimal(body.get("cashAmount").toString());
        return ResponseEntity.ok(shopOrderService.splitPayment(orderId, cashAmount, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/revert-payment")
    public ResponseEntity<?> revertPayment(@PathVariable UUID orderId,
                                           @RequestParam(required = false) UUID tenantId,
                                           @RequestParam(required = false) UUID companyId,
                                           @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                           @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.revertToCash(orderId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/table")
    public ResponseEntity<?> setTable(@PathVariable UUID orderId,
                                      @RequestBody Map<String, Object> body,
                                      @RequestParam(required = false) UUID tenantId,
                                      @RequestParam(required = false) UUID companyId,
                                      @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                      @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        String tableIdStr = body.get("tableId") != null ? body.get("tableId").toString() : null;
        UUID tableId = (tableIdStr != null && !tableIdStr.isBlank()) ? UUID.fromString(tableIdStr) : null;
        return ResponseEntity.ok(shopOrderService.setOrderTable(orderId, tableId, tId, cId));
    }

    @PatchMapping("/shop/staff/orders/{orderId}/seat")
    public ResponseEntity<?> setSeat(@PathVariable UUID orderId,
                                     @RequestBody Map<String, Object> body,
                                     @RequestParam(required = false) UUID tenantId,
                                     @RequestParam(required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        String tableIdValue = body.get("tableId") != null ? String.valueOf(body.get("tableId")) : null;
        UUID tableId = tableIdValue != null && !tableIdValue.isBlank() ? UUID.fromString(tableIdValue) : null;
        String tag = body.get("customerTableTag") != null ? String.valueOf(body.get("customerTableTag")).trim() : null;
        String fulfillmentType = body.get("fulfillmentType") != null ? String.valueOf(body.get("fulfillmentType")) : null;
        ShopOrder before = shopOrderRepository.findById(orderId).orElse(null);
        String previousSeat = before == null ? "" : ((before.getTable() != null ? before.getTable().getTableName() : "") + " / " + (before.getCustomerTableTag() != null ? before.getCustomerTableTag() : ""));
        ShopOrderResponseDto updated = shopOrderService.setOrderSeat(orderId, tableId, tag, fulfillmentType, tId, cId);
        String nextSeat = (updated.getTableName() != null ? updated.getTableName() : "") + " / " + (updated.getCustomerTableTag() != null ? updated.getCustomerTableTag() : "");
        if (!previousSeat.equals(nextSeat)) createOrderEvent(updated, "table_change", previousSeat + " → " + nextSeat);
        return ResponseEntity.ok(updated);
    }

    @PatchMapping("/shop/staff/orders/{orderId}/pay")
    public ResponseEntity<?> markAsPaid(@PathVariable UUID orderId,
                                         @RequestParam(required = false) UUID tenantId,
                                         @RequestParam(required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.markAsPaid(orderId, tId, cId));
    }

    @PutMapping("/shop/staff/orders/{orderId}/items")
    public ResponseEntity<?> updateOrderItems(@PathVariable UUID orderId,
                                               @RequestBody List<ShopOrderService.ItemRequest> items,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                               @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            return ResponseEntity.ok(shopOrderService.updateOrderItems(orderId, items, tId, cId, RequestTimeZone.resolve(timeZone)));
        } catch (ShopOrderService.DailyMenuLimitExceededException e) {
            return dailyLimitResponse(e);
        }
    }

    @PatchMapping("/shop/staff/orders/{orderId}/cancel")
    public ResponseEntity<?> cancel(@PathVariable UUID orderId,
                                     @RequestParam(required = false) UUID tenantId,
                                     @RequestParam(required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                     @RequestBody(required = false) Map<String, String> body) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(shopOrderService.cancelOrder(orderId, reason, tId, cId));
    }

    // ── Table endpoints (/shop/staff/tables/**) ───────────────────────

    @GetMapping("/shop/staff/tables")
    public ResponseEntity<?> listTables(@RequestParam(required = false) UUID tenantId,
                                         @RequestParam(required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.listTables(tId, cId));
    }

    @PostMapping("/shop/staff/tables")
    public ResponseEntity<?> createTable(@RequestBody Map<String, String> body,
                                          @RequestParam(required = false) UUID tenantId,
                                          @RequestParam(required = false) UUID companyId,
                                          @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                          @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopTable table = shopOrderService.createTable(body.get("tableName"), body.get("tableNameTranslations"), tId, cId);
        return ResponseEntity.status(HttpStatus.CREATED).body(table);
    }

    @PutMapping("/shop/staff/tables/{tableId}")
    public ResponseEntity<?> updateTable(@PathVariable UUID tableId,
                                          @RequestBody Map<String, Object> body,
                                          @RequestParam(required = false) UUID tenantId,
                                          @RequestParam(required = false) UUID companyId,
                                          @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                          @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        String name = (String) body.get("tableName");
        String translations = (String) body.get("tableNameTranslations");
        Boolean active = body.get("isActive") != null ? (Boolean) body.get("isActive") : null;
        return ResponseEntity.ok(shopOrderService.updateTable(tableId, name, translations, active, tId, cId));
    }

    @DeleteMapping("/shop/staff/tables/{tableId}")
    public ResponseEntity<Void> deleteTable(@PathVariable UUID tableId,
                                             @RequestParam(required = false) UUID tenantId,
                                             @RequestParam(required = false) UUID companyId,
                                             @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                             @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        shopOrderService.deleteTable(tableId, tId, cId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/shop/staff/qr-order")
    public ResponseEntity<?> generateWalkUpQr(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        Integer seq = body != null ? integerValue(body.get("seq")) : null;
        Integer maxOrders = body != null ? integerValue(body.get("maxOrders")) : null;
        ShopOrderService.WalkUpQrResult qr = shopOrderService.generateWalkUpQr(seq, maxOrders, tId, cId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("qrBase64", qr.qrBase64());
        result.put("qrUrl",    qr.qrUrl());
        result.put("token", qr.token());
        result.put("maxOrders", qr.maxOrders());
        if (qr.seq() != null) result.put("seq", qr.seq());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/shop/staff/queue-qr")
    public ResponseEntity<?> generateQueueQr(
            @RequestBody(required = false) Map<String, Object> body,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        Integer validDays = body != null ? integerValue(body.get("validDays")) : null;
        String language = body != null ? stringValue(body.get("language")) : null;
        boolean forceNew = body != null && Boolean.TRUE.equals(body.get("forceNew"));
        ShopOrderService.QueueQrResult qr = shopOrderService.generateQueueQr(validDays, forceNew, language, tId, cId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("qrBase64", qr.qrBase64());
        result.put("qrUrl", qr.qrUrl());
        result.put("token", qr.token());
        result.put("expiresAt", qr.expiresAt());
        result.put("validDays", qr.validDays());
        result.put("language", qr.language());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/shop/staff/tables/{tableId}/qrcode")
    public ResponseEntity<?> tableQr(@PathVariable UUID tableId,
                                      @RequestParam(required = false) UUID tenantId,
                                      @RequestParam(required = false) UUID companyId,
                                      @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                      @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopOrderService.TableQrResult result = shopOrderService.generateTableQr(tableId, tId, cId);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("qrBase64", result.qrBase64());
        resp.put("token", result.token());
        resp.put("activeOrderCount", result.activeOrderCount());
        return ResponseEntity.ok(resp);
    }

    // ── Menu options (/shop/staff/menu-options) ───────────────────────

    @GetMapping("/shop/public/table-orders")
    public ResponseEntity<?> getActiveTableOrders(@RequestParam UUID tableId,
                                                   @RequestParam UUID tenantId, @RequestParam UUID companyId,
                                                   HttpServletRequest request) {
        validateScope(tenantId, companyId);
        ResponseEntity<?> rejected = rejectPublicOrderingIfIpMismatch(tenantId, companyId, clientPublicIp(request));
        if (rejected != null) return rejected;
        return ResponseEntity.ok(shopOrderService.getActiveTableOrders(tableId, tenantId, companyId));
    }

    @PatchMapping("/shop/public/orders/{orderCode}/cancel-by-customer")
    public ResponseEntity<?> cancelByCustomer(@PathVariable String orderCode,
                                               @RequestBody(required = false) Map<String, Object> body) {
        String note = body != null && body.get("note") instanceof String s ? s : null;
        try {
            return ResponseEntity.ok(shopOrderService.cancelByCustomer(orderCode, note));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/shop/public/orders/{orderCode}/start-edit")
    public ResponseEntity<?> startCustomerEdit(@PathVariable String orderCode) {
        try {
            ShopOrderResponseDto updated = shopOrderService.startCustomerEdit(orderCode);
            createOrderEvent(updated, "customer_edit", "Customer started editing order");
            return ResponseEntity.ok(updated);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/shop/public/orders/{orderCode}/cancel-edit")
    public ResponseEntity<?> cancelCustomerEdit(@PathVariable String orderCode) {
        return ResponseEntity.ok(shopOrderService.cancelCustomerEdit(orderCode));
    }

    @PutMapping("/shop/public/orders/{orderCode}/items")
    public ResponseEntity<?> updateOrderByCustomer(@PathVariable String orderCode,
                                                    @RequestBody List<ShopOrderService.ItemRequest> items,
                                                    @RequestHeader(value = "X-Time-Zone", required = false) String timeZone,
                                                    HttpServletRequest request) {
        ShopOrder order = shopOrderRepository.findByOrderCode(orderCode).orElse(null);
        if (order == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(Map.of("error", "Order not found", "message", "Order not found"));
        }
        ResponseEntity<?> rejected = rejectPublicOrderingIfIpMismatch(order.getTenantId(), order.getCompanyId(), clientPublicIp(request));
        if (rejected != null) return rejected;
        rejected = rejectPublicTokenLock(order.getSourceToken());
        if (rejected != null) return rejected;
        try {
            ShopOrderResponseDto updated = shopOrderService.updateOrderByCustomer(orderCode, items, RequestTimeZone.resolve(timeZone));
            createOrderEvent(updated, "customer_edit_saved", "Customer saved edited order items");
            return ResponseEntity.ok(updated);
        } catch (ShopOrderService.DailyMenuLimitExceededException e) {
            return dailyLimitResponse(e);
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage(), "message", e.getMessage()));
        }
    }
    @GetMapping("/shop/public/menu-options")
    public ResponseEntity<?> publicMenuOptions(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return ResponseEntity.ok(shopOrderService.listAllMenuOptions(tenantId, companyId));
    }

    @GetMapping("/shop/staff/menu-options")
    public ResponseEntity<?> listMenuOptions(@RequestParam UUID modelId,
                                              @RequestParam(required = false) UUID tenantId,
                                              @RequestParam(required = false) UUID companyId,
                                              @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                              @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.listMenuOptions(modelId, tId, cId));
    }

    @PostMapping("/shop/staff/menu-options")
    public ResponseEntity<?> createMenuOption(@RequestBody com.ams.bomcore.domain.shop.ModelMenuOption body,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        body.setId(null); body.setTenantId(tId); body.setCompanyId(cId);
        return ResponseEntity.status(201).body(shopOrderService.saveMenuOption(body));
    }

    @PutMapping("/shop/staff/menu-options/{optId}")
    public ResponseEntity<?> updateMenuOption(@PathVariable UUID optId,
                                               @RequestBody com.ams.bomcore.domain.shop.ModelMenuOption body,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        body.setId(optId); body.setTenantId(tId); body.setCompanyId(cId);
        return ResponseEntity.ok(shopOrderService.saveMenuOption(body));
    }

    @DeleteMapping("/shop/staff/menu-options/{optId}")
    public ResponseEntity<Void> deleteMenuOption(@PathVariable UUID optId,
                                                  @RequestParam(required = false) UUID tenantId,
                                                  @RequestParam(required = false) UUID companyId,
                                                  @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                  @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        shopOrderService.deleteMenuOption(optId, tId, cId);
        return ResponseEntity.noContent().build();
    }


    @PostMapping("/shop/staff/menu-items/{modelId}/translate")
    public ResponseEntity<?> translateMenuItem(@PathVariable UUID modelId,
                                               @RequestBody(required = false) ShopMenuTranslationService.MenuTranslationRequest body,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        try {
            UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
            validateScope(tId, cId);
            return ResponseEntity.ok(shopMenuTranslationService.translateMenuItem(modelId, tId, cId, body));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", e.getMessage(), "message", e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage(), "message", e.getMessage()));
        } catch (IllegalStateException e) {
            HttpStatus status = e.getMessage() != null && e.getMessage().contains("OpenAI token is required")
                    ? HttpStatus.PRECONDITION_REQUIRED
                    : HttpStatus.BAD_GATEWAY;
            return ResponseEntity.status(status).body(Map.of("error", e.getMessage(), "message", e.getMessage()));
        }
    }
    // ── Display board ─────────────────────────────────────────────────

    @Transactional
    @PostMapping("/shop/staff/display-board/token")
    public ResponseEntity<?> generateDisplayBoardToken(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        var sat = shopOrderService.generateDisplayBoardToken(tId, cId);
        return ResponseEntity.ok(Map.of(
                "token",     sat.getToken(),
                "expiresAt", sat.getExpiresAt() != null ? sat.getExpiresAt().toString() : ""
        ));
    }

    @GetMapping("/shop/public/display-board/{token}")
    public ResponseEntity<?> getDisplayBoard(@PathVariable String token,
                                             @RequestParam(required = false) Instant from,
                                             @RequestParam(required = false) Instant to) {
        try {
            return ResponseEntity.ok(shopOrderService.getDisplayBoardOrders(token, from, to));
        } catch (NoSuchElementException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(410).body(Map.of("error", e.getMessage()));
        }
    }

    // ── Token management (/shop/staff/tokens) ────────────────────────

    @GetMapping("/shop/staff/tokens")
    public ResponseEntity<?> listTokens(
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.listTokens(tId, cId));
    }

    @PatchMapping("/shop/staff/tokens/{tokenId}/enable")
    public ResponseEntity<?> enableToken(
            @PathVariable UUID tokenId,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.setTokenEnabled(tokenId, true, tId, cId));
    }

    @PatchMapping("/shop/staff/tokens/{tokenId}/disable")
    public ResponseEntity<?> disableToken(
            @PathVariable UUID tokenId,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.setTokenEnabled(tokenId, false, tId, cId));
    }

    @DeleteMapping("/shop/staff/tokens/{tokenId}")
    public ResponseEntity<Void> deleteToken(
            @PathVariable UUID tokenId,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        shopOrderService.deleteToken(tokenId, tId, cId);
        return ResponseEntity.noContent().build();
    }

    // ── Bank config (/shop/staff/bank-config) ─────────────────────────

    @PatchMapping("/shop/staff/tokens/by-token/{token}/counter-lock")
    public ResponseEntity<?> lockTokenCounterSession(
            @PathVariable String token,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
            @RequestHeader(value = "X-Username", required = false) String hUsername) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.lockCounterSession(token, tId, cId, hUsername));
    }

    @PatchMapping("/shop/staff/tokens/by-token/{token}/counter-unlock")
    public ResponseEntity<?> unlockTokenCounterSession(
            @PathVariable String token,
            @RequestParam(required = false) UUID tenantId,
            @RequestParam(required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.unlockCounterSession(token, tId, cId));
    }
    @GetMapping("/shop/staff/bank-config")
    public ResponseEntity<?> getBankConfig(@RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        var company = companyRepository.findById(cId).orElseThrow();
        return ResponseEntity.ok(bankConfigMap(company));
    }

    @PutMapping("/shop/staff/bank-config")
    public ResponseEntity<?> updateBankConfig(@RequestBody Map<String, Object> body,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        var company = companyRepository.findById(cId).orElseThrow();
        if (body.containsKey("bankBin"))              company.setBankBin(String.valueOf(body.get("bankBin")));
        if (body.containsKey("bankAccountNumber"))    company.setBankAccountNumber(String.valueOf(body.get("bankAccountNumber")));
        if (body.containsKey("bankAccountName"))      company.setBankAccountName(String.valueOf(body.get("bankAccountName")));
        if (body.containsKey("prepaidMenu"))          company.setPrepaidMenu(Boolean.TRUE.equals(body.get("prepaidMenu")));
        if (body.containsKey("shopLogoUrl"))          company.setShopLogoUrl(stringValue(body.get("shopLogoUrl")));
        if (body.containsKey("shopName"))             company.setShopName(stringValue(body.get("shopName")));
        if (body.containsKey("shopAddress"))          company.setShopAddress(stringValue(body.get("shopAddress")));
        if (body.containsKey("shopPhone"))            company.setShopPhone(stringValue(body.get("shopPhone")));
        if (body.containsKey("realtimeInventory"))    company.setRealtimeInventory(Boolean.TRUE.equals(body.get("realtimeInventory")));
        if (body.containsKey("processingInventoryRecheck")) company.setShopProcessingInventoryRecheck(Boolean.TRUE.equals(body.get("processingInventoryRecheck")));
        if (body.containsKey("newOrderNotificationEnabled")) {
            company.setNewOrderNotificationEnabled(Boolean.TRUE.equals(body.get("newOrderNotificationEnabled")));
        }
        if (body.containsKey("newOrderNotificationEmails") || body.containsKey("newOrderNotificationEmail")) {
            Object raw = body.containsKey("newOrderNotificationEmails")
                    ? body.get("newOrderNotificationEmails")
                    : body.get("newOrderNotificationEmail");
            EmailList emailList = normalizeEmails(stringValue(raw));
            if (emailList.invalid() != null) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "Invalid notification email: " + emailList.invalid(),
                        "message", "Invalid notification email: " + emailList.invalid()));
            }
            if (Boolean.TRUE.equals(company.getNewOrderNotificationEnabled()) && emailList.emails().isEmpty()) {
                return ResponseEntity.badRequest().body(Map.of(
                        "error", "At least one notification email is required",
                        "message", "At least one notification email is required"));
            }
            company.setNewOrderNotificationEmails(String.join("\n", emailList.emails()));
        }
        if (body.containsKey("pointsConversionRate")) company.setPointsConversionRate(Integer.parseInt(String.valueOf(body.get("pointsConversionRate"))));
        if (body.containsKey("pointsRoundUp"))        company.setPointsRoundUp(Boolean.TRUE.equals(body.get("pointsRoundUp")));
        if (body.containsKey("loyaltyDiscountPointThreshold")) {
            Integer threshold = integerValue(body.get("loyaltyDiscountPointThreshold"));
            company.setLoyaltyDiscountPointThreshold(Math.max(0, threshold != null ? threshold : 0));
        }
        if (body.containsKey("loyaltyDiscountPercent")) {
            BigDecimal percent = decimalValue(body.get("loyaltyDiscountPercent"));
            if (percent == null || percent.compareTo(BigDecimal.ZERO) < 0) percent = BigDecimal.ZERO;
            if (percent.compareTo(BigDecimal.valueOf(100)) > 0) percent = BigDecimal.valueOf(100);
            company.setLoyaltyDiscountPercent(percent);
        }
        if (Boolean.TRUE.equals(company.getNewOrderNotificationEnabled())
                && normalizeEmails(company.getNewOrderNotificationEmails()).emails().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", "At least one notification email is required",
                    "message", "At least one notification email is required"));
        }
        companyRepository.save(company);
        return ResponseEntity.ok(bankConfigMap(company));
    }

    @GetMapping("/shop/staff/allowed-public-ips")
    public ResponseEntity<?> getAllowedPublicIps(@RequestParam(required = false) UUID tenantId,
                                                 @RequestParam(required = false) UUID companyId,
                                                 @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                 @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        Company company = companyRepository.findById(cId).orElseThrow();
        return ResponseEntity.ok(allowedPublicIpMap(company));
    }

    @PutMapping("/shop/staff/allowed-public-ips")
    public ResponseEntity<?> updateAllowedPublicIps(@RequestBody(required = false) Map<String, Object> body,
                                                    @RequestParam(required = false) UUID tenantId,
                                                    @RequestParam(required = false) UUID companyId,
                                                    @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                    @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                                    HttpServletRequest request) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        Company company = companyRepository.findById(cId).orElseThrow();
        String requestCounterIp = cleanIp(clientPublicIp(request));
        String bodyCounterIp = body != null ? cleanIp(stringValue(body.get("counterPublicIp"))) : null;
        String counterIp = bodyCounterIp != null ? bodyCounterIp : (requestCounterIp != null ? requestCounterIp : cleanIp(company.getShopCounterPublicIp()));
        if (counterIp != null) {
            company.setShopCounterPublicIp(counterIp);
            company.setShopCounterPublicIpUpdatedAt(Instant.now());
        }

        List<String> bodyIps = allowedPublicIpsValue(body != null ? body.get("allowedPublicIps") : null);
        boolean bodyHasAllowAll = body != null && body.containsKey("allowAllNetworks");
        boolean bodyAllowAll = bodyHasAllowAll
                ? booleanValue(body.get("allowAllNetworks"))
                : Boolean.TRUE.equals(company.getShopAllowAllNetworks());

        if (body != null && body.containsKey("counterNetworkRules")) {
            List<CounterNetworkRule> rules = counterNetworkRulesValue(body.get("counterNetworkRules"));
            CounterNetworkRule effective = findCounterNetworkRule(rules, counterIp);
            if (effective == null && counterIp != null) {
                List<String> ips = !bodyIps.isEmpty() ? bodyIps : parseAllowedPublicIps(company.getShopAllowedPublicIps());
                if (!bodyAllowAll && ips.isEmpty()) ips = List.of(counterIp);
                effective = new CounterNetworkRule(counterIp, ips, bodyAllowAll);
            }
            if (effective != null) {
                effective = normalizeCounterNetworkRule(effective);
                rules = upsertCounterNetworkRule(rules, effective);
                company.setShopAllowedPublicIps(joinAllowedPublicIps(effective.allowedPublicIps()));
                company.setShopAllowAllNetworks(effective.allowAllNetworks());
            }
            company.setShopCounterNetworkRules(serializeCounterNetworkRules(rules));
        } else {
            List<String> ips = bodyIps;
            boolean allowAll = bodyAllowAll;
            company.setShopAllowedPublicIps(joinAllowedPublicIps(ips));
            company.setShopAllowAllNetworks(allowAll);
            if (counterIp != null) {
                List<CounterNetworkRule> rules = parseCounterNetworkRules(company.getShopCounterNetworkRules());
                rules = upsertCounterNetworkRule(rules, new CounterNetworkRule(counterIp, ips, allowAll));
                company.setShopCounterNetworkRules(serializeCounterNetworkRules(rules));
            }
        }
        companyRepository.save(company);
        return ResponseEntity.ok(allowedPublicIpMap(company));
    }

    @PostMapping("/shop/staff/allowed-public-ips/refresh")
    public ResponseEntity<?> refreshAllowedPublicIps(@RequestParam(required = false) UUID tenantId,
                                                     @RequestParam(required = false) UUID companyId,
                                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                                     HttpServletRequest request) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        recordCounterPublicIp(cId, request);
        Company company = companyRepository.findById(cId).orElseThrow();
        return ResponseEntity.ok(allowedPublicIpMap(company));
    }
    @GetMapping("/shop/public/shop-config")
    public ResponseEntity<?> getPublicShopConfig(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        var company = companyRepository.findById(companyId).orElseThrow();
        return ResponseEntity.ok(bankConfigMap(company));
    }

    private Map<String, Object> allowedPublicIpMap(Company company) {
        Map<String, Object> m = new LinkedHashMap<>();
        CounterNetworkRule effectiveRule = effectiveCounterNetworkRule(company);
        List<CounterNetworkRule> rules = ensureCurrentCounterRule(parseCounterNetworkRules(company.getShopCounterNetworkRules()), company);
        m.put("allowedPublicIps", effectiveRule.allowedPublicIps());
        m.put("counterPublicIp", company.getShopCounterPublicIp() != null ? company.getShopCounterPublicIp() : "");
        m.put("counterPublicIpUpdatedAt", company.getShopCounterPublicIpUpdatedAt());
        m.put("allowAllNetworks", effectiveRule.allowAllNetworks());
        m.put("counterNetworkRules", rules.stream().map(this::counterNetworkRuleMap).toList());
        return m;
    }
    private Map<String, Object> bankConfigMap(com.ams.bomcore.domain.company.Company company) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        String shopAddress = company.getShopAddress() != null && !company.getShopAddress().isBlank()
                ? company.getShopAddress()
                : (company.getAddress() != null ? company.getAddress() : "");
        String shopPhone = company.getShopPhone() != null && !company.getShopPhone().isBlank()
                ? company.getShopPhone()
                : (company.getPhoneNumber() != null ? company.getPhoneNumber() : "");
        m.put("bankBin",              company.getBankBin()           != null ? company.getBankBin()           : "");
        m.put("bankAccountNumber",    company.getBankAccountNumber() != null ? company.getBankAccountNumber() : "");
        m.put("bankAccountName",      company.getBankAccountName()   != null ? company.getBankAccountName()   : "");
        m.put("prepaidMenu",          Boolean.TRUE.equals(company.getPrepaidMenu()));
        m.put("companyName",           company.getCompanyName()       != null ? company.getCompanyName()       : "");
        m.put("shopLogoUrl",           company.getShopLogoUrl()       != null ? company.getShopLogoUrl()       : "");
        m.put("shopName",              company.getShopName()          != null && !company.getShopName().isBlank() ? company.getShopName() : (company.getCompanyName() != null ? company.getCompanyName() : ""));
        m.put("shopAddress",           shopAddress);
        m.put("shopPhone",             shopPhone);
        m.put("companyAddress",        company.getAddress()           != null ? company.getAddress()           : "");
        m.put("companyPhoneNumber",    company.getPhoneNumber()       != null ? company.getPhoneNumber()       : "");
        m.put("realtimeInventory",    Boolean.TRUE.equals(company.getRealtimeInventory()));
        m.put("processingInventoryRecheck", Boolean.TRUE.equals(company.getShopProcessingInventoryRecheck()));
        m.put("pointsConversionRate", company.getPointsConversionRate());
        m.put("pointsRoundUp",        company.getPointsRoundUp());
        m.put("loyaltyDiscountPointThreshold", company.getLoyaltyDiscountPointThreshold());
        m.put("loyaltyDiscountPercent", company.getLoyaltyDiscountPercent());
        m.put("newOrderNotificationEnabled", Boolean.TRUE.equals(company.getNewOrderNotificationEnabled()));
        m.put("newOrderNotificationEmails", company.getNewOrderNotificationEmails() != null ? company.getNewOrderNotificationEmails() : "");
        m.put("voucherSecretSet",     company.getVoucherSecret() != null && !company.getVoucherSecret().isBlank());
        return m;
    }

    // ── Delivery fee estimate ──────────────────────────────────────────

    @GetMapping("/shop/public/delivery-options")
    public ResponseEntity<?> deliveryOptions(@RequestParam UUID tenantId, @RequestParam UUID companyId,
                                              @RequestParam(required = false, defaultValue = "1") BigDecimal weightKg) {
        validateScope(tenantId, companyId);
        BigDecimal shopeeEstimate = shopOrderService.estimateShopeeExpressFee(weightKg);
        return ResponseEntity.ok(Map.of("shopeeExpressEstimate", shopeeEstimate));
    }

    // ── Split / Merge bills ───────────────────────────────────────────

    @PostMapping("/shop/staff/orders/{orderId}/split-bill")
    public ResponseEntity<?> splitBill(@PathVariable UUID orderId,
                                        @RequestBody Map<String, Object> body,
                                        @RequestParam(required = false) UUID tenantId,
                                        @RequestParam(required = false) UUID companyId,
                                        @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                        @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        @SuppressWarnings("unchecked")
        List<String> ids = (List<String>) body.get("rootItemIds");
        List<UUID> rootItemIds = ids.stream().map(UUID::fromString).toList();
        try {
            return ResponseEntity.ok(shopOrderService.splitBill(orderId, rootItemIds, tId, cId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/shop/staff/orders/merge-bills")
    public ResponseEntity<?> mergeBills(@RequestBody Map<String, Object> body,
                                         @RequestParam(required = false) UUID tenantId,
                                         @RequestParam(required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            UUID primaryId = UUID.fromString((String) body.get("primaryId"));
            @SuppressWarnings("unchecked")
            List<String> others = (List<String>) body.get("otherIds");
            List<UUID> otherIds = others.stream().map(UUID::fromString).toList();
            return ResponseEntity.ok(shopOrderService.mergeBills(primaryId, otherIds, tId, cId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/shop/staff/orders/{orderId}/undo-merge")
    public ResponseEntity<?> undoMergeBills(@PathVariable UUID orderId,
                                            @RequestBody(required = false) Map<String, Object> body,
                                            @RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            UUID mergeBatchId = null;
            Object raw = body != null ? body.get("mergeBatchId") : null;
            if (raw != null && !String.valueOf(raw).isBlank()) {
                mergeBatchId = UUID.fromString(String.valueOf(raw));
            }
            return ResponseEntity.ok(shopOrderService.undoMergeBills(orderId, mergeBatchId, tId, cId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/shop/staff/orders/{orderId}/discount")
    public ResponseEntity<?> patchDiscount(@PathVariable UUID orderId,
                                            @RequestBody Map<String, Object> body,
                                            @RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        BigDecimal discount = body.get("discountAmount") != null
            ? new BigDecimal(body.get("discountAmount").toString()) : null;
        String voucher = body.get("voucherCode") instanceof String s ? s : null;
        UUID billId = body.get("billId") != null && !String.valueOf(body.get("billId")).isBlank()
            ? UUID.fromString(String.valueOf(body.get("billId"))) : null;
        try {
            return ResponseEntity.ok(shopOrderService.patchDiscount(orderId, billId, discount, voucher, tId, cId));
        } catch (IllegalArgumentException | IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/shop/staff/orders/{orderId}/customer")
    public ResponseEntity<?> linkCustomer(@PathVariable UUID orderId,
                                           @RequestBody Map<String, Object> body,
                                           @RequestParam(required = false) UUID tenantId,
                                           @RequestParam(required = false) UUID companyId,
                                           @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                           @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        UUID customerId = body.get("customerId") != null ? UUID.fromString((String) body.get("customerId")) : null;
        return ResponseEntity.ok(shopOrderService.linkCustomer(orderId, customerId, tId, cId));
    }

    // ── Customer management (/shop/staff/customers) ───────────────────

    // Shop material audit / processing inventory

    @GetMapping("/shop/staff/material-audit/open")
    public ResponseEntity<?> openMaterialAudit(@RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopMaterialAuditService.listOpenAudit(tId, cId));
    }

    @GetMapping("/shop/staff/material-audit/report")
    public ResponseEntity<?> materialAuditReport(@RequestParam(required = false) java.time.LocalDate from,
                                                 @RequestParam(required = false) java.time.LocalDate to,
                                                 @RequestParam(required = false) UUID tenantId,
                                                 @RequestParam(required = false) UUID companyId,
                                                 @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                 @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                                 @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        java.time.ZoneId zone = RequestTimeZone.resolve(timeZone);
        java.time.LocalDate fromDate = from != null ? from : java.time.LocalDate.now(zone);
        java.time.LocalDate toDate = to != null ? to.plusDays(1) : fromDate.plusDays(1);
        return ResponseEntity.ok(shopMaterialAuditService.report(
                tId, cId, fromDate.atStartOfDay(zone).toInstant(), toDate.atStartOfDay(zone).toInstant()));
    }

    @GetMapping("/shop/staff/sales-report")
    public ResponseEntity<?> salesIncomeReport(@RequestParam(required = false) java.time.LocalDate from,
                                               @RequestParam(required = false) java.time.LocalDate to,
                                               @RequestParam(required = false, defaultValue = "DAY") String period,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                               @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        java.time.ZoneId zone = RequestTimeZone.resolve(timeZone);
        java.time.LocalDate toDate = to != null ? to : java.time.LocalDate.now(zone);
        java.time.LocalDate fromDate = from != null ? from : toDate;
        return ResponseEntity.ok(shopSalesReportService.report(tId, cId, fromDate, toDate, period, zone));
    }

    @GetMapping("/shop/staff/materials/menu-availability")
    public ResponseEntity<?> menuAvailability(@RequestParam(required = false) UUID tenantId,
                                              @RequestParam(required = false) UUID companyId,
                                              @RequestParam(required = false) java.time.LocalDate date,
                                              @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                              @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                              @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        java.time.LocalDate businessDate = date != null ? date : java.time.LocalDate.now(RequestTimeZone.resolve(timeZone));
        return ResponseEntity.ok(shopMaterialAuditService.menuAvailability(tId, cId, businessDate));
    }

    @PutMapping("/shop/staff/materials/menu-availability/{modelId}/override")
    public ResponseEntity<?> setMenuAvailabilityOverride(@PathVariable UUID modelId,
                                                         @RequestBody(required = false) Map<String, Object> body,
                                                         @RequestParam(required = false) UUID tenantId,
                                                         @RequestParam(required = false) UUID companyId,
                                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                                         @RequestHeader(value = "X-Time-Zone", required = false) String timeZone) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        BigDecimal units = body != null && body.get("units") != null && !String.valueOf(body.get("units")).isBlank()
                ? new BigDecimal(String.valueOf(body.get("units")))
                : null;
        java.time.LocalDate businessDate = java.time.LocalDate.now(RequestTimeZone.resolve(timeZone));
        return ResponseEntity.ok(shopMaterialAuditService.updateAvailabilityOverride(modelId, units, tId, cId, businessDate));
    }

    @GetMapping("/shop/staff/orders/{orderId}/material-audit")
    public ResponseEntity<?> orderMaterialAudit(@PathVariable UUID orderId,
                                                @RequestParam(required = false) UUID tenantId,
                                                @RequestParam(required = false) UUID companyId,
                                                @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopOrder order = shopOrderRepository.findById(orderId).orElseThrow(() -> new NoSuchElementException("Order not found"));
        validateStaffCallOrderScope(order, tId, cId);
        return ResponseEntity.ok(shopMaterialAuditService.listOrderAudit(orderId, tId, cId));
    }

    @PostMapping("/shop/staff/orders/{orderId}/material-audit/recheck")
    public ResponseEntity<?> recheckOrderMaterialAudit(@PathVariable UUID orderId,
                                                       @RequestParam(required = false) UUID tenantId,
                                                       @RequestParam(required = false) UUID companyId,
                                                       @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                       @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopOrder order = shopOrderRepository.findById(orderId).orElseThrow(() -> new NoSuchElementException("Order not found"));
        validateStaffCallOrderScope(order, tId, cId);
        return ResponseEntity.ok(shopMaterialAuditService.recordOrderDemand(order, com.ams.bomcore.domain.shop.ShopMaterialAudit.SOURCE_RECHECK));
    }

    @PostMapping("/shop/staff/orders/{orderId}/material-audit/deduct")
    public ResponseEntity<?> deductOrderMaterialAudit(@PathVariable UUID orderId,
                                                      @RequestParam(required = false) UUID tenantId,
                                                      @RequestParam(required = false) UUID companyId,
                                                      @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                      @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopOrder order = shopOrderRepository.findById(orderId).orElseThrow(() -> new NoSuchElementException("Order not found"));
        validateStaffCallOrderScope(order, tId, cId);
        return ResponseEntity.ok(shopMaterialAuditService.deductOrderMaterials(order, com.ams.bomcore.domain.shop.ShopMaterialAudit.SOURCE_DEDUCT_LATER));
    }

    @GetMapping("/shop/staff/customers")
    public ResponseEntity<?> listCustomers(@RequestParam(required = false) String q,
                                            @RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.listCustomers(tId, cId, q));
    }

    @PostMapping("/shop/staff/customers")
    public ResponseEntity<?> createCustomer(@RequestBody com.ams.bomcore.domain.shop.ShopCustomer body,
                                             @RequestParam(required = false) UUID tenantId,
                                             @RequestParam(required = false) UUID companyId,
                                             @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                             @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            body.setId(null);
            return ResponseEntity.status(201).body(shopOrderService.saveCustomer(body, tId, cId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PutMapping("/shop/staff/customers/{id}")
    public ResponseEntity<?> updateCustomer(@PathVariable UUID id,
                                             @RequestBody com.ams.bomcore.domain.shop.ShopCustomer body,
                                             @RequestParam(required = false) UUID tenantId,
                                             @RequestParam(required = false) UUID companyId,
                                             @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                             @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        try {
            body.setId(id);
            return ResponseEntity.ok(shopOrderService.saveCustomer(body, tId, cId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/shop/staff/customers/{id}")
    public ResponseEntity<Void> deleteCustomer(@PathVariable UUID id,
                                                @RequestParam(required = false) UUID tenantId,
                                                @RequestParam(required = false) UUID companyId,
                                                @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                                @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        shopOrderService.deleteCustomer(id, tId, cId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/shop/staff/customers/{id}/add-points")
    public ResponseEntity<?> addPoints(@PathVariable UUID id,
                                        @RequestBody Map<String, Object> body,
                                        @RequestParam(required = false) UUID tenantId,
                                        @RequestParam(required = false) UUID companyId,
                                        @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                        @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        int points = body.get("points") instanceof Number n ? n.intValue() : 0;
        return ResponseEntity.ok(shopOrderService.addPoints(id, points, tId, cId));
    }
    @GetMapping("/shop/staff/customers/{id}/history")
    public ResponseEntity<?> customerHistory(@PathVariable UUID id,
                                             @RequestParam(required = false) UUID tenantId,
                                             @RequestParam(required = false) UUID companyId,
                                             @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                             @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.getCustomerHistory(id, tId, cId));
    }
    // ── Helpers ───────────────────────────────────────────────────────

    private CounterIpSnapshot recordCounterPublicIp(UUID companyId, HttpServletRequest request) {
        String publicIp = clientPublicIp(request);
        if (publicIp == null) return new CounterIpSnapshot(null, null, List.of(), false);

        Instant now = Instant.now();
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found"));
        String counterIp = cleanIp(publicIp);
        List<CounterNetworkRule> rules = parseCounterNetworkRules(company.getShopCounterNetworkRules());
        CounterNetworkRule rule = findCounterNetworkRule(rules, counterIp);
        if (rule == null) {
            boolean useLegacyDefaults = rules.isEmpty();
            boolean allowAll = useLegacyDefaults && Boolean.TRUE.equals(company.getShopAllowAllNetworks());
            List<String> allowed = useLegacyDefaults ? parseAllowedPublicIps(company.getShopAllowedPublicIps()) : new ArrayList<>();
            if (!allowAll && allowed.isEmpty()) allowed = List.of(counterIp);
            rule = new CounterNetworkRule(counterIp, allowed, allowAll);
            rules = upsertCounterNetworkRule(rules, rule);
        } else if (!rule.allowAllNetworks() && !containsNormalizedIp(rule.allowedPublicIps(), counterIp)) {
            List<String> allowed = new ArrayList<>(rule.allowedPublicIps());
            allowed.add(counterIp);
            rule = new CounterNetworkRule(counterIp, allowed, false);
            rules = upsertCounterNetworkRule(rules, rule);
        }
        company.setShopCounterPublicIp(counterIp);
        company.setShopCounterPublicIpUpdatedAt(now);
        company.setShopAllowedPublicIps(joinAllowedPublicIps(rule.allowedPublicIps()));
        company.setShopAllowAllNetworks(rule.allowAllNetworks());
        company.setShopCounterNetworkRules(serializeCounterNetworkRules(rules));
        companyRepository.save(company);
        return new CounterIpSnapshot(counterIp, now, rule.allowedPublicIps(), rule.allowAllNetworks());
    }

    private ResponseEntity<?> staffOrdersResponse(Object body, CounterIpSnapshot counterIp) {
        ResponseEntity.BodyBuilder builder = ResponseEntity.ok();
        if (counterIp != null) {
            builder.header("X-Shop-Allow-All-Networks", Boolean.toString(counterIp.allowAllNetworks()));
        }
        if (counterIp != null && counterIp.publicIp() != null) {
            builder.header("X-Counter-Public-Ip", counterIp.publicIp());
            if (counterIp.updatedAt() != null) {
                builder.header("X-Counter-Public-Ip-Updated-At", counterIp.updatedAt().toString());
            }
            if (counterIp.allowedPublicIps() != null && !counterIp.allowedPublicIps().isEmpty()) {
                builder.header("X-Allowed-Public-Ips", String.join(",", counterIp.allowedPublicIps()));
            }
        }
        return builder.body(body);
    }

    private ResponseEntity<?> rejectPublicTokenOrder(String token, UUID tenantId, UUID companyId) {
        if (token == null || token.isBlank()) return null;
        ShopAccessToken sat = shopAccessTokenRepository.findByToken(token).orElse(null);
        if (sat == null || !sat.isValid()) {
            return tokenRejection(HttpStatus.GONE, "Ordering QR expired. Ask staff for a new QR slip.");
        }
        if (!tenantId.equals(sat.getTenantId()) || !companyId.equals(sat.getCompanyId())) {
            return tokenRejection(HttpStatus.BAD_REQUEST, "Ordering QR does not match this shop.");
        }
        ResponseEntity<?> locked = rejectPublicTokenLock(sat);
        if (locked != null) return locked;
        Integer maxOrders = sat.getMaxOrders();
        if (maxOrders != null && maxOrders > 0) {
            long acceptedOrderCount = shopOrderService.countAcceptedOrdersForToken(token);
            if (acceptedOrderCount >= maxOrders) {
                Map<String, Object> body = new LinkedHashMap<>();
                String message = "This QR slip reached its ordering limit. Ask staff to accept more orders.";
                body.put("error", message);
                body.put("message", message);
                body.put("maxOrders", maxOrders);
                body.put("acceptedOrderCount", acceptedOrderCount);
                return ResponseEntity.status(HttpStatus.CONFLICT).body(body);
            }
        }
        return null;
    }

    private ResponseEntity<?> rejectPublicTokenLock(String token) {
        if (token == null || token.isBlank()) return null;
        return shopAccessTokenRepository.findByToken(token)
                .map(this::rejectPublicTokenLock)
                .orElse(null);
    }

    private ResponseEntity<?> rejectPublicTokenLock(ShopAccessToken sat) {
        if (sat == null || !Boolean.TRUE.equals(sat.getCounterLocked())) return null;
        return tokenRejection(HttpStatus.LOCKED, "Counter is reviewing this QR slip. Ordering is paused for this session.");
    }

    private ResponseEntity<?> tokenRejection(HttpStatus status, String message) {
        return ResponseEntity.status(status).body(Map.of("error", message, "message", message));
    }
    private ResponseEntity<?> rejectPublicOrderingIfIpMismatch(UUID tenantId, UUID companyId, String deviceIp) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found"));
        if (company.getTenant() == null || !tenantId.equals(company.getTenant().getId())) {
            throw new IllegalArgumentException("Company does not belong to tenant");
        }
        CounterNetworkRule rule = effectiveCounterNetworkRule(company);
        if (rule.allowAllNetworks()) return null;

        List<String> allowedIps = new ArrayList<>(rule.allowedPublicIps());
        String counterIp = cleanIp(rule.counterPublicIp() != null ? rule.counterPublicIp() : company.getShopCounterPublicIp());
        if (counterIp != null && !containsNormalizedIp(allowedIps, counterIp)) {
            allowedIps.add(counterIp);
        }
        String normalizedDeviceIp = normalizeIp(deviceIp);
        if (allowedIps.isEmpty()) {
            return forbiddenPublicIp("Counter public IP list is not captured yet. Ask staff to press Refresh IP on QR Tokens.", deviceIp, allowedIps, company.getShopCounterPublicIpUpdatedAt());
        }
        if (normalizedDeviceIp == null) {
            return forbiddenPublicIp("Cannot verify your network. Please connect to shop Wi-Fi and try again.", deviceIp, allowedIps, company.getShopCounterPublicIpUpdatedAt());
        }
        if (!containsNormalizedIp(allowedIps, deviceIp)) {
            return forbiddenPublicIp("Ordering is allowed only from the configured network for this counter.", deviceIp, allowedIps, company.getShopCounterPublicIpUpdatedAt());
        }
        return null;
    }

    private ResponseEntity<?> rejectShopClosed(UUID tenantId, UUID companyId, ZoneId zone) {
        ShopHoursService.OrderingStatus status = shopHoursService.getOrderingStatus(tenantId, companyId, zone);
        if (status.open()) return null;
        String message = "MANUAL_CLOSED".equals(status.reason())
                ? "The shop is temporarily closed. Please check back later."
                : "The shop is closed right now.";
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        body.put("message", message);
        body.put("reason", status.reason());
        body.put("reopensAt", status.reopensAt() != null ? status.reopensAt().toString() : null);
        return ResponseEntity.status(HttpStatus.LOCKED).body(body);
    }

    private ResponseEntity<?> forbiddenPublicIp(String message, String deviceIp, List<String> allowedIps, Instant updatedAt) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", message);
        body.put("message", message);
        if (deviceIp != null) body.put("devicePublicIp", deviceIp);
        if (allowedIps != null && !allowedIps.isEmpty()) body.put("allowedPublicIps", allowedIps);
        if (updatedAt != null) body.put("counterPublicIpUpdatedAt", updatedAt);
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(body);
    }

    private Map<String, Object> counterNetworkRuleMap(CounterNetworkRule rule) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("counterPublicIp", rule.counterPublicIp() != null ? rule.counterPublicIp() : "");
        m.put("allowedPublicIps", rule.allowedPublicIps() != null ? rule.allowedPublicIps() : List.of());
        m.put("allowAllNetworks", rule.allowAllNetworks());
        return m;
    }

    private CounterNetworkRule effectiveCounterNetworkRule(Company company) {
        String counterIp = cleanIp(company.getShopCounterPublicIp());
        List<CounterNetworkRule> rules = parseCounterNetworkRules(company.getShopCounterNetworkRules());
        CounterNetworkRule rule = findCounterNetworkRule(rules, counterIp);
        if (rule != null) return normalizeCounterNetworkRule(rule);
        List<String> legacyAllowed = parseAllowedPublicIps(company.getShopAllowedPublicIps());
        boolean legacyAllowAll = Boolean.TRUE.equals(company.getShopAllowAllNetworks());
        if (counterIp != null && !legacyAllowAll && !containsNormalizedIp(legacyAllowed, counterIp)) {
            legacyAllowed.add(counterIp);
        }
        return new CounterNetworkRule(counterIp, legacyAllowed, legacyAllowAll);
    }

    private List<CounterNetworkRule> ensureCurrentCounterRule(List<CounterNetworkRule> rules, Company company) {
        List<CounterNetworkRule> normalized = new ArrayList<>();
        for (CounterNetworkRule rule : rules) {
            normalized = upsertCounterNetworkRule(normalized, normalizeCounterNetworkRule(rule));
        }
        String counterIp = cleanIp(company.getShopCounterPublicIp());
        if (counterIp != null && findCounterNetworkRule(normalized, counterIp) == null) {
            normalized.add(effectiveCounterNetworkRule(company));
        }
        return normalized;
    }

    private CounterNetworkRule normalizeCounterNetworkRule(CounterNetworkRule rule) {
        String counterIp = cleanIp(rule != null ? rule.counterPublicIp() : null);
        boolean allowAll = rule != null && rule.allowAllNetworks();
        List<String> allowed = new ArrayList<>();
        if (rule != null && rule.allowedPublicIps() != null) {
            for (String ip : rule.allowedPublicIps()) {
                String clean = cleanIp(ip);
                if (clean != null && !containsNormalizedIp(allowed, clean)) allowed.add(clean);
            }
        }
        if (counterIp != null && !allowAll && !containsNormalizedIp(allowed, counterIp)) {
            allowed.add(0, counterIp);
        }
        return new CounterNetworkRule(counterIp, allowed, allowAll);
    }

    private CounterNetworkRule findCounterNetworkRule(List<CounterNetworkRule> rules, String counterIp) {
        String normalizedCounter = normalizeIp(counterIp);
        if (normalizedCounter == null) return null;
        for (CounterNetworkRule rule : rules) {
            if (normalizedCounter.equals(normalizeIp(rule.counterPublicIp()))) return rule;
        }
        return null;
    }

    private List<CounterNetworkRule> upsertCounterNetworkRule(List<CounterNetworkRule> rules, CounterNetworkRule rule) {
        CounterNetworkRule normalizedRule = normalizeCounterNetworkRule(rule);
        String normalizedCounter = normalizeIp(normalizedRule.counterPublicIp());
        if (normalizedCounter == null) return rules != null ? rules : new ArrayList<>();
        List<CounterNetworkRule> result = new ArrayList<>();
        boolean replaced = false;
        for (CounterNetworkRule existing : rules != null ? rules : List.<CounterNetworkRule>of()) {
            if (normalizedCounter.equals(normalizeIp(existing.counterPublicIp()))) {
                if (!replaced) result.add(normalizedRule);
                replaced = true;
            } else {
                result.add(normalizeCounterNetworkRule(existing));
            }
        }
        if (!replaced) result.add(normalizedRule);
        return result;
    }

    private List<CounterNetworkRule> parseCounterNetworkRules(String raw) {
        if (raw == null || raw.isBlank()) return new ArrayList<>();
        try {
            List<Map<String, Object>> values = JSON_MAPPER.readValue(raw, new TypeReference<>() {});
            return counterNetworkRulesValue(values);
        } catch (Exception ignored) {
            return new ArrayList<>();
        }
    }

    private String serializeCounterNetworkRules(List<CounterNetworkRule> rules) {
        try {
            List<Map<String, Object>> values = (rules != null ? rules : List.<CounterNetworkRule>of())
                    .stream().map(this::counterNetworkRuleMap).toList();
            return values.isEmpty() ? null : JSON_MAPPER.writeValueAsString(values);
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<CounterNetworkRule> counterNetworkRulesValue(Object raw) {
        List<CounterNetworkRule> rules = new ArrayList<>();
        if (raw instanceof Collection<?> values) {
            for (Object value : values) {
                CounterNetworkRule rule = counterNetworkRuleValue(value);
                if (rule != null) rules = upsertCounterNetworkRule(rules, rule);
            }
        }
        return rules;
    }

    private CounterNetworkRule counterNetworkRuleValue(Object raw) {
        if (!(raw instanceof Map<?, ?> map)) return null;
        String counterIp = cleanIp(stringValue(map.get("counterPublicIp")));
        if (counterIp == null) counterIp = cleanIp(stringValue(map.get("counterIp")));
        if (counterIp == null) return null;
        List<String> allowedIps = allowedPublicIpsValue(map.get("allowedPublicIps"));
        boolean allowAll = booleanValue(map.get("allowAllNetworks"));
        return normalizeCounterNetworkRule(new CounterNetworkRule(counterIp, allowedIps, allowAll));
    }

    private boolean booleanValue(Object raw) {
        if (raw instanceof Boolean b) return b;
        if (raw == null) return false;
        String value = String.valueOf(raw).trim();
        return "true".equalsIgnoreCase(value) || "1".equals(value) || "yes".equalsIgnoreCase(value) || "on".equalsIgnoreCase(value);
    }

    private EmailList normalizeEmails(String raw) {
        if (raw == null || raw.isBlank()) return new EmailList(List.of(), null);
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String part : raw.split("[\\s,;]+")) {
            String email = part != null ? part.trim() : "";
            if (email.isEmpty()) continue;
            if (!EMAIL_PATTERN.matcher(email).matches()) {
                return new EmailList(List.of(), email);
            }
            unique.putIfAbsent(email.toLowerCase(Locale.ROOT), email);
        }
        return new EmailList(List.copyOf(unique.values()), null);
    }

    private List<String> allowedPublicIpsValue(Object raw) {
        List<String> ips = new ArrayList<>();
        if (raw instanceof Collection<?> values) {
            for (Object value : values) {
                String ip = cleanIp(stringValue(value));
                if (ip != null && !containsNormalizedIp(ips, ip)) {
                    ips.add(ip);
                }
            }
            return ips;
        }
        return parseAllowedPublicIps(stringValue(raw));
    }
    private List<String> parseAllowedPublicIps(String raw) {
        List<String> ips = new ArrayList<>();
        if (raw == null || raw.isBlank()) return ips;
        for (String part : raw.split("[,;\\r\\n]+")) {
            String ip = cleanIp(part);
            if (ip != null && !containsNormalizedIp(ips, ip)) {
                ips.add(ip);
            }
        }
        return ips;
    }

    private String joinAllowedPublicIps(List<String> ips) {
        if (ips == null || ips.isEmpty()) return null;
        return String.join("\n", ips);
    }

    private boolean containsNormalizedIp(List<String> ips, String candidate) {
        String normalizedCandidate = normalizeIp(candidate);
        if (normalizedCandidate == null) return false;
        for (String ip : ips) {
            if (normalizedCandidate.equals(normalizeIp(ip))) return true;
        }
        return false;
    }

    private String clientPublicIp(HttpServletRequest request) {
        if (request == null) return null;
        String forwarded = forwardedForIp(request.getHeader("Forwarded"));
        if (forwarded != null) return forwarded;
        for (String header : List.of("X-Forwarded-For", "CF-Connecting-IP", "True-Client-IP", "X-Real-IP")) {
            String value = cleanIp(firstHeaderValue(request.getHeader(header)));
            if (value != null) return value;
        }
        return cleanIp(request.getRemoteAddr());
    }

    private String forwardedForIp(String header) {
        String first = firstHeaderValue(header);
        if (first == null) return null;
        for (String part : first.split(";")) {
            String[] pair = part.trim().split("=", 2);
            if (pair.length == 2 && "for".equalsIgnoreCase(pair[0].trim())) {
                return cleanIp(pair[1]);
            }
        }
        return null;
    }

    private String firstHeaderValue(String header) {
        if (header == null || header.isBlank()) return null;
        String first = header.split(",", 2)[0].trim();
        return first.isBlank() ? null : first;
    }

    private String cleanIp(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.isBlank() || "unknown".equalsIgnoreCase(value)) return null;
        if (value.startsWith("\"") && value.endsWith("\"") && value.length() > 1) {
            value = value.substring(1, value.length() - 1).trim();
        }
        if (value.startsWith("/")) value = value.substring(1).trim();
        if (value.startsWith("[")) {
            int end = value.indexOf(']');
            if (end > 0) value = value.substring(1, end);
        } else if (value.indexOf(':') == value.lastIndexOf(':') && value.contains(".")) {
            int portStart = value.lastIndexOf(':');
            if (portStart > -1) value = value.substring(0, portStart);
        }
        return value.isBlank() ? null : value;
    }

    private String normalizeIp(String raw) {
        String value = cleanIp(raw);
        if (value == null) return null;
        try {
            if (value.matches("[0-9a-fA-F:.]+")) {
                return InetAddress.getByName(value).getHostAddress();
            }
        } catch (Exception ignored) {}
        return value.toLowerCase(Locale.ROOT);
    }
    private ShopOrder resolveStaffCallOrder(UUID orderId, String orderCode, String token,
                                            UUID tableId, UUID tenantId, UUID companyId) {
        if (orderId != null) {
            ShopOrder order = shopOrderRepository.findById(orderId)
                    .orElseThrow(() -> new IllegalArgumentException("Order not found"));
            validateStaffCallOrderScope(order, tenantId, companyId);
            return order;
        }
        if (orderCode != null) {
            return shopOrderRepository.findByOrderCodeAndTenantIdAndCompanyId(orderCode, tenantId, companyId)
                    .orElse(null);
        }
        if (token != null) {
            List<ShopOrder> orders = shopOrderRepository.findAllBySourceTokenOrderByCreatedAtDesc(token)
                    .stream()
                    .filter(o -> tenantId.equals(o.getTenantId()) && companyId.equals(o.getCompanyId()))
                    .toList();
            Optional<ShopOrder> active = orders.stream()
                    .filter(ShopOrderController::isStaffCallActiveOrder)
                    .findFirst();
            if (active.isPresent()) return active.get();
            if (!orders.isEmpty()) return orders.get(0);
        }
        if (tableId != null) {
            return shopOrderRepository.findAllByTable_IdAndTenantIdAndCompanyIdAndStatusIn(
                            tableId,
                            tenantId,
                            companyId,
                            List.of(ShopOrder.STATUS_PENDING, ShopOrder.STATUS_CONFIRMED,
                                    ShopOrder.STATUS_PREPARING, ShopOrder.STATUS_READY))
                    .stream()
                    .max(Comparator.comparing(ShopOrder::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                    .orElse(null);
        }
        return null;
    }

    private void validateStaffCallOrderScope(ShopOrder order, UUID tenantId, UUID companyId) {
        if (!tenantId.equals(order.getTenantId()) || !companyId.equals(order.getCompanyId())) {
            throw new IllegalArgumentException("Order does not belong to this company");
        }
    }

    private static boolean isStaffCallActiveOrder(ShopOrder order) {
        if (order == null) return false;
        String status = order.getStatus();
        return ShopOrder.STATUS_PENDING.equals(status)
                || ShopOrder.STATUS_CONFIRMED.equals(status)
                || ShopOrder.STATUS_PREPARING.equals(status)
                || ShopOrder.STATUS_READY.equals(status);
    }
    private ShopStaffCall requireScopedStaffCall(UUID id, UUID tenantId, UUID companyId) {
        ShopStaffCall call = shopStaffCallRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Staff call not found"));
        if (!tenantId.equals(call.getTenantId()) || !companyId.equals(call.getCompanyId())) {
            throw new IllegalArgumentException("Staff call does not belong to this company");
        }
        return call;
    }

    private boolean canReadPublicStaffCall(ShopStaffCall call, String token,
                                           UUID tenantId, UUID companyId, UUID tableId) {
        String callToken = call.getToken();
        if (callToken != null && !callToken.isBlank()) {
            return callToken.equals(token);
        }
        if (tenantId == null || companyId == null) return false;
        if (!tenantId.equals(call.getTenantId()) || !companyId.equals(call.getCompanyId())) return false;
        return call.getTableId() == null || call.getTableId().equals(tableId);
    }
    private Map<String, Object> publicTableMap(ShopTable table) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", table.getId());
        m.put("tableName", table.getTableName());
        m.put("tableNameTranslations", table.getTableNameTranslations());
        m.put("isActive", table.getIsActive());
        return m;
    }

    private void createNewOrderStaffCall(ShopOrderResponseDto order) {
        if (order == null || order.getId() == null) return;
        ShopStaffCall call = new ShopStaffCall();
        call.setTenantId(order.getTenantId());
        call.setCompanyId(order.getCompanyId());
        call.setTableName(order.getTableName());
        call.setOrderId(order.getId());
        call.setOrderNumber(order.getOrderNumber());
        call.setDailySeq(order.getDailySeq());
        call.setOrderCode(order.getOrderCode());
        call.setReason(STAFF_CALL_REASON_NEW_ORDER);
        call.setNote("New order");
        call.setStatus(ShopStaffCall.STATUS_OPEN);
        shopStaffCallRepository.save(call);
    }

    private void createOrderEvent(ShopOrderResponseDto order, String reason, String note) {
        if (order == null || order.getId() == null) return;
        ShopStaffCall call = new ShopStaffCall();
        call.setTenantId(order.getTenantId()); call.setCompanyId(order.getCompanyId());
        call.setOrderId(order.getId()); call.setOrderNumber(order.getOrderNumber()); call.setDailySeq(order.getDailySeq()); call.setOrderCode(order.getOrderCode());
        if (order.getTableId() != null && !order.getTableId().isBlank()) call.setTableId(UUID.fromString(order.getTableId()));
        call.setTableName(order.getTableName() != null ? order.getTableName() : order.getCustomerTableTag());
        // Audit events are retained for includeHistory queries but do not pollute the active staff-call queue.
        call.setReason(reason); call.setNote(note); call.setStatus(ShopStaffCall.STATUS_DISMISSED); call.setDismissedAt(Instant.now());
        shopStaffCallRepository.save(call);
    }

    private Map<String, Object> staffCallMap(ShopStaffCall call) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", call.getId());
        m.put("tenantId", call.getTenantId());
        m.put("companyId", call.getCompanyId());
        m.put("tableId", call.getTableId());
        m.put("tableName", call.getTableName());
        m.put("orderId", call.getOrderId());
        m.put("orderNumber", call.getOrderNumber());
        m.put("dailySeq", call.getDailySeq());
        m.put("orderCode", call.getOrderCode());
        m.put("customerName", call.getCustomerName());
        m.put("reason", call.getReason());
        m.put("note", call.getNote());
        m.put("replyMessage", call.getReplyMessage());
        m.put("repliedAt", call.getRepliedAt());
        m.put("status", call.getStatus());
        m.put("createdAt", call.getCreatedAt());
        m.put("dismissedAt", call.getDismissedAt());
        return m;
    }

    private Map<String, Object> printHistoryMap(ShopPrintHistory history) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", history.getId());
        m.put("tenantId", history.getTenantId());
        m.put("companyId", history.getCompanyId());
        m.put("slipNumber", history.getSlipNumber());
        m.put("copyNumber", history.getCopyNumber());
        m.put("printType", history.getPrintType());
        m.put("sourceType", history.getSourceType());
        m.put("sourceId", history.getSourceId());
        m.put("sourceKey", history.getSourceKey());
        m.put("sourceCode", history.getSourceCode());
        m.put("sourceNumber", history.getSourceNumber());
        m.put("title", history.getTitle());
        m.put("amount", history.getAmount());
        m.put("printedBy", history.getPrintedBy());
        m.put("printedAt", history.getPrintedAt());
        m.put("notes", history.getNotes());
        return m;
    }

    private Integer integerValue(Object raw) {
        String value = stringValue(raw);
        if (value == null) return null;
        try { return Integer.parseInt(value); } catch (Exception ignored) { return null; }
    }

    private String bounded(String value, int max) {
        if (value == null) return null;
        return value.length() <= max ? value : value.substring(0, max);
    }

    private BigDecimal decimalValue(Object raw) {
        String value = stringValue(raw);
        if (value == null) return null;
        try { return new BigDecimal(value); } catch (Exception ignored) { return null; }
    }

    private UUID parseUuidOrNull(Object raw) {
        String value = stringValue(raw);
        if (value == null) return null;
        try { return UUID.fromString(value); } catch (Exception ignored) { return null; }
    }
    private String stringValue(Object raw) {
        if (raw == null) return null;
        String value = String.valueOf(raw).trim();
        return value.isBlank() ? null : value;
    }

    private UUID parseUuid(Object raw) {
        String value = stringValue(raw);
        return value == null ? null : UUID.fromString(value);
    }

    private UUID resolve(UUID param, String header) {
        if (header != null && !header.isBlank()) {
            try { return UUID.fromString(header); } catch (Exception ignored) {}
        }
        return param;
    }

    private void validateScope(UUID tenantId, UUID companyId) {
        if (tenantId == null || companyId == null) throw new IllegalArgumentException("tenantId and companyId are required");
        var tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("Tenant not found"));
        var company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("Company not found"));
        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalArgumentException("Company does not belong to tenant");
        }
    }
}
