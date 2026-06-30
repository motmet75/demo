package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shop_bill")
public class ShopBill {

    public static final String STATUS_ACTIVE = "ACTIVE";
    public static final String STATUS_MERGED = "MERGED";
    public static final String STATUS_CANCELLED = "CANCELLED";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private ShopOrder order;

    @Column(name = "bill_number")
    private Integer billNumber;

    @Column(name = "status", nullable = false, length = 20)
    private String status = STATUS_ACTIVE;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "split_from_bill_id")
    private ShopBill splitFromBill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "merged_into_bill_id")
    private ShopBill mergedIntoBill;

    @Column(name = "merge_batch_id")
    private UUID mergeBatchId;

    @Column(name = "pre_merge_order_status", length = 20)
    private String preMergeOrderStatus;

    @Column(name = "pre_merge_cancel_reason", columnDefinition = "TEXT")
    private String preMergeCancelReason;

    @Column(name = "total_amount", columnDefinition = "numeric")
    private BigDecimal totalAmount = BigDecimal.ZERO;

    @Column(name = "total_raw_cost", columnDefinition = "numeric")
    private BigDecimal totalRawCost = BigDecimal.ZERO;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "merged_at")
    private Instant mergedAt;

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = createdAt;
        if (status == null) status = STATUS_ACTIVE;
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public ShopOrder getOrder() { return order; }
    public void setOrder(ShopOrder order) { this.order = order; }
    public Integer getBillNumber() { return billNumber; }
    public void setBillNumber(Integer billNumber) { this.billNumber = billNumber; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public ShopBill getSplitFromBill() { return splitFromBill; }
    public void setSplitFromBill(ShopBill splitFromBill) { this.splitFromBill = splitFromBill; }
    public ShopBill getMergedIntoBill() { return mergedIntoBill; }
    public void setMergedIntoBill(ShopBill mergedIntoBill) { this.mergedIntoBill = mergedIntoBill; }
    public UUID getMergeBatchId() { return mergeBatchId; }
    public void setMergeBatchId(UUID mergeBatchId) { this.mergeBatchId = mergeBatchId; }
    public String getPreMergeOrderStatus() { return preMergeOrderStatus; }
    public void setPreMergeOrderStatus(String preMergeOrderStatus) { this.preMergeOrderStatus = preMergeOrderStatus; }
    public String getPreMergeCancelReason() { return preMergeCancelReason; }
    public void setPreMergeCancelReason(String preMergeCancelReason) { this.preMergeCancelReason = preMergeCancelReason; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public BigDecimal getTotalRawCost() { return totalRawCost; }
    public void setTotalRawCost(BigDecimal totalRawCost) { this.totalRawCost = totalRawCost; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getMergedAt() { return mergedAt; }
    public void setMergedAt(Instant mergedAt) { this.mergedAt = mergedAt; }
}