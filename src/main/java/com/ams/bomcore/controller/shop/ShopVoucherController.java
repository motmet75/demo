package com.ams.bomcore.controller.shop;

import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.service.shop.ShopVoucherService;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.UUID;

@RestController
public class ShopVoucherController {

    private final ShopVoucherService voucherService;
    private final CompanyRepository  companyRepository;

    public ShopVoucherController(ShopVoucherService voucherService, CompanyRepository companyRepository) {
        this.voucherService    = voucherService;
        this.companyRepository = companyRepository;
    }

    // ── Voucher CRUD ──────────────────────────────────────────────────

    @GetMapping("/shop/staff/vouchers")
    public ResponseEntity<?> list(@RequestParam(required = false) UUID tenantId,
                                   @RequestParam(required = false) UUID companyId,
                                   @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                   @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        return ResponseEntity.ok(voucherService.listVouchers(tId, cId));
    }

    @PostMapping("/shop/staff/vouchers")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body,
                                     @RequestParam(required = false) UUID tenantId,
                                     @RequestParam(required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        BigDecimal faceValue  = new BigDecimal(String.valueOf(body.get("faceValue")));
        BigDecimal salePrice  = body.get("salePrice") != null ? new BigDecimal(String.valueOf(body.get("salePrice"))) : null;
        UUID       customerId = body.get("customerId") != null ? UUID.fromString(String.valueOf(body.get("customerId"))) : null;
        UUID       orderId    = body.get("issuedOrderId") != null ? UUID.fromString(String.valueOf(body.get("issuedOrderId"))) : null;
        LocalDate  expiry     = body.get("expiryDate") != null ? LocalDate.parse(String.valueOf(body.get("expiryDate"))) : null;
        String     notes      = body.get("notes") != null ? String.valueOf(body.get("notes")) : null;
        return ResponseEntity.ok(voucherService.createVoucher(tId, cId, faceValue, salePrice, customerId, orderId, expiry, notes));
    }

    @DeleteMapping("/shop/staff/vouchers/{id}")
    public ResponseEntity<?> cancel(@PathVariable UUID id,
                                     @RequestParam(required = false) UUID tenantId,
                                     @RequestParam(required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        return ResponseEntity.ok(voucherService.cancelVoucher(id, tId, cId));
    }

    @PostMapping("/shop/staff/vouchers/detail")
    public ResponseEntity<?> detail(@RequestBody Map<String, Object> body,
                                    @RequestParam(required = false) UUID tenantId,
                                    @RequestParam(required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                    @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        String code = String.valueOf(body.get("code"));
        return ResponseEntity.ok(voucherService.getVoucherDetail(code, tId, cId));
    }

    /** Redeem a voucher (by code or QR payload) against an order. */
    @PostMapping("/shop/staff/vouchers/redeem")
    public ResponseEntity<?> redeem(@RequestBody Map<String, Object> body,
                                     @RequestParam(required = false) UUID tenantId,
                                     @RequestParam(required = false) UUID companyId,
                                     @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                     @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        String code    = String.valueOf(body.get("code"));
        UUID   orderId = UUID.fromString(String.valueOf(body.get("orderId")));
        UUID   billId  = body.get("billId") != null && !String.valueOf(body.get("billId")).isBlank()
            ? UUID.fromString(String.valueOf(body.get("billId"))) : null;
        return ResponseEntity.ok(voucherService.redeemVoucher(code, orderId, billId, tId, cId));
    }

    @DeleteMapping("/shop/staff/orders/{orderId}/voucher")
    public ResponseEntity<?> removeFromOrder(@PathVariable UUID orderId,
                                             @RequestParam(required = false) UUID billId,
                                             @RequestParam(required = false) UUID tenantId,
                                             @RequestParam(required = false) UUID companyId,
                                             @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                             @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant); UUID cId = resolve(companyId, hCompany);
        return ResponseEntity.ok(voucherService.removeVoucher(orderId, billId, tId, cId));
    }

    @PostMapping("/shop/public/vouchers/redeem")
    public ResponseEntity<?> redeemPublic(@RequestBody Map<String, Object> body) {
        try {
            String code = String.valueOf(body.get("code"));
            String orderCode = String.valueOf(body.get("orderCode"));
            return ResponseEntity.ok(voucherService.redeemVoucherForOrderCode(code, orderCode));
        } catch (IllegalArgumentException | IllegalStateException | NoSuchElementException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // ── Key management ────────────────────────────────────────────────

    @GetMapping("/shop/staff/vouchers/key-status")
    public ResponseEntity<?> keyStatus(@RequestParam(required = false) UUID tenantId,
                                        @RequestParam(required = false) UUID companyId,
                                        @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                        @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID cId = resolve(companyId, hCompany);
        var company = companyRepository.findById(cId).orElseThrow();
        boolean set = company.getVoucherSecret() != null && !company.getVoucherSecret().isBlank();
        return ResponseEntity.ok(Map.of("secretSet", set));
    }

    @Transactional
    @PostMapping("/shop/staff/vouchers/rotate-key")
    public ResponseEntity<?> rotateKey(@RequestParam(required = false) UUID tenantId,
                                        @RequestParam(required = false) UUID companyId,
                                        @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                        @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID cId = resolve(companyId, hCompany);
        String newKey = voucherService.rotateVoucherSecret(cId);
        // Return masked key (first 4 + ... + last 4)
        String masked = newKey.length() > 8 ? newKey.substring(0, 4) + "..." + newKey.substring(newKey.length() - 4) : "****";
        return ResponseEntity.ok(Map.of("message", "Key rotated successfully", "keyPreview", masked));
    }

    // ── Util ──────────────────────────────────────────────────────────

    private static UUID resolve(UUID param, String header) {
        if (param != null) return param;
        if (header != null && !header.isBlank()) try { return UUID.fromString(header); } catch (Exception ignored) {}
        return null;
    }
}
