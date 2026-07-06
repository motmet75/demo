package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shop_print_history", indexes = {
        @Index(name = "idx_shop_print_history_scope_time", columnList = "tenant_id,company_id,printed_at"),
        @Index(name = "idx_shop_print_history_source", columnList = "tenant_id,company_id,print_type,source_type,source_key")
})
public class ShopPrintHistory {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "slip_number", nullable = false)
    private Integer slipNumber;

    @Column(name = "copy_number", nullable = false)
    private Integer copyNumber;

    @Column(name = "print_type", nullable = false, length = 50)
    private String printType;

    @Column(name = "source_type", nullable = false, length = 50)
    private String sourceType;

    @Column(name = "source_id")
    private UUID sourceId;

    @Column(name = "source_key", nullable = false, length = 180)
    private String sourceKey;

    @Column(name = "source_code", length = 120)
    private String sourceCode;

    @Column(name = "source_number", length = 60)
    private String sourceNumber;

    @Column(name = "title", length = 180)
    private String title;

    @Column(name = "amount", columnDefinition = "numeric")
    private BigDecimal amount;

    @Column(name = "printed_by", length = 120)
    private String printedBy;

    @Column(name = "printed_at", nullable = false)
    private Instant printedAt;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (printedAt == null) printedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public Integer getSlipNumber() { return slipNumber; }
    public void setSlipNumber(Integer slipNumber) { this.slipNumber = slipNumber; }
    public Integer getCopyNumber() { return copyNumber; }
    public void setCopyNumber(Integer copyNumber) { this.copyNumber = copyNumber; }
    public String getPrintType() { return printType; }
    public void setPrintType(String printType) { this.printType = printType; }
    public String getSourceType() { return sourceType; }
    public void setSourceType(String sourceType) { this.sourceType = sourceType; }
    public UUID getSourceId() { return sourceId; }
    public void setSourceId(UUID sourceId) { this.sourceId = sourceId; }
    public String getSourceKey() { return sourceKey; }
    public void setSourceKey(String sourceKey) { this.sourceKey = sourceKey; }
    public String getSourceCode() { return sourceCode; }
    public void setSourceCode(String sourceCode) { this.sourceCode = sourceCode; }
    public String getSourceNumber() { return sourceNumber; }
    public void setSourceNumber(String sourceNumber) { this.sourceNumber = sourceNumber; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getPrintedBy() { return printedBy; }
    public void setPrintedBy(String printedBy) { this.printedBy = printedBy; }
    public Instant getPrintedAt() { return printedAt; }
    public void setPrintedAt(Instant printedAt) { this.printedAt = printedAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}