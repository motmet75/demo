package com.ams.bomcore.domain.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * JPA entity for table {@code order_line}.
 * One order line represents either a MODEL (finished product, triggers BOM explosion)
 * or a MATERIAL (direct raw/trading item consumed from inventory).
 */
@Entity
@Table(name = "order_line")
public class OrderLine {

    public static final String LINE_TYPE_MODEL = "MODEL";
    public static final String LINE_TYPE_MATERIAL = "MATERIAL";

    public static final String LINE_STATUS_PENDING = "PENDING";
    public static final String LINE_STATUS_IN_PROGRESS = "IN_PROGRESS";
    public static final String LINE_STATUS_COMPLETED = "COMPLETED";
    public static final String LINE_STATUS_CANCELLED = "CANCELLED";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private OrderHeader order;

    @Column(name = "line_number", nullable = false)
    private Integer lineNumber;

    @Column(name = "line_type", nullable = false, length = 20)
    private String lineType;

    /** Populated when lineType = 'MODEL' */
    @Column(name = "model_id")
    private UUID modelId;

    /** Populated when lineType = 'MATERIAL' */
    @Column(name = "material_id")
    private UUID materialId;

    @Column(name = "quantity_ordered", nullable = false, columnDefinition = "numeric")
    private BigDecimal quantityOrdered;

    @Column(name = "quantity_produced", columnDefinition = "numeric")
    private BigDecimal quantityProduced = BigDecimal.ZERO;

    @Column(name = "quantity_delivered", columnDefinition = "numeric")
    private BigDecimal quantityDelivered = BigDecimal.ZERO;

    @Column(name = "quantity_cancelled", columnDefinition = "numeric")
    private BigDecimal quantityCancelled = BigDecimal.ZERO;

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    @Column(name = "unit_price", columnDefinition = "numeric")
    private BigDecimal unitPrice;

    @Column(name = "line_status", length = 20)
    private String lineStatus = LINE_STATUS_PENDING;

    /** Link to the bom_calculation record created during BOM explosion for this line */
    @Column(name = "bom_calculation_id")
    private UUID bomCalculationId;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public OrderLine() {
    }

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = Instant.now();
        if (lineStatus == null) lineStatus = LINE_STATUS_PENDING;
        if (quantityProduced == null) quantityProduced = BigDecimal.ZERO;
        if (quantityDelivered == null) quantityDelivered = BigDecimal.ZERO;
        if (quantityCancelled == null) quantityCancelled = BigDecimal.ZERO;
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    // ── Getters & Setters ─────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public OrderHeader getOrder() { return order; }
    public void setOrder(OrderHeader order) { this.order = order; }

    public Integer getLineNumber() { return lineNumber; }
    public void setLineNumber(Integer lineNumber) { this.lineNumber = lineNumber; }

    public String getLineType() { return lineType; }
    public void setLineType(String lineType) { this.lineType = lineType; }

    public UUID getModelId() { return modelId; }
    public void setModelId(UUID modelId) { this.modelId = modelId; }

    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }

    public BigDecimal getQuantityOrdered() { return quantityOrdered; }
    public void setQuantityOrdered(BigDecimal quantityOrdered) { this.quantityOrdered = quantityOrdered; }

    public BigDecimal getQuantityProduced() { return quantityProduced; }
    public void setQuantityProduced(BigDecimal quantityProduced) { this.quantityProduced = quantityProduced; }

    public BigDecimal getQuantityDelivered() { return quantityDelivered; }
    public void setQuantityDelivered(BigDecimal quantityDelivered) { this.quantityDelivered = quantityDelivered; }

    public BigDecimal getQuantityCancelled() { return quantityCancelled; }
    public void setQuantityCancelled(BigDecimal quantityCancelled) { this.quantityCancelled = quantityCancelled; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    public String getLineStatus() { return lineStatus; }
    public void setLineStatus(String lineStatus) { this.lineStatus = lineStatus; }

    public UUID getBomCalculationId() { return bomCalculationId; }
    public void setBomCalculationId(UUID bomCalculationId) { this.bomCalculationId = bomCalculationId; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

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
        OrderLine that = (OrderLine) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }
}
