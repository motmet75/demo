package com.ams.bomcore.controller.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.shop.ShopAccessToken;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopStaffCall;
import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.ShopAccessTokenRepository;
import com.ams.bomcore.repository.ShopOrderRepository;
import com.ams.bomcore.repository.ShopStaffCallRepository;
import com.ams.bomcore.repository.ShopTableRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.shop.ShopOrderService;
import com.ams.bomcore.service.shop.ShopPricingService;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.*;

@RestController
public class ShopOrderController {

    private final ShopOrderService shopOrderService;
    private final ShopPricingService shopPricingService;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;
    private final ShopAccessTokenRepository shopAccessTokenRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final ShopStaffCallRepository shopStaffCallRepository;
    private final ShopTableRepository shopTableRepository;

    public ShopOrderController(ShopOrderService shopOrderService,
                               ShopPricingService shopPricingService,
                               TenantRepository tenantRepository,
                               CompanyRepository companyRepository,
                               ShopAccessTokenRepository shopAccessTokenRepository,
                               ShopOrderRepository shopOrderRepository,
                               ShopStaffCallRepository shopStaffCallRepository,
                               ShopTableRepository shopTableRepository) {
        this.shopOrderService = shopOrderService;
        this.shopPricingService = shopPricingService;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.shopAccessTokenRepository = shopAccessTokenRepository;
        this.shopOrderRepository = shopOrderRepository;
        this.shopStaffCallRepository = shopStaffCallRepository;
        this.shopTableRepository = shopTableRepository;
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
    public ResponseEntity<?> getMenu(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return ResponseEntity.ok(shopOrderService.getMenu(tenantId, companyId));
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
                                          @RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        ShopOrderResponseDto dto = shopOrderService.createOrder(req, tenantId, companyId);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
    }

    @GetMapping("/shop/public/orders/{orderCode}")
    public ResponseEntity<?> getOrderStatus(@PathVariable String orderCode) {
        return ResponseEntity.ok(shopOrderService.getOrderByCode(orderCode));
    }

    @PatchMapping("/shop/public/orders/{orderCode}/pickup-scan")
    public ResponseEntity<?> pickupScan(@PathVariable String orderCode) {
        return ResponseEntity.ok(shopOrderService.markPickupScan(orderCode));
    }

    @GetMapping("/shop/public/active-pickup")
    public ResponseEntity<?> activePickup(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return shopOrderService.getActivePickup(tenantId, companyId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.noContent().build());
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

            ShopOrder order = resolveStaffCallOrder(
                    parseUuid(body.get("orderId")),
                    stringValue(body.get("orderCode")),
                    token,
                    tableId,
                    tenantId,
                    companyId
            );

            ShopStaffCall call = new ShopStaffCall();
            call.setTenantId(tenantId);
            call.setCompanyId(companyId);
            call.setTableId(tableId);
            call.setTableName(tableName);
            call.setReason(reason);
            call.setNote(note);
            call.setToken(token);
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

    // ── STAFF endpoints (/shop/staff/**) ──────────────────────────────

    @GetMapping("/shop/staff/staff-calls")
    public ResponseEntity<?> listStaffCalls(@RequestParam(required = false) UUID tenantId,
                                            @RequestParam(required = false) UUID companyId,
                                            @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                            @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopStaffCallRepository
                .findAllByTenantIdAndCompanyIdAndStatusOrderByCreatedAtDesc(tId, cId, ShopStaffCall.STATUS_OPEN)
                .stream().map(this::staffCallMap).toList());
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
        ShopStaffCall call = shopStaffCallRepository.findById(id)
                .orElseThrow(() -> new NoSuchElementException("Staff call not found"));
        if (!tId.equals(call.getTenantId()) || !cId.equals(call.getCompanyId())) {
            throw new IllegalArgumentException("Staff call does not belong to this company");
        }
        call.setStatus(ShopStaffCall.STATUS_DISMISSED);
        call.setDismissedAt(Instant.now());
        return ResponseEntity.ok(staffCallMap(shopStaffCallRepository.save(call)));
    }

    @GetMapping("/shop/staff/orders")
    public ResponseEntity<?> listOrders(@RequestParam(required = false) UUID tenantId,
                                         @RequestParam(required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                         @RequestParam(required = false) String status,
                                         @RequestParam(required = false) Boolean active) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        if (Boolean.TRUE.equals(active)) return ResponseEntity.ok(shopOrderService.listActiveOrders(tId, cId));
        return ResponseEntity.ok(shopOrderService.listOrders(tId, cId, status));
    }

    @GetMapping("/shop/staff/orders/by-token")
    public ResponseEntity<?> getOrdersByToken(@RequestParam String token,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.getOrdersByTokenForStaff(token, tId, cId));
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
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        ShopOrderResponseDto dto = shopOrderService.createOrder(req, tId, cId);
        return ResponseEntity.status(HttpStatus.CREATED).body(dto);
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
        return ResponseEntity.ok(shopOrderService.startPreparing(orderId, tId, cId));
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
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.updateOrderItems(orderId, items, tId, cId));
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
        ShopTable table = shopOrderService.createTable(body.get("tableName"), tId, cId);
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
        Boolean active = body.get("isActive") != null ? (Boolean) body.get("isActive") : null;
        return ResponseEntity.ok(shopOrderService.updateTable(tableId, name, active, tId, cId));
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
        Integer seq = body != null && body.get("seq") != null ? ((Number) body.get("seq")).intValue() : null;
        ShopOrderService.WalkUpQrResult qr = shopOrderService.generateWalkUpQr(seq, tId, cId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("qrBase64", qr.qrBase64());
        result.put("qrUrl",    qr.qrUrl());
        if (seq != null) result.put("seq", seq);
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
                                                   @RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
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
            return ResponseEntity.ok(shopOrderService.startCustomerEdit(orderCode));
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
                                                    @RequestBody List<ShopOrderService.ItemRequest> items) {
        try {
            return ResponseEntity.ok(shopOrderService.updateOrderByCustomer(orderCode, items));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("error", e.getMessage()));
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
    public ResponseEntity<?> getDisplayBoard(@PathVariable String token) {
        try {
            return ResponseEntity.ok(shopOrderService.getDisplayBoardOrders(token));
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
        if (body.containsKey("pointsConversionRate")) company.setPointsConversionRate(Integer.parseInt(String.valueOf(body.get("pointsConversionRate"))));
        if (body.containsKey("pointsRoundUp"))        company.setPointsRoundUp(Boolean.TRUE.equals(body.get("pointsRoundUp")));
        companyRepository.save(company);
        return ResponseEntity.ok(bankConfigMap(company));
    }

    @GetMapping("/shop/public/shop-config")
    public ResponseEntity<?> getPublicShopConfig(@RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        var company = companyRepository.findById(companyId).orElseThrow();
        return ResponseEntity.ok(bankConfigMap(company));
    }

    private Map<String, Object> bankConfigMap(com.ams.bomcore.domain.company.Company company) {
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("bankBin",              company.getBankBin()           != null ? company.getBankBin()           : "");
        m.put("bankAccountNumber",    company.getBankAccountNumber() != null ? company.getBankAccountNumber() : "");
        m.put("bankAccountName",      company.getBankAccountName()   != null ? company.getBankAccountName()   : "");
        m.put("prepaidMenu",          Boolean.TRUE.equals(company.getPrepaidMenu()));
        m.put("pointsConversionRate", company.getPointsConversionRate());
        m.put("pointsRoundUp",        company.getPointsRoundUp());
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
        return ResponseEntity.ok(shopOrderService.patchDiscount(orderId, discount, voucher, tId, cId));
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
        body.setId(null);
        return ResponseEntity.status(201).body(shopOrderService.saveCustomer(body, tId, cId));
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
        body.setId(id);
        return ResponseEntity.ok(shopOrderService.saveCustomer(body, tId, cId));
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
        m.put("reason", call.getReason());
        m.put("note", call.getNote());
        m.put("status", call.getStatus());
        m.put("createdAt", call.getCreatedAt());
        m.put("dismissedAt", call.getDismissedAt());
        return m;
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
