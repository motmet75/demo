package com.ams.bomcore.service.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopVoucher;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.ShopOrderItemRepository;
import com.ams.bomcore.repository.ShopOrderRepository;
import com.ams.bomcore.repository.ShopVoucherRepository;
import com.ams.bomcore.util.QrCodeUtil;
import com.ams.bomcore.util.VietQrBuilder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

@Service
public class ShopVoucherService {

    private static final String ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // unambiguous chars
    private static final SecureRandom RNG = new SecureRandom();

    private final ShopVoucherRepository  voucherRepository;
    private final ShopOrderRepository    orderRepository;
    private final ShopOrderItemRepository orderItemRepository;
    private final CompanyRepository      companyRepository;

    public ShopVoucherService(ShopVoucherRepository voucherRepository,
                              ShopOrderRepository orderRepository,
                              ShopOrderItemRepository orderItemRepository,
                              CompanyRepository companyRepository) {
        this.voucherRepository   = voucherRepository;
        this.orderRepository     = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.companyRepository   = companyRepository;
    }

    // ── QR signing ────────────────────────────────────────────────────

    /** Payload stored in QR: "BV:{code}:{hmac12}" */
    public String encodeQrPayload(String code, String secret) {
        String sig = hmacHex(code, secret).substring(0, 12);
        return "BV:" + code + ":" + sig;
    }

    /** Returns voucher code if payload is valid, throws if tampered. */
    public String decodeQrPayload(String payload, String secret) {
        if (payload == null || !payload.startsWith("BV:"))
            throw new IllegalArgumentException("Invalid voucher QR");
        String[] parts = payload.split(":", 3);
        if (parts.length != 3) throw new IllegalArgumentException("Invalid voucher QR format");
        String code   = parts[1];
        String givenSig = parts[2];
        String expectedSig = hmacHex(code, secret).substring(0, 12);
        if (!expectedSig.equals(givenSig)) throw new IllegalArgumentException("Voucher QR signature mismatch");
        return code;
    }

    private static String hmacHex(String data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : raw) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) { throw new RuntimeException(e); }
    }

    // ── CRUD ──────────────────────────────────────────────────────────

    public List<Map<String, Object>> listVouchers(UUID tenantId, UUID companyId) {
        var company = companyRepository.findById(companyId).orElseThrow();
        String secret = company.getVoucherSecret();
        return voucherRepository
            .findAllByTenantIdAndCompanyIdOrderByCreatedAtDesc(tenantId, companyId)
            .stream()
            .map(v -> toMap(v, secret))
            .toList();
    }

    @Transactional
    public Map<String, Object> createVoucher(UUID tenantId, UUID companyId,
                                              BigDecimal faceValue, BigDecimal salePrice,
                                              UUID customerId, UUID issuedOrderId,
                                              LocalDate expiryDate, String notes) {
        var company = companyRepository.findById(companyId).orElseThrow();
        if (company.getVoucherSecret() == null || company.getVoucherSecret().isBlank())
            throw new IllegalStateException("Voucher secret key not set. Configure it in Shop Setup → Key Management first.");

        String code = generateUniqueCode(tenantId, companyId);
        ShopVoucher v = new ShopVoucher();
        v.setTenantId(tenantId); v.setCompanyId(companyId);
        v.setCode(code);
        v.setFaceValue(faceValue);
        v.setSalePrice(salePrice);
        v.setCustomerId(customerId);
        v.setIssuedOrderId(issuedOrderId);
        v.setExpiryDate(expiryDate);
        v.setNotes(notes);
        voucherRepository.save(v);
        return toMap(v, company.getVoucherSecret());
    }

    @Transactional
    public Map<String, Object> cancelVoucher(UUID voucherId, UUID tenantId, UUID companyId) {
        ShopVoucher v = voucherRepository.findById(voucherId)
            .filter(x -> x.getTenantId().equals(tenantId) && x.getCompanyId().equals(companyId))
            .orElseThrow(() -> new NoSuchElementException("Voucher not found"));
        if (ShopVoucher.STATUS_USED.equals(v.getStatus()))
            throw new IllegalStateException("Cannot cancel an already-used voucher");
        v.setStatus(ShopVoucher.STATUS_CANCELLED);
        voucherRepository.save(v);
        var company = companyRepository.findById(companyId).orElseThrow();
        return toMap(v, company.getVoucherSecret());
    }

    /** Redeem: apply voucher value as discount to an order. */
    @Transactional
    public Map<String, Object> redeemVoucher(String codeOrPayload, UUID orderId,
                                              UUID tenantId, UUID companyId) {
        ShopOrder order = orderRepository.findById(orderId)
            .filter(o -> o.getTenantId().equals(tenantId) && o.getCompanyId().equals(companyId))
            .orElseThrow(() -> new NoSuchElementException("Order not found"));
        return redeemVoucherForOrder(codeOrPayload, order, tenantId, companyId);
    }

    @Transactional
    public Map<String, Object> redeemVoucherForOrderCode(String codeOrPayload, String orderCode) {
        ShopOrder order = orderRepository.findByOrderCode(orderCode)
            .orElseThrow(() -> new NoSuchElementException("Order not found: " + orderCode));
        return redeemVoucherForOrder(codeOrPayload, order, order.getTenantId(), order.getCompanyId());
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getVoucherDetail(String codeOrPayload, UUID tenantId, UUID companyId) {
        var company = companyRepository.findById(companyId).orElseThrow();
        String secret = company.getVoucherSecret();
        String code = normalizeVoucherCode(codeOrPayload, secret);
        ShopVoucher v = voucherRepository
            .findByTenantIdAndCompanyIdAndCode(tenantId, companyId, code)
            .orElseThrow(() -> new NoSuchElementException("Voucher not found: " + code));
        return toMap(v, secret);
    }

    @Transactional
    public ShopOrderResponseDto removeVoucher(UUID orderId, UUID tenantId, UUID companyId) {
        var company = companyRepository.findById(companyId).orElseThrow();
        ShopOrder order = orderRepository.findById(orderId)
            .filter(o -> o.getTenantId().equals(tenantId) && o.getCompanyId().equals(companyId))
            .orElseThrow(() -> new NoSuchElementException("Order not found"));
        removeExistingVoucherFromOrder(order, tenantId, companyId);
        refreshPaymentQr(order, company);
        orderRepository.save(order);
        return ShopOrderResponseDto.from(order, orderItemRepository.findAllByOrder_Id(order.getId()));
    }

    private Map<String, Object> redeemVoucherForOrder(String codeOrPayload, ShopOrder order,
                                                       UUID tenantId, UUID companyId) {
        var company = companyRepository.findById(companyId).orElseThrow();
        String secret = company.getVoucherSecret();
        if (!order.getTenantId().equals(tenantId) || !order.getCompanyId().equals(companyId))
            throw new IllegalArgumentException("Order does not belong to this company");

        // Accept either raw code or QR payload
        String code = normalizeVoucherCode(codeOrPayload, secret);

        ShopVoucher v = voucherRepository
            .findByTenantIdAndCompanyIdAndCode(tenantId, companyId, code)
            .orElseThrow(() -> new NoSuchElementException("Voucher not found: " + code));

        if (sameVoucher(order, v)) {
            return redeemResult(v, order, secret, BigDecimal.ZERO);
        }

        if (!ShopVoucher.STATUS_ACTIVE.equals(v.getStatus()))
            throw new IllegalStateException("Voucher is " + v.getStatus().toLowerCase());
        if (isExpired(v))
            throw new IllegalStateException("Voucher has expired");

        removeExistingVoucherFromOrder(order, tenantId, companyId);

        // Apply as discount
        BigDecimal current = order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO;
        order.setDiscountAmount(current.add(v.getFaceValue()));
        order.setVoucherCode(v.getCode());
        refreshPaymentQr(order, company);
        orderRepository.save(order);

        v.setStatus(ShopVoucher.STATUS_USED);
        v.setRedeemedAt(Instant.now());
        v.setRedeemedOrderId(order.getId());
        v.setRedeemedCustomerId(order.getCustomerId());
        v.setRedeemedCustomerName(order.getCustomerName());
        voucherRepository.save(v);

        return redeemResult(v, order, secret, v.getFaceValue());
    }

    private Map<String, Object> redeemResult(ShopVoucher v, ShopOrder order, String secret, BigDecimal discountApplied) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("voucher", toMap(v, secret));
        result.put("discountApplied", discountApplied);
        result.put("newDiscountTotal", order.getDiscountAmount());
        result.put("redeemedCustomerId", order.getCustomerId());
        result.put("redeemedCustomerName", order.getCustomerName());
        result.put("order", ShopOrderResponseDto.from(order, orderItemRepository.findAllByOrder_Id(order.getId())));
        return result;
    }

    // ── Key management ────────────────────────────────────────────────

    @Transactional
    public String rotateVoucherSecret(UUID companyId) {
        var company = companyRepository.findById(companyId).orElseThrow();
        // 32-char random hex key
        byte[] keyBytes = new byte[16];
        RNG.nextBytes(keyBytes);
        StringBuilder sb = new StringBuilder();
        for (byte b : keyBytes) sb.append(String.format("%02x", b));
        String newSecret = sb.toString();
        company.setVoucherSecret(newSecret);
        companyRepository.save(company);
        return newSecret;
    }

    // ── Helpers ───────────────────────────────────────────────────────

    private boolean hasBankConfig(Company company) {
        return company != null
                && company.getBankBin() != null && !company.getBankBin().isBlank()
                && company.getBankAccountNumber() != null && !company.getBankAccountNumber().isBlank();
    }

    private BigDecimal payableAmount(ShopOrder order) {
        BigDecimal total = order.getTotalAmount() != null ? order.getTotalAmount() : BigDecimal.ZERO;
        BigDecimal discount = order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO;
        BigDecimal payable = total.subtract(discount);
        return payable.compareTo(BigDecimal.ZERO) > 0 ? payable : BigDecimal.ZERO;
    }

    private String normalizeVoucherCode(String codeOrPayload, String secret) {
        if (codeOrPayload == null || codeOrPayload.isBlank())
            throw new IllegalArgumentException("Voucher code is required");
        String clean = codeOrPayload.trim();
        if (clean.startsWith("BV:")) return decodeQrPayload(clean, secret);
        return clean.toUpperCase();
    }

    private boolean isExpired(ShopVoucher v) {
        return v.getExpiryDate() != null && v.getExpiryDate().isBefore(LocalDate.now());
    }

    private boolean sameVoucher(ShopOrder order, ShopVoucher v) {
        return order.getVoucherCode() != null
            && order.getVoucherCode().equalsIgnoreCase(v.getCode())
            && order.getId().equals(v.getRedeemedOrderId());
    }

    private void removeExistingVoucherFromOrder(ShopOrder order, UUID tenantId, UUID companyId) {
        String currentCode = order.getVoucherCode();
        if (currentCode == null || currentCode.isBlank()) return;

        voucherRepository
            .findByTenantIdAndCompanyIdAndCode(tenantId, companyId, currentCode.trim().toUpperCase())
            .filter(v -> order.getId().equals(v.getRedeemedOrderId()))
            .ifPresent(v -> {
                BigDecimal discount = order.getDiscountAmount() != null ? order.getDiscountAmount() : BigDecimal.ZERO;
                BigDecimal face = v.getFaceValue() != null ? v.getFaceValue() : BigDecimal.ZERO;
                BigDecimal next = discount.subtract(face);
                order.setDiscountAmount(next.compareTo(BigDecimal.ZERO) > 0 ? next : BigDecimal.ZERO);
                v.setStatus(ShopVoucher.STATUS_ACTIVE);
                v.setRedeemedAt(null);
                v.setRedeemedOrderId(null);
                v.setRedeemedCustomerId(null);
                v.setRedeemedCustomerName(null);
                voucherRepository.save(v);
            });
        order.setVoucherCode(null);
    }

    private BigDecimal splitCashPortion(ShopOrder order) {
        BigDecimal payable = payableAmount(order);
        BigDecimal cash = order.getSplitCashAmount() != null ? order.getSplitCashAmount() : BigDecimal.ZERO;
        if (cash.compareTo(BigDecimal.ZERO) < 0) return BigDecimal.ZERO;
        return cash.compareTo(payable) > 0 ? payable : cash;
    }

    private void refreshPaymentQr(ShopOrder order, Company company) {
        BigDecimal amount;
        if (ShopOrder.PAYMENT_BANK_QR.equals(order.getPaymentMethod())) {
            amount = payableAmount(order);
        } else if (ShopOrder.PAYMENT_SPLIT.equals(order.getPaymentMethod())) {
            BigDecimal cash = splitCashPortion(order);
            order.setSplitCashAmount(cash);
            amount = payableAmount(order).subtract(cash);
        } else {
            order.setPaymentQr(null);
            return;
        }

        if (amount.compareTo(BigDecimal.ZERO) <= 0 || !hasBankConfig(company)) {
            order.setPaymentQr(null);
            return;
        }

        order.setPaymentQr(VietQrBuilder.buildUrl(
                company.getBankBin(), company.getBankAccountNumber(),
                company.getBankAccountName(), amount, order.getOrderCode()));
    }
    private String generateUniqueCode(UUID tenantId, UUID companyId) {
        for (int attempt = 0; attempt < 20; attempt++) {
            StringBuilder sb = new StringBuilder(10);
            for (int i = 0; i < 10; i++) sb.append(ALPHA.charAt(RNG.nextInt(ALPHA.length())));
            String code = sb.toString();
            if (!voucherRepository.existsByTenantIdAndCompanyIdAndCode(tenantId, companyId, code))
                return code;
        }
        throw new RuntimeException("Failed to generate unique voucher code");
    }

    private Map<String, Object> toMap(ShopVoucher v, String secret) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id",             v.getId());
        m.put("code",           v.getCode());
        m.put("faceValue",      v.getFaceValue());
        m.put("salePrice",      v.getSalePrice());
        m.put("status",         v.getStatus());
        m.put("customerId",     v.getCustomerId());
        m.put("issuedOrderId",  v.getIssuedOrderId());
        m.put("redeemedOrderId",v.getRedeemedOrderId());
        m.put("redeemedCustomerId", v.getRedeemedCustomerId());
        m.put("redeemedCustomerName", v.getRedeemedCustomerName());
        m.put("redeemedAt",     v.getRedeemedAt());
        if (v.getRedeemedOrderId() != null) {
            orderRepository.findById(v.getRedeemedOrderId()).ifPresent(order -> {
                m.put("redeemedOrderNumber", order.getOrderNumber());
                m.put("redeemedOrderCode", order.getOrderCode());
            });
        }
        m.put("expiryDate",     v.getExpiryDate());
        m.put("expired",        isExpired(v));
        m.put("notes",          v.getNotes());
        m.put("createdAt",      v.getCreatedAt());
        if (secret != null && ShopVoucher.STATUS_ACTIVE.equals(v.getStatus()) && !isExpired(v)) {
            String payload = encodeQrPayload(v.getCode(), secret);
            m.put("qrPayload", payload);
            try { m.put("qrBase64", QrCodeUtil.generateBase64Png(payload, 300)); } catch (Exception e) { /* skip */ }
        }
        return m;
    }
}
