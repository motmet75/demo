package com.ams.bomcore.controller.orderline.dto;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;

/**
 * Request body for creating or updating an {@code OrderLine}.
 * Used by both POST /api/order-lines and PUT /api/order-lines/{id}.
 */
public class OrderLineRequestDto {

    /** Required on create; must be UUID. Ignored on update (path id is used). */
    private UUID orderId;

    @NotNull(message = "lineNumber is required")
    @Min(value = 1, message = "lineNumber must be ≥ 1")
    private Integer lineNumber;

    @NotBlank(message = "lineType is required")
    @Pattern(regexp = "MODEL|MATERIAL", message = "lineType must be MODEL or MATERIAL")
    private String lineType;

    /** Required when lineType = MODEL */
    private UUID modelId;

    /** Required when lineType = MATERIAL */
    private UUID materialId;

    @NotNull(message = "quantityOrdered is required")
    @Positive(message = "quantityOrdered must be positive")
    private BigDecimal quantityOrdered;

    private BigDecimal quantityProduced;
    private BigDecimal quantityDelivered;
    private BigDecimal quantityCancelled;

    @NotBlank(message = "unit is required")
    private String unit;

    private BigDecimal unitPrice;

    @Pattern(regexp = "PENDING|IN_PROGRESS|COMPLETED|CANCELLED",
             message = "lineStatus must be PENDING, IN_PROGRESS, COMPLETED or CANCELLED")
    private String lineStatus;

    /** UUID of the bom_calculation record (set by BOM explosion; can be supplied manually). */
    private UUID bomCalculationId;

    private String notes;

    // ── Getters & Setters ─────────────────────────────────────────────

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
}
