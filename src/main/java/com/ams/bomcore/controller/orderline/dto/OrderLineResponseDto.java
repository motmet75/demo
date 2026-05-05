package com.ams.bomcore.controller.orderline.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Response body returned for a single {@code OrderLine}.
 * All fields are read-only from the client's perspective.
 */
public class OrderLineResponseDto {

    private UUID    id;
    private UUID    orderId;
    private Integer lineNumber;
    private String  lineType;
    private UUID    modelId;
    private UUID    materialId;
    private BigDecimal quantityOrdered;
    private BigDecimal quantityProduced;
    private BigDecimal quantityDelivered;
    private BigDecimal quantityCancelled;
    private String  unit;
    private BigDecimal unitPrice;
    private String  lineStatus;
    private UUID    bomCalculationId;
    private String  notes;
    private UUID    tenantId;
    private UUID    companyId;
    private Instant createdAt;
    private Instant updatedAt;

    // ── Getters & Setters ─────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }

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
}
