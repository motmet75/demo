package com.ams.bomcore.controller.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

/**
 * DTO for creating a new order (header + lines in one request).
 */
public class OrderCreateDto {

    @NotBlank(message = "orderNumber is required")
    private String orderNumber;

    @NotBlank(message = "orderType is required (SALES | PRODUCTION | TRANSFER | INTERNAL)")
    private String orderType;

    private UUID customerId;

    private UUID destinationWarehouseId;

    private LocalDate plannedStartDate;

    private LocalDate plannedEndDate;

    private Instant deliveryDateTime;

    private String notes;

    private String createdBy;

    @NotEmpty(message = "At least one order line is required")
    @Valid
    private List<OrderLineCreateDto> lines = new ArrayList<>();

    // ── Getters & Setters ─────────────────────────────────────────────

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getOrderType() { return orderType; }
    public void setOrderType(String orderType) { this.orderType = orderType; }

    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }

    public UUID getDestinationWarehouseId() { return destinationWarehouseId; }
    public void setDestinationWarehouseId(UUID destinationWarehouseId) { this.destinationWarehouseId = destinationWarehouseId; }

    public LocalDate getPlannedStartDate() { return plannedStartDate; }
    public void setPlannedStartDate(LocalDate plannedStartDate) { this.plannedStartDate = plannedStartDate; }

    public LocalDate getPlannedEndDate() { return plannedEndDate; }
    public void setPlannedEndDate(LocalDate plannedEndDate) { this.plannedEndDate = plannedEndDate; }

    public Instant getDeliveryDateTime() { return deliveryDateTime; }
    public void setDeliveryDateTime(Instant deliveryDateTime) { this.deliveryDateTime = deliveryDateTime; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public List<OrderLineCreateDto> getLines() { return lines; }
    public void setLines(List<OrderLineCreateDto> lines) { this.lines = lines; }

    // ── Nested DTO ────────────────────────────────────────────────────

    public static class OrderLineCreateDto {

        /** LINE_TYPE_MODEL or LINE_TYPE_MATERIAL */
        @NotBlank(message = "lineType is required (MODEL | MATERIAL)")
        private String lineType;

        /** Required when lineType = MODEL */
        private UUID modelId;

        /**
         * Optional: specific BOM id to use for this MODEL line.
         * If null, the service will use the ACTIVE BOM for the model.
         */
        private UUID bomId;

        /** Required when lineType = MATERIAL */
        private UUID materialId;

        @NotNull(message = "quantityOrdered is required")
        @Positive(message = "quantityOrdered must be positive")
        private BigDecimal quantityOrdered;

        @NotBlank(message = "unit is required")
        private String unit;

        private BigDecimal unitPrice;

        private String notes;

        public String getLineType() { return lineType; }
        public void setLineType(String lineType) { this.lineType = lineType; }

        public UUID getModelId() { return modelId; }
        public void setModelId(UUID modelId) { this.modelId = modelId; }

        public UUID getBomId() { return bomId; }
        public void setBomId(UUID bomId) { this.bomId = bomId; }

        public UUID getMaterialId() { return materialId; }
        public void setMaterialId(UUID materialId) { this.materialId = materialId; }

        public BigDecimal getQuantityOrdered() { return quantityOrdered; }
        public void setQuantityOrdered(BigDecimal quantityOrdered) { this.quantityOrdered = quantityOrdered; }

        public String getUnit() { return unit; }
        public void setUnit(String unit) { this.unit = unit; }

        public BigDecimal getUnitPrice() { return unitPrice; }
        public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

        public String getNotes() { return notes; }
        public void setNotes(String notes) { this.notes = notes; }
    }
}
