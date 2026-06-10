package com.ams.bomcore.controller.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.shop.ShopAccessToken;
import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.ShopAccessTokenRepository;
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
import java.util.*;

@RestController
public class ShopOrderController {

    private final ShopOrderService shopOrderService;
    private final ShopPricingService shopPricingService;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;
    private final ShopAccessTokenRepository shopAccessTokenRepository;

    public ShopOrderController(ShopOrderService shopOrderService,
                               ShopPricingService shopPricingService,
                               TenantRepository tenantRepository,
                               CompanyRepository companyRepository,
                               ShopAccessTokenRepository shopAccessTokenRepository) {
        this.shopOrderService = shopOrderService;
        this.shopPricingService = shopPricingService;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.shopAccessTokenRepository = shopAccessTokenRepository;
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
        return ResponseEntity.ok(result);
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

    // ── STAFF endpoints (/shop/staff/**) ──────────────────────────────

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
        String qrBase64 = shopOrderService.generateWalkUpQr(seq, tId, cId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("qrBase64", qrBase64);
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
        String qr = shopOrderService.generateTableQr(tableId, tId, cId);
        return ResponseEntity.ok(Map.of("qrBase64", qr));
    }

    // ── Menu options (/shop/staff/menu-options) ───────────────────────

    @GetMapping("/shop/public/table-orders")
    public ResponseEntity<?> getActiveTableOrders(@RequestParam UUID tableId,
                                                   @RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return ResponseEntity.ok(shopOrderService.getActiveTableOrders(tableId, tenantId, companyId));
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
        return ResponseEntity.ok(Map.of(
                "bankBin",           company.getBankBin()           != null ? company.getBankBin()           : "",
                "bankAccountNumber", company.getBankAccountNumber() != null ? company.getBankAccountNumber() : "",
                "bankAccountName",   company.getBankAccountName()   != null ? company.getBankAccountName()   : ""
        ));
    }

    @PutMapping("/shop/staff/bank-config")
    public ResponseEntity<?> updateBankConfig(@RequestBody Map<String, String> body,
                                               @RequestParam(required = false) UUID tenantId,
                                               @RequestParam(required = false) UUID companyId,
                                               @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                               @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        var company = companyRepository.findById(cId).orElseThrow();
        if (body.containsKey("bankBin"))           company.setBankBin(body.get("bankBin"));
        if (body.containsKey("bankAccountNumber")) company.setBankAccountNumber(body.get("bankAccountNumber"));
        if (body.containsKey("bankAccountName"))   company.setBankAccountName(body.get("bankAccountName"));
        companyRepository.save(company);
        return ResponseEntity.ok(Map.of(
                "bankBin",           company.getBankBin()           != null ? company.getBankBin()           : "",
                "bankAccountNumber", company.getBankAccountNumber() != null ? company.getBankAccountNumber() : "",
                "bankAccountName",   company.getBankAccountName()   != null ? company.getBankAccountName()   : ""
        ));
    }

    // ── Delivery fee estimate ──────────────────────────────────────────

    @GetMapping("/shop/public/delivery-options")
    public ResponseEntity<?> deliveryOptions(@RequestParam UUID tenantId, @RequestParam UUID companyId,
                                              @RequestParam(required = false, defaultValue = "1") BigDecimal weightKg) {
        validateScope(tenantId, companyId);
        BigDecimal shopeeEstimate = shopOrderService.estimateShopeeExpressFee(weightKg);
        return ResponseEntity.ok(Map.of("shopeeExpressEstimate", shopeeEstimate));
    }

    // ── Helpers ───────────────────────────────────────────────────────

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
