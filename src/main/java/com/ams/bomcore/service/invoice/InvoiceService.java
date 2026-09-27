package com.ams.bomcore.service.invoice;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.invoice.InvoiceEntity;
import com.ams.bomcore.repository.InvoiceRepository;
import com.ams.bomcore.service.shop.CounterShiftGuard;

/**
 * Business logic for Invoice (PURCHASE / SALE).
 * Invoices are stored and returned; they can be referenced by
 * InventoryMovementEntity.referenceId (referenceType = "INVOICE").
 */
@Service
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final JdbcTemplate jdbcTemplate;
    private final CounterShiftGuard counterShiftGuard;

    public InvoiceService(InvoiceRepository invoiceRepository, JdbcTemplate jdbcTemplate,
                          CounterShiftGuard counterShiftGuard) {
        this.invoiceRepository = invoiceRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.counterShiftGuard = counterShiftGuard;
    }

    public Page<InvoiceEntity> list(UUID tenantId, UUID companyId,
                                     String invoiceType, String status,
                                     Pageable pageable) {
        return invoiceRepository.findByFilters(tenantId, companyId, invoiceType, status, pageable);
    }

    public List<InvoiceEntity> listAll(UUID tenantId, UUID companyId) {
        return invoiceRepository.findByTenantIdAndCompanyId(tenantId, companyId);
    }

    public InvoiceEntity getById(UUID id, UUID tenantId, UUID companyId) {
        return invoiceRepository.findByIdAndTenantIdAndCompanyId(id, tenantId, companyId)
                .orElseThrow(() -> new IllegalArgumentException("Invoice not found: " + id));
    }

    @Transactional(rollbackFor = Exception.class)
    public InvoiceEntity create(Map<String, Object> body, UUID tenantId, UUID companyId) {
        String invoiceNumber = str(body, "invoiceNumber");
        if (invoiceNumber == null || invoiceNumber.isBlank()) {
			throw new IllegalArgumentException("invoiceNumber is required");
		}
        if (invoiceRepository.existsByInvoiceNumberAndTenantIdAndCompanyId(invoiceNumber, tenantId, companyId)) {
			throw new IllegalArgumentException("Invoice number already exists: " + invoiceNumber);
		}

        String invoiceType = str(body, "invoiceType");
        if (!InvoiceEntity.TYPE_PURCHASE.equals(invoiceType) && !InvoiceEntity.TYPE_SALE.equals(invoiceType)) {
			throw new IllegalArgumentException("invoiceType must be PURCHASE or SALE");
		}

        InvoiceEntity inv = new InvoiceEntity();
        inv.setTenantId(tenantId);
        inv.setCompanyId(companyId);
        inv.setInvoiceType(invoiceType);
        inv.setInvoiceNumber(invoiceNumber);
        inv.setPartyName(str(body, "partyName"));
        if (body.get("partyId") != null) {
			inv.setPartyId(UUID.fromString(str(body, "partyId")));
		}
        if (body.get("invoiceDate") != null) {
			inv.setInvoiceDate(LocalDate.parse(str(body, "invoiceDate")));
		}
        if (body.get("dueDate") != null) {
			inv.setDueDate(LocalDate.parse(str(body, "dueDate")));
		}
        inv.setCurrency(body.get("currency") != null ? str(body, "currency") : "USD");
        inv.setSubtotal(decimal(body, "subtotal"));
        inv.setTaxAmount(decimal(body, "taxAmount"));
        inv.setTotalAmount(decimal(body, "totalAmount"));
        inv.setNotes(str(body, "notes"));
        inv.setCreatedBy(com.ams.bomcore.audit.AuditActor.username());
        inv.setStatus(InvoiceEntity.STATUS_DRAFT);
        return invoiceRepository.save(inv);
    }

    @Transactional(rollbackFor = Exception.class)
    public InvoiceEntity update(UUID id, Map<String, Object> body, UUID tenantId, UUID companyId) {
        InvoiceEntity inv = getById(id, tenantId, companyId);
        if (body.containsKey("partyName")) {
			inv.setPartyName(str(body, "partyName"));
		}
        if (body.containsKey("partyId") && body.get("partyId") != null) {
			inv.setPartyId(UUID.fromString(str(body, "partyId")));
		}
        if (body.containsKey("invoiceDate") && body.get("invoiceDate") != null) {
			inv.setInvoiceDate(LocalDate.parse(str(body, "invoiceDate")));
		}
        if (body.containsKey("dueDate") && body.get("dueDate") != null) {
			inv.setDueDate(LocalDate.parse(str(body, "dueDate")));
		}
        if (body.containsKey("currency")) {
			inv.setCurrency(str(body, "currency"));
		}
        if (body.containsKey("subtotal")) {
			inv.setSubtotal(decimal(body, "subtotal"));
		}
        if (body.containsKey("taxAmount")) {
			inv.setTaxAmount(decimal(body, "taxAmount"));
		}
        if (body.containsKey("totalAmount")) {
			inv.setTotalAmount(decimal(body, "totalAmount"));
		}
        if (body.containsKey("notes")) {
			inv.setNotes(str(body, "notes"));
		}
        if (body.containsKey("status")) {
			inv.setStatus(str(body, "status"));
		}
        return invoiceRepository.save(inv);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id, UUID tenantId, UUID companyId) {
        InvoiceEntity inv = getById(id, tenantId, companyId);
        invoiceRepository.delete(inv);
    }

    @Transactional(rollbackFor = Exception.class)
    public InvoiceEntity recordPurchasePayment(UUID id, Map<String, Object> body,
                                               UUID tenantId, UUID companyId) {
        InvoiceEntity inv = getById(id, tenantId, companyId);
        if (!InvoiceEntity.TYPE_PURCHASE.equals(inv.getInvoiceType())) {
            throw new IllegalArgumentException("Only purchase invoices can create a payment note");
        }
        if (InvoiceEntity.STATUS_CANCELLED.equals(inv.getStatus())) {
            throw new IllegalArgumentException("Cancelled invoice cannot be paid");
        }

        String method = str(body, "paymentMethod");
        method = method == null ? "" : method.trim().toUpperCase();
        if (!"CASH".equals(method) && !"BANK_QR".equals(method)) {
            throw new IllegalArgumentException("paymentMethod must be CASH or BANK_QR");
        }
        boolean createPaymentNote = Boolean.parseBoolean(String.valueOf(body.getOrDefault("createPaymentNote", false)));
        String paymentNotes = str(body, "paymentNotes");
        UUID paymentNoteId = null;

        if (createPaymentNote) {
            counterShiftGuard.requireOpenForReceipt(tenantId, companyId);
            Long count = jdbcTemplate.queryForObject("""
                    SELECT COUNT(*) FROM shop_payment_note WHERE tenant_id = ? AND company_id = ?
                    """, Long.class, tenantId, companyId);
            String noteNumber = "PC" + String.format("%06d", (count == null ? 0 : count) + 1);
            paymentNoteId = UUID.randomUUID();
            String reason = paymentNotes == null
                    ? "Thanh toán hóa đơn nhập kho " + inv.getInvoiceNumber()
                    : paymentNotes;
            jdbcTemplate.update("""
                    INSERT INTO shop_payment_note
                    (id, tenant_id, company_id, note_number, note_date, object_name, recipient_name,
                     reason, amount, payment_method, invoice_id, created_by, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, now(), now())
                    """, paymentNoteId, tenantId, companyId, noteNumber, Date.valueOf(LocalDate.now()),
                    inv.getPartyName(), inv.getPartyName(), reason, inv.getTotalAmount(), method, inv.getId(),
                    com.ams.bomcore.audit.AuditActor.username());
        }

        inv.setStatus(InvoiceEntity.STATUS_PAID);
        inv.setPaymentMethod(method);
        inv.setPaidAt(Instant.now());
        inv.setPaymentNoteId(paymentNoteId);
        inv.setPaymentNotes(paymentNotes);
        return invoiceRepository.save(inv);
    }

    // ── helpers ──────────────────────────────────────────────────────

    private String str(Map<String, Object> m, String k) {
        return m.get(k) == null ? null : String.valueOf(m.get(k));
    }

    private BigDecimal decimal(Map<String, Object> m, String k) {
        return m.get(k) == null ? BigDecimal.ZERO : new BigDecimal(String.valueOf(m.get(k)));
    }
}
