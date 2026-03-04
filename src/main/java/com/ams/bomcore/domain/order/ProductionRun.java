package com.ams.bomcore.domain.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * JPA entity for table {@code production_run}.
 * One production run corresponds to producing a batch of one model.
 * Status lifecycle: PLANNED → STARTED → IN_PROGRESS → COMPLETED → CANCELLED
 */
@Entity
@Table(name = "production_run")
public class ProductionRun {

    public static final String STATUS_PLANNED = "PLANNED";
    public static final String STATUS_STARTED = "STARTED";
    public static final String STATUS_IN_PROGRESS = "IN_PROGRESS";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_CANCELLED = "CANCELLED";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "production_batch_id", nullable = false, unique = true)
    private UUID productionBatchId;

    @Column(name = "order_id")
    private UUID orderId;

    @Column(name = "order_line_id")
    private UUID orderLineId;

    @Column(name = "model_id", nullable = false)
    private UUID modelId;

    @Column(name = "target_qty", nullable = false, precision = 14, scale = 4)
    private BigDecimal targetQty;

    @Column(name = "produced_qty", precision = 14, scale = 4)
    private BigDecimal producedQty = BigDecimal.ZERO;

    @Column(name = "scrapped_qty", precision = 14, scale = 4)
    private BigDecimal scrappedQty = BigDecimal.ZERO;

    @Column(name = "status", nullable = false, length = 20)
    private String status = STATUS_PLANNED;

    @Column(name = "start_date")
    private Instant startDate;

    @Column(name = "end_date")
    private Instant endDate;

    @Column(name = "warehouse_id")
    private UUID warehouseId;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public ProductionRun() {
    }

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (productionBatchId == null) productionBatchId = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = Instant.now();
        if (status == null) status = STATUS_PLANNED;
        if (producedQty == null) producedQty = BigDecimal.ZERO;
        if (scrappedQty == null) scrappedQty = BigDecimal.ZERO;
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    // ── Getters & Setters ─────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getProductionBatchId() { return productionBatchId; }
    public void setProductionBatchId(UUID productionBatchId) { this.productionBatchId = productionBatchId; }

    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }

    public UUID getOrderLineId() { return orderLineId; }
    public void setOrderLineId(UUID orderLineId) { this.orderLineId = orderLineId; }

    public UUID getModelId() { return modelId; }
    public void setModelId(UUID modelId) { this.modelId = modelId; }

    public BigDecimal getTargetQty() { return targetQty; }
    public void setTargetQty(BigDecimal targetQty) { this.targetQty = targetQty; }

    public BigDecimal getProducedQty() { return producedQty; }
    public void setProducedQty(BigDecimal producedQty) { this.producedQty = producedQty; }

    public BigDecimal getScrappedQty() { return scrappedQty; }
    public void setScrappedQty(BigDecimal scrappedQty) { this.scrappedQty = scrappedQty; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getStartDate() { return startDate; }
    public void setStartDate(Instant startDate) { this.startDate = startDate; }

    public Instant getEndDate() { return endDate; }
    public void setEndDate(Instant endDate) { this.endDate = endDate; }

    public UUID getWarehouseId() { return warehouseId; }
    public void setWarehouseId(UUID warehouseId) { this.warehouseId = warehouseId; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ProductionRun that = (ProductionRun) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "ProductionRun{id=" + id + ", productionBatchId=" + productionBatchId
                + ", modelId=" + modelId + ", status='" + status + "'}";
    }
}
