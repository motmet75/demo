package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shop_staff_call")
public class ShopStaffCall {

    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_DISMISSED = "DISMISSED";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "table_id")
    private UUID tableId;

    @Column(name = "table_name", length = 100)
    private String tableName;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "order_number")
    private Integer orderNumber;

    @Column(name = "daily_seq")
    private Integer dailySeq;

    @Column(name = "order_code", length = 50)
    private String orderCode;

    @Column(name = "reason", nullable = false, length = 40)
    private String reason;

    @Column(name = "note", columnDefinition = "TEXT")
    private String note;

    @Column(name = "token", length = 100)
    private String token;

    @Column(name = "status", nullable = false, length = 20)
    private String status = STATUS_OPEN;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "dismissed_at")
    private Instant dismissedAt;

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = STATUS_OPEN;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public UUID getTableId() { return tableId; }
    public void setTableId(UUID tableId) { this.tableId = tableId; }
    public String getTableName() { return tableName; }
    public void setTableName(String tableName) { this.tableName = tableName; }
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public Integer getOrderNumber() { return orderNumber; }
    public void setOrderNumber(Integer orderNumber) { this.orderNumber = orderNumber; }
    public Integer getDailySeq() { return dailySeq; }
    public void setDailySeq(Integer dailySeq) { this.dailySeq = dailySeq; }
    public String getOrderCode() { return orderCode; }
    public void setOrderCode(String orderCode) { this.orderCode = orderCode; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getDismissedAt() { return dismissedAt; }
    public void setDismissedAt(Instant dismissedAt) { this.dismissedAt = dismissedAt; }
}