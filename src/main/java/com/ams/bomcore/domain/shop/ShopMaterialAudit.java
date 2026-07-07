package com.ams.bomcore.domain.shop;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shop_material_audit")
public class ShopMaterialAudit {

    public static final String STATUS_RESERVED = "RESERVED";
    public static final String STATUS_WAITING_STOCK = "WAITING_STOCK";
    public static final String STATUS_PARTIAL = "PARTIAL";
    public static final String STATUS_DEDUCTED = "DEDUCTED";
    public static final String STATUS_NO_BOM = "NO_BOM";

    public static final String SOURCE_CONFIRM = "CONFIRM";
    public static final String SOURCE_FORCE_CONFIRM = "FORCE_CONFIRM";
    public static final String SOURCE_PREPARE = "PREPARE";
    public static final String SOURCE_RECHECK = "RECHECK";
    public static final String SOURCE_DEDUCT_LATER = "DEDUCT_LATER";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "order_item_id")
    private UUID orderItemId;

    @Column(name = "model_id")
    private UUID modelId;

    @Column(name = "model_name", columnDefinition = "TEXT")
    private String modelName;

    @Column(name = "order_code", length = 50)
    private String orderCode;

    @Column(name = "order_number")
    private Integer orderNumber;

    @Column(name = "material_id", nullable = false)
    private UUID materialId;

    @Column(name = "material_code", length = 50)
    private String materialCode;

    @Column(name = "material_name", columnDefinition = "TEXT")
    private String materialName;

    @Column(name = "required_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal requiredQty = BigDecimal.ZERO;

    @Column(name = "available_before_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal availableBeforeQty = BigDecimal.ZERO;

    @Column(name = "deducted_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal deductedQty = BigDecimal.ZERO;

    @Column(name = "waiting_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal waitingQty = BigDecimal.ZERO;

    @Column(name = "status", nullable = false, length = 30)
    private String status = STATUS_RESERVED;

    @Column(name = "source", length = 30)
    private String source;

    @Column(name = "remark", columnDefinition = "TEXT")
    private String remark;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "resolved_at")
    private Instant resolvedAt;

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = Instant.now();
        if (requiredQty == null) requiredQty = BigDecimal.ZERO;
        if (availableBeforeQty == null) availableBeforeQty = BigDecimal.ZERO;
        if (deductedQty == null) deductedQty = BigDecimal.ZERO;
        if (waitingQty == null) waitingQty = BigDecimal.ZERO;
        if (status == null) status = STATUS_RESERVED;
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
    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }
    public UUID getOrderItemId() { return orderItemId; }
    public void setOrderItemId(UUID orderItemId) { this.orderItemId = orderItemId; }
    public UUID getModelId() { return modelId; }
    public void setModelId(UUID modelId) { this.modelId = modelId; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public String getOrderCode() { return orderCode; }
    public void setOrderCode(String orderCode) { this.orderCode = orderCode; }
    public Integer getOrderNumber() { return orderNumber; }
    public void setOrderNumber(Integer orderNumber) { this.orderNumber = orderNumber; }
    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }
    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }
    public String getMaterialName() { return materialName; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }
    public BigDecimal getRequiredQty() { return requiredQty; }
    public void setRequiredQty(BigDecimal requiredQty) { this.requiredQty = requiredQty; }
    public BigDecimal getAvailableBeforeQty() { return availableBeforeQty; }
    public void setAvailableBeforeQty(BigDecimal availableBeforeQty) { this.availableBeforeQty = availableBeforeQty; }
    public BigDecimal getDeductedQty() { return deductedQty; }
    public void setDeductedQty(BigDecimal deductedQty) { this.deductedQty = deductedQty; }
    public BigDecimal getWaitingQty() { return waitingQty; }
    public void setWaitingQty(BigDecimal waitingQty) { this.waitingQty = waitingQty; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
    public Instant getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(Instant resolvedAt) { this.resolvedAt = resolvedAt; }
}
