package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "vin_hoadon_company_config",
        uniqueConstraints = @UniqueConstraint(name = "uq_vin_hoadon_config_company", columnNames = {"tenant_id", "company_id"}))
public class VinHoadonCompanyConfig {
    @Id private UUID id;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "company_id", nullable = false) private UUID companyId;
    @Column(nullable = false) private boolean enabled;
    @Column(name = "tax_code", nullable = false, length = 14) private String taxCode;
    @Column(name = "api_username", nullable = false) private String apiUsername;
    @Column(name = "encrypted_api_password", nullable = false, columnDefinition = "text") private String encryptedApiPassword;
    @Column(name = "invoice_template_code", nullable = false, length = 11) private String invoiceTemplateCode;
    @Column(name = "invoice_series", nullable = false, length = 8) private String invoiceSeries;
    @Column(name = "default_vat_rate", nullable = false) private int defaultVatRate = 8;
    @Column(name = "prices_include_vat", nullable = false) private boolean pricesIncludeVat = true;
    @Column(name = "created_at", nullable = false) private Instant createdAt;
    @Column(name = "updated_at", nullable = false) private Instant updatedAt;

    @PrePersist void create() { if (id == null) id = UUID.randomUUID(); if (createdAt == null) createdAt = Instant.now(); updatedAt = Instant.now(); }
    @PreUpdate void update() { updatedAt = Instant.now(); }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getTaxCode() { return taxCode; }
    public void setTaxCode(String taxCode) { this.taxCode = taxCode; }
    public String getApiUsername() { return apiUsername; }
    public void setApiUsername(String apiUsername) { this.apiUsername = apiUsername; }
    public String getEncryptedApiPassword() { return encryptedApiPassword; }
    public void setEncryptedApiPassword(String value) { this.encryptedApiPassword = value; }
    public String getInvoiceTemplateCode() { return invoiceTemplateCode; }
    public void setInvoiceTemplateCode(String value) { this.invoiceTemplateCode = value; }
    public String getInvoiceSeries() { return invoiceSeries; }
    public void setInvoiceSeries(String invoiceSeries) { this.invoiceSeries = invoiceSeries; }
    public int getDefaultVatRate() { return defaultVatRate; }
    public void setDefaultVatRate(int value) { this.defaultVatRate = value; }
    public boolean isPricesIncludeVat() { return pricesIncludeVat; }
    public void setPricesIncludeVat(boolean value) { this.pricesIncludeVat = value; }
}
