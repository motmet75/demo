package com.ams.bomcore.domain.contract;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;

/**
 * JPA entity mapping for table `contract` in bom_core_schema.sql
 */
@Entity
@Table(name = "contract",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_contract_number_tenant_purchasing", columnNames = {"contract_number", "tenant_id", "purchasing_company_id","supplier_company_id"})
        })
public class Contract {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @ManyToOne
    @JoinColumn(name = "supplier_company_id", nullable = false)
    private Company supplierCompany;

    @ManyToOne
    @JoinColumn(name = "purchasing_company_id", nullable = false)
    private Company purchasingCompany;

    @Column(name = "contract_number", nullable = false, length = 100)
    private String contractNumber;

    @Column(name = "title", columnDefinition = "TEXT")
    private String title;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "contract_type", length = 100)
    private String contractType;

    @Column(name = "category", length = 100)
    private String category;

    @Column(name = "status", length = 50)
    private String status; // DRAFT, PENDING_APPROVAL, ACTIVE, SUSPENDED, EXPIRED, TERMINATED, CLOSED

    @Column(name = "start_date")
    private Instant startDate;

    @Column(name = "end_date")
    private Instant endDate;

    @Column(name = "signing_date")
    private Instant signingDate;

    @Column(name = "effective_date")
    private Instant effectiveDate;

    @Column(name = "termination_date")
    private Instant terminationDate;

    @Column(name = "total_value", precision = 19, scale = 4)
    private BigDecimal totalValue;

    @Column(name = "currency", length = 10)
    private String currency;

    @Column(name = "payment_terms", length = 255)
    private String paymentTerms;

    @Column(name = "is_auto_renew")
    private Boolean isAutoRenew;

    @Column(name = "renewal_notice_days")
    private Integer renewalNoticeDays;

    @Column(name = "attachment_path", length = 1024)
    private String attachmentPath;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at")
    private Instant createdAt;

    public Contract() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public Tenant getTenant() { return tenant; }
    public void setTenant(Tenant tenant) { this.tenant = tenant; }

    public Company getCompany() { return company; }
    public void setCompany(Company company) { this.company = company; }

    public Company getSupplierCompany() { return supplierCompany; }
    public void setSupplierCompany(Company supplierCompany) { this.supplierCompany = supplierCompany; }

    public Company getPurchasingCompany() { return purchasingCompany; }
    public void setPurchasingCompany(Company purchasingCompany) { this.purchasingCompany = purchasingCompany; }

    public String getContractNumber() { return contractNumber; }
    public void setContractNumber(String contractNumber) { this.contractNumber = contractNumber; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getContractType() { return contractType; }
    public void setContractType(String contractType) { this.contractType = contractType; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getStartDate() { return startDate; }
    public void setStartDate(Instant startDate) { this.startDate = startDate; }

    public Instant getEndDate() { return endDate; }
    public void setEndDate(Instant endDate) { this.endDate = endDate; }

    public Instant getSigningDate() { return signingDate; }
    public void setSigningDate(Instant signingDate) { this.signingDate = signingDate; }

    public Instant getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(Instant effectiveDate) { this.effectiveDate = effectiveDate; }

    public Instant getTerminationDate() { return terminationDate; }
    public void setTerminationDate(Instant terminationDate) { this.terminationDate = terminationDate; }

    public BigDecimal getTotalValue() { return totalValue; }
    public void setTotalValue(BigDecimal totalValue) { this.totalValue = totalValue; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public String getPaymentTerms() { return paymentTerms; }
    public void setPaymentTerms(String paymentTerms) { this.paymentTerms = paymentTerms; }

    public Boolean getIsAutoRenew() { return isAutoRenew; }
    public void setIsAutoRenew(Boolean isAutoRenew) { this.isAutoRenew = isAutoRenew; }

    public Integer getRenewalNoticeDays() { return renewalNoticeDays; }
    public void setRenewalNoticeDays(Integer renewalNoticeDays) { this.renewalNoticeDays = renewalNoticeDays; }

    public String getAttachmentPath() { return attachmentPath; }
    public void setAttachmentPath(String attachmentPath) { this.attachmentPath = attachmentPath; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (isAutoRenew == null) isAutoRenew = Boolean.FALSE;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Contract that = (Contract) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "Contract{" +
                "id=" + id +
                ", tenant=" + (tenant != null ? tenant.getId() : null) +
                ", contractNumber='" + contractNumber + '\'' +
                ", title='" + title + '\'' +
                '}';
    }
}
