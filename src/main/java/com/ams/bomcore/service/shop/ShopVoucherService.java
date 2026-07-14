package com.ams.bomcore.service.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.shop.ShopBill;
import com.ams.bomcore.domain.shop.ShopBillItem;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopOrderItem;
import com.ams.bomcore.domain.shop.ShopVoucher;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.ShopBillItemRepository;
import com.ams.bomcore.repository.ShopBillRepository;
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
    private final ShopBillRepository     billRepository;
    private final ShopBillItemRepository billItemRepository;
    private final CompanyRepository      companyRepository;

    public ShopVoucherService(ShopVoucherRepository voucherRepository,
                              ShopOrderRepository orderRepository,
                              ShopOrderItemRepository orderItemRepository,
                              ShopBillRepository billRepository,
                              ShopBillItemRepository billItemRepository,
                              CompanyRepository companyRepository) {
        this.voucherRepository   = voucherRepository;
        this.orderRepository     = orderRepository;
        this.orderItemRepository = orderItemRepository;
        this.billRepository      = billRepository;
        this.billItemRepository  = billItemRepository;
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

    /** Redeem: apply voucher value as discount to a bill. */
    @Transactional
    public Map<String, Object> redeemVoucher(String codeOrPayload, UUID orderId,
                                              UUID tenantId, UUID companyId) {
        return redeemVoucher(codeOrPayload, orderId, null, tenantId, companyId);
    }

    @Transactional
    public Map<String, Object> redeemVoucher(String codeOrPayload, UUID orderId, UUID billId,
                                              UUID tenantId, UUID companyId) {
        ShopOrder order = orderRepository.findById(orderId)
            .filter(o -> o.getTenantId().equals(tenantId) && o.getCompanyId().equals(companyId))
            .orElseThrow(() -> new NoSuchElementException("Order not found"));
        return redeemVoucherForOrder(codeOrPayload, order, billId, tenantId, companyId);
    }

    @Transactional
    public Map<String, Object> redeemVoucherForOrderCode(String codeOrPayload, String orderCode) {
        ShopOrder order = orderRepository.findByOrderCode(orderCode)
            .orElseThrow(() -> new NoSuchElementException("Order not found: " + orderCode));
        return redeemVoucherForOrder(codeOrPayload, order, null, order.getTenantId(), order.getCompanyId());
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
        return removeVoucher(orderId, null, tenantId, companyId);
    }

    @Transactional
    public ShopOrderResponseDto removeVoucher(UUID orderId, UUID billId, UUID tenantId, UUID companyId) {
        var company = companyRepository.findById(companyId).orElseThrow();
        ShopOrder order = orderRepository.findById(orderId)
            .filter(o -> o.getTenantId().equals(tenantId) && o.getCompanyId().equals(companyId))
            .orElseThrow(() -> new NoSuchElementException("Order not found"));
        ShopBill bill = resolveBill(order, billId);
        removeExistingVoucherFromBill(bill, tenantId, companyId);
        recalcBillTotals(bill);
        syncOrderFromBills(order);
        refreshPaymentQr(order, company);
        orderRepository.save(order);
        return ShopOrderResponseDto.from(order, orderItemRepository.findAllByOrder_Id(order.getId()));
    }

    private Map<String, Object> redeemVoucherForOrder(String codeOrPayload, ShopOrder order, UUID billId,
                                                       UUID tenantId, UUID companyId) {
        var company = companyRepository.findById(companyId).orElseThrow();
        String secret = company.getVoucherSecret();
        if (!order.getTenantId().equals(tenantId) || !order.getCompanyId().equals(companyId))
            throw new IllegalArgumentException("Order does not belong to this company");

        ShopBill bill = resolveBill(order, billId);

        // Accept either raw code or QR payload
        String code = normalizeVoucherCode(codeOrPayload, secret);

        ShopVoucher v = voucherRepository
            .findByTenantIdAndCompanyIdAndCode(tenantId, companyId, code)
            .orElseThrow(() -> new NoSuchElementException("Voucher not found: " + code));

        if (sameVoucher(bill, v)) {
            return redeemResult(v, order, bill, secret, BigDecimal.ZERO);
        }

        if (!ShopVoucher.STATUS_ACTIVE.equals(v.getStatus()))
            throw new IllegalStateException("Voucher is " + v.getStatus().toLowerCase());
        if (isExpired(v))
            throw new IllegalStateException("Voucher has expired");

        removeExistingVoucherFromBill(bill, tenantId, companyId);

        BigDecimal current = bill.getDiscountAmount() != null ? bill.getDiscountAmount() : BigDecimal.ZERO;
        bill.setDiscountAmount(current.add(v.getFaceValue() != null ? v.getFaceValue() : BigDecimal.ZERO));
        bill.setVoucherCode(v.getCode());
        billRepository.save(bill);
        recalcBillTotals(bill);
        syncOrderFromBills(order);
        refreshPaymentQr(order, company);
        orderRepository.save(order);

        v.setStatus(ShopVoucher.STATUS_USED);
        v.setRedeemedAt(Instant.now());
        v.setRedeemedOrderId(order.getId());
        v.setRedeemedBillId(bill.getId());
        v.setRedeemedCustomerId(order.getCustomerId());
        v.setRedeemedCustomerName(order.getCustomerName());
        voucherRepository.save(v);

        return redeemResult(v, order, bill, secret, v.getFaceValue());
    }

    private Map<String, Object> redeemResult(ShopVoucher v, ShopOrder order, ShopBill bill, String secret, BigDecimal discountApplied) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("voucher", toMap(v, secret));
        result.put("discountApplied", discountApplied);
        result.put("newDiscountTotal", order.getDiscountAmount());
        result.put("newBillDiscountTotal", bill != null ? bill.getDiscountAmount() : null);
        result.put("billId", bill != null ? bill.getId() : null);
        result.put("billNumber", bill != null ? bill.getBillNumber() : null);
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

    private BigDecimal money(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private BigDecimal nonNegative(BigDecimal value) {
        BigDecimal safe = money(value);
        return safe.compareTo(BigDecimal.ZERO) > 0 ? safe : BigDecimal.ZERO;
    }

    private BigDecimal sumLineTotals(List<ShopOrderItem> items) {
        return items.stream()
                .map(item -> money(item.getLineTotal()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sumRawCost(List<ShopOrderItem> items) {
        return items.stream()
                .map(item -> item.getUnitRawCost() != null && item.getQuantity() != null
                        ? item.getUnitRawCost().multiply(item.getQuantity()) : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal billDiscountAmount(ShopBill bill) {
        if (bill == null) return BigDecimal.ZERO;
        BigDecimal discount = nonNegative(bill.getDiscountAmount());
        BigDecimal total = nonNegative(bill.getTotalAmount());
        return discount.compareTo(total) > 0 ? total : discount;
    }

    private String cleanVoucherCodes(String value) {
        if (value == null || value.isBlank()) return null;
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        for (String part : value.split(",")) {
            String clean = part == null ? "" : part.trim();
            if (!clean.isBlank()) codes.add(clean);
        }
        return codes.isEmpty() ? null : String.join(", ", codes);
    }

    private String combineVoucherCodes(String... values) {
        if (values == null || values.length == 0) return null;
        LinkedHashSet<String> codes = new LinkedHashSet<>();
        for (String value : values) {
            String clean = cleanVoucherCodes(value);
            if (clean == null) continue;
            for (String part : clean.split(",")) {
                String code = part.trim();
                if (!code.isBlank()) codes.add(code);
            }
        }
        return codes.isEmpty() ? null : String.join(", ", codes);
    }

    private List<ShopBill> activeBills(ShopOrder order) {
        return billRepository.findAllByOrder_IdAndStatusOrderByCreatedAtAsc(order.getId(), ShopBill.STATUS_ACTIVE);
    }

    private ShopBill resolveBill(ShopOrder order, UUID billId) {
        ensureOrderBills(order);
        List<ShopBill> bills = activeBills(order);
        if (billId != null) {
            return bills.stream()
                    .filter(bill -> billId.equals(bill.getId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("Bill not found for this order"));
        }
        if (bills.size() == 1) return bills.get(0);
        if (bills.isEmpty()) throw new IllegalArgumentException("This order has no active bill");
        throw new IllegalArgumentException("Select which bill receives the voucher");
    }

    private void ensureOrderBills(ShopOrder order) {
        List<ShopBill> active = activeBills(order);
        ShopBill bill = active.stream().findFirst().orElse(null);
        if (bill == null) {
            bill = new ShopBill();
            bill.setTenantId(order.getTenantId());
            bill.setCompanyId(order.getCompanyId());
            bill.setOrder(order);
            bill.setBillNumber((int) billRepository.countByOrder_Id(order.getId()) + 1);
            bill.setStatus(ShopBill.STATUS_ACTIVE);
            bill.setTotalAmount(BigDecimal.ZERO);
            bill.setTotalRawCost(BigDecimal.ZERO);
            bill.setDiscountAmount(nonNegative(order.getDiscountAmount()));
            bill.setVoucherCode(cleanVoucherCodes(order.getVoucherCode()));
            bill = billRepository.save(bill);
        }

        Map<UUID, ShopBillItem> byItemId = new HashMap<>();
        for (ShopBillItem assignment : billItemRepository.findAllByOrderItem_Order_Id(order.getId())) {
            if (assignment.getOrderItem() != null) byItemId.put(assignment.getOrderItem().getId(), assignment);
        }
        List<ShopBillItem> missing = new ArrayList<>();
        for (ShopOrderItem item : orderItemRepository.findAllByOrder_Id(order.getId())) {
            if (byItemId.containsKey(item.getId())) continue;
            ShopBillItem assignment = new ShopBillItem();
            assignment.setBill(bill);
            assignment.setOriginalBill(bill);
            assignment.setOrderItem(item);
            missing.add(assignment);
        }
        if (!missing.isEmpty()) billItemRepository.saveAll(missing);
        for (ShopBill activeBill : activeBills(order)) recalcBillTotals(activeBill);
        syncOrderFromBills(order);
    }

    private void recalcBillTotals(ShopBill bill) {
        List<ShopOrderItem> items = billItemRepository.findAllByBill_Id(bill.getId()).stream()
                .map(ShopBillItem::getOrderItem)
                .filter(Objects::nonNull)
                .toList();
        BigDecimal total = sumLineTotals(items);
        bill.setTotalAmount(total);
        bill.setTotalRawCost(sumRawCost(items));
        BigDecimal discount = nonNegative(bill.getDiscountAmount());
        if (discount.compareTo(total) > 0) discount = total;
        bill.setDiscountAmount(discount);
        bill.setVoucherCode(cleanVoucherCodes(bill.getVoucherCode()));
        billRepository.save(bill);
    }

    private void syncOrderFromBills(ShopOrder order) {
        List<ShopBill> bills = activeBills(order);
        BigDecimal itemTotal = bills.stream()
                .map(bill -> money(bill.getTotalAmount()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal rawTotal = bills.stream()
                .map(bill -> money(bill.getTotalRawCost()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal discountTotal = bills.stream()
                .map(this::billDiscountAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal fee = money(order.getDeliveryFee());
        order.setTotalAmount(itemTotal.add(fee));
        order.setTotalRawCost(rawTotal);
        order.setDiscountAmount(discountTotal);
        order.setVoucherCode(combineVoucherCodes(bills.stream().map(ShopBill::getVoucherCode).toArray(String[]::new)));
    }

    private boolean sameVoucher(ShopBill bill, ShopVoucher v) {
        return bill != null
            && bill.getVoucherCode() != null
            && bill.getVoucherCode().equalsIgnoreCase(v.getCode())
            && bill.getId().equals(v.getRedeemedBillId());
    }

    private void removeExistingVoucherFromBill(ShopBill bill, UUID tenantId, UUID companyId) {
        String currentCode = bill.getVoucherCode();
        if (currentCode == null || currentCode.isBlank()) return;

        voucherRepository
            .findByTenantIdAndCompanyIdAndCode(tenantId, companyId, currentCode.trim().toUpperCase())
            .filter(v -> bill.getId().equals(v.getRedeemedBillId()))
            .ifPresent(v -> {
                BigDecimal discount = bill.getDiscountAmount() != null ? bill.getDiscountAmount() : BigDecimal.ZERO;
                BigDecimal face = v.getFaceValue() != null ? v.getFaceValue() : BigDecimal.ZERO;
                BigDecimal next = discount.subtract(face);
                bill.setDiscountAmount(next.compareTo(BigDecimal.ZERO) > 0 ? next : BigDecimal.ZERO);
                v.setStatus(ShopVoucher.STATUS_ACTIVE);
                v.setRedeemedAt(null);
                v.setRedeemedOrderId(null);
                v.setRedeemedBillId(null);
                v.setRedeemedCustomerId(null);
                v.setRedeemedCustomerName(null);
                voucherRepository.save(v);
            });
        bill.setVoucherCode(null);
        billRepository.save(bill);
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
