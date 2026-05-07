package com.ams.bomcore.controller.contract;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

import com.ams.bomcore.domain.contract.Contract;

/**
 * Data Transfer Object for Contract with embedded company information
 * to avoid Jackson serialization issues with JPA lazy-loaded entities
 */
public class ContractDTO {
    private UUID id;
    private UUID tenantId;
    private String contractNumber;
    private String title;
    private String description;
    private String contractType;
    private String category;
    private String status;
    private Instant startDate;
    private Instant endDate;
    private Instant signingDate;
    private Instant effectiveDate;
    private Instant terminationDate;
    private BigDecimal totalValue;
    private String currency;
    private String paymentTerms;
    private Boolean isAutoRenew;
    private Integer renewalNoticeDays;
    private String attachmentPath;
    private String notes;
    private Instant createdAt;

    // Embedded company info for supplier
    private CompanyInfo supplierCompany;

    // Embedded company info for purchasing
    private CompanyInfo purchasingCompany;

    public static class CompanyInfo {
        private UUID id;
        private String companyCode;
        private String companyName;

        public CompanyInfo() {}

        public CompanyInfo(UUID id, String companyCode, String companyName) {
            this.id = id;
            this.companyCode = companyCode;
            this.companyName = companyName;
        }

        public UUID getId() { return id; }
        public void setId(UUID id) { this.id = id; }
        public String getCompanyCode() { return companyCode; }
        public void setCompanyCode(String companyCode) { this.companyCode = companyCode; }
        public String getCompanyName() { return companyName; }
        public void setCompanyName(String companyName) { this.companyName = companyName; }
    }

    public ContractDTO() {}

    /**
     * Convert JPA entity to DTO
     */
    public static ContractDTO fromEntity(Contract contract) {
        if (contract == null) {
			return null;
		}

        ContractDTO dto = new ContractDTO();
        dto.id = contract.getId();
        dto.tenantId = contract.getTenant() != null ? contract.getTenant().getId() : null;
        dto.contractNumber = contract.getContractNumber();
        dto.title = contract.getTitle();
        dto.description = contract.getDescription();
        dto.contractType = contract.getContractType();
        dto.category = contract.getCategory();
        dto.status = contract.getStatus();
        dto.startDate = contract.getStartDate();
        dto.endDate = contract.getEndDate();
        dto.signingDate = contract.getSigningDate();
        dto.effectiveDate = contract.getEffectiveDate();
        dto.terminationDate = contract.getTerminationDate();
        dto.totalValue = contract.getTotalValue();
        dto.currency = contract.getCurrency();
        dto.paymentTerms = contract.getPaymentTerms();
        dto.isAutoRenew = contract.getIsAutoRenew();
        dto.renewalNoticeDays = contract.getRenewalNoticeDays();
        dto.attachmentPath = contract.getAttachmentPath();
        dto.notes = contract.getNotes();
        dto.createdAt = contract.getCreatedAt();

        // Map supplier company
        if (contract.getSupplierCompany() != null) {
            dto.supplierCompany = new CompanyInfo(
                contract.getSupplierCompany().getId(),
                contract.getSupplierCompany().getCompanyCode(),
                contract.getSupplierCompany().getCompanyName()
            );
        }

        // Map purchasing company
        if (contract.getPurchasingCompany() != null) {
            dto.purchasingCompany = new CompanyInfo(
                contract.getPurchasingCompany().getId(),
                contract.getPurchasingCompany().getCompanyCode(),
                contract.getPurchasingCompany().getCompanyName()
            );
        }

        return dto;
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

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

    public CompanyInfo getSupplierCompany() { return supplierCompany; }
    public void setSupplierCompany(CompanyInfo supplierCompany) { this.supplierCompany = supplierCompany; }

    public CompanyInfo getPurchasingCompany() { return purchasingCompany; }
    public void setPurchasingCompany(CompanyInfo purchasingCompany) { this.purchasingCompany = purchasingCompany; }
}
