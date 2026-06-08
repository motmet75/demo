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
    public ResponseEntity<?> getOrderStatus(@PathVariable String orderCode,
                                             @RequestParam UUID tenantId, @RequestParam UUID companyId) {
        validateScope(tenantId, companyId);
        return ResponseEntity.ok(shopOrderService.getOrderByCode(orderCode, tenantId, companyId));
    }

    // ── STAFF endpoints (/shop/staff/**) ──────────────────────────────

    @GetMapping("/shop/staff/orders")
    public ResponseEntity<?> listOrders(@RequestParam(required = false) UUID tenantId,
                                         @RequestParam(required = false) UUID companyId,
                                         @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                         @RequestHeader(value = "X-Company-Id", required = false) String hCompany,
                                         @RequestParam(required = false) String status) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
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

    @PatchMapping("/shop/staff/orders/{orderId}/cancel")
    public ResponseEntity<?> cancel(@PathVariable UUID orderId,
                                     @RequestParam(required = false) UUID tenantId,
                                     @RequestParam(required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(shopOrderService.cancelOrder(orderId, tId, cId));
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
