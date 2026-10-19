package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Entity
@Table(name = "vin_hoadon_shop_invoice")
public class VinHoadonShopInvoice {
    @Id private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "company_id", nullable = false) private UUID companyId;
    @Column(name = "external_invoice_id", nullable = false, unique = true, length = 50) private String externalInvoiceId;
    @Column(nullable = false, length = 20) private String status;
    @Column(name = "buyer_tax_code", length = 14) private String buyerTaxCode;
    @Column(name = "buyer_organization_name") private String buyerOrganizationName;
    @Column(name = "buyer_name") private String buyerName;
    @Column(name = "buyer_address") private String buyerAddress;
    @Column(name = "buyer_phone", length = 20) private String buyerPhone;
    @Column(name = "buyer_email", length = 100) private String buyerEmail;
    @Column(name = "payment_method", nullable = false) private int paymentMethod;
    @Column(name = "vat_rate", nullable = false) private int vatRate;
    @Column(nullable = false, precision = 18, scale = 6) private BigDecimal subtotal;
    @Column(name = "tax_amount", nullable = false, precision = 18, scale = 6) private BigDecimal taxAmount;
    @Column(name = "total_amount", nullable = false, precision = 18, scale = 6) private BigDecimal totalAmount;
    @Column(name = "vendor_result_code") private String vendorResultCode;
    @Column(name = "vendor_result_message", columnDefinition = "text") private String vendorResultMessage;
    @Column(name = "vendor_transaction_id") private String vendorTransactionId;
    @Column(name = "invoice_template_code", length = 11) private String invoiceTemplateCode;
    @Column(name = "invoice_series", length = 8) private String invoiceSeries;
    @Column(name = "invoice_number") private String invoiceNumber;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "request_payload", columnDefinition = "jsonb") private Map<String, Object> requestPayload;
    @JdbcTypeCode(SqlTypes.JSON) @Column(name = "response_payload", columnDefinition = "jsonb") private Map<String, Object> responsePayload;
    @Column(name = "created_by") private String createdBy;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "issued_at") private Instant issuedAt;
    @Column(name = "last_attempt_at") private Instant lastAttemptAt;
    @Column(name = "last_synced_at") private Instant lastSyncedAt;
    @Column(name = "tax_authority_status", length = 20) private String taxAuthorityStatus;
    @Column(name = "attempt_count", nullable = false) private int attemptCount;

    @PrePersist void create() { if (id == null) id = UUID.randomUUID(); if (createdAt == null) createdAt = Instant.now(); }
    public UUID getId() { return id; } public void setId(UUID v) { id = v; }
    public UUID getTenantId() { return tenantId; } public void setTenantId(UUID v) { tenantId = v; }
    public UUID getCompanyId() { return companyId; } public void setCompanyId(UUID v) { companyId = v; }
    public String getExternalInvoiceId() { return externalInvoiceId; } public void setExternalInvoiceId(String v) { externalInvoiceId = v; }
    public String getStatus() { return status; } public void setStatus(String v) { status = v; }
    public String getBuyerTaxCode() { return buyerTaxCode; } public void setBuyerTaxCode(String v) { buyerTaxCode = v; }
    public String getBuyerOrganizationName() { return buyerOrganizationName; } public void setBuyerOrganizationName(String v) { buyerOrganizationName = v; }
    public String getBuyerName() { return buyerName; } public void setBuyerName(String v) { buyerName = v; }
    public String getBuyerAddress() { return buyerAddress; } public void setBuyerAddress(String v) { buyerAddress = v; }
    public String getBuyerPhone() { return buyerPhone; } public void setBuyerPhone(String v) { buyerPhone = v; }
    public String getBuyerEmail() { return buyerEmail; } public void setBuyerEmail(String v) { buyerEmail = v; }
    public int getPaymentMethod() { return paymentMethod; } public void setPaymentMethod(int v) { paymentMethod = v; }
    public int getVatRate() { return vatRate; } public void setVatRate(int v) { vatRate = v; }
    public BigDecimal getSubtotal() { return subtotal; } public void setSubtotal(BigDecimal v) { subtotal = v; }
    public BigDecimal getTaxAmount() { return taxAmount; } public void setTaxAmount(BigDecimal v) { taxAmount = v; }
    public BigDecimal getTotalAmount() { return totalAmount; } public void setTotalAmount(BigDecimal v) { totalAmount = v; }
    public String getVendorResultCode() { return vendorResultCode; } public void setVendorResultCode(String v) { vendorResultCode = v; }
    public String getVendorResultMessage() { return vendorResultMessage; } public void setVendorResultMessage(String v) { vendorResultMessage = v; }
    public String getVendorTransactionId() { return vendorTransactionId; } public void setVendorTransactionId(String v) { vendorTransactionId = v; }
    public String getInvoiceTemplateCode() { return invoiceTemplateCode; } public void setInvoiceTemplateCode(String v) { invoiceTemplateCode = v; }
    public String getInvoiceSeries() { return invoiceSeries; } public void setInvoiceSeries(String v) { invoiceSeries = v; }
    public String getInvoiceNumber() { return invoiceNumber; } public void setInvoiceNumber(String v) { invoiceNumber = v; }
    public Map<String, Object> getRequestPayload() { return requestPayload; } public void setRequestPayload(Map<String, Object> v) { requestPayload = v; }
    public Map<String, Object> getResponsePayload() { return responsePayload; } public void setResponsePayload(Map<String, Object> v) { responsePayload = v; }
    public String getCreatedBy() { return createdBy; } public void setCreatedBy(String v) { createdBy = v; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getIssuedAt() { return issuedAt; } public void setIssuedAt(Instant v) { issuedAt = v; }
    public Instant getLastAttemptAt() { return lastAttemptAt; } public void setLastAttemptAt(Instant v) { lastAttemptAt = v; }
    public Instant getLastSyncedAt() { return lastSyncedAt; } public void setLastSyncedAt(Instant v) { lastSyncedAt = v; }
    public String getTaxAuthorityStatus() { return taxAuthorityStatus; } public void setTaxAuthorityStatus(String v) { taxAuthorityStatus = v; }
    public int getAttemptCount() { return attemptCount; } public void setAttemptCount(int v) { attemptCount = v; }
}
