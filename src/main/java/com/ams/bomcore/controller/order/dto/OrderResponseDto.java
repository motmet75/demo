package com.ams.bomcore.controller.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Response DTO for an order (header + lines + consumption summary).
 */
public class OrderResponseDto {

    private UUID id;
    private String orderNumber;
    private String orderType;
    private String status;
    private UUID customerId;
    private UUID destinationWarehouseId;
    private UUID productionBatchId;
    private LocalDate plannedStartDate;
    private LocalDate plannedEndDate;
    private Instant actualStartDate;
    private Instant actualEndDate;
    private Instant deliveryDateTime;
    private BigDecimal totalPlannedQty;
    private BigDecimal totalActualQty;
    private String notes;
    private UUID tenantId;
    private UUID companyId;
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    private List<OrderLineResponseDto> lines;

    // ── Getters & Setters ─────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getOrderType() { return orderType; }
    public void setOrderType(String orderType) { this.orderType = orderType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }

    public UUID getDestinationWarehouseId() { return destinationWarehouseId; }
    public void setDestinationWarehouseId(UUID destinationWarehouseId) { this.destinationWarehouseId = destinationWarehouseId; }

    public UUID getProductionBatchId() { return productionBatchId; }
    public void setProductionBatchId(UUID productionBatchId) { this.productionBatchId = productionBatchId; }

    public LocalDate getPlannedStartDate() { return plannedStartDate; }
    public void setPlannedStartDate(LocalDate plannedStartDate) { this.plannedStartDate = plannedStartDate; }

    public LocalDate getPlannedEndDate() { return plannedEndDate; }
    public void setPlannedEndDate(LocalDate plannedEndDate) { this.plannedEndDate = plannedEndDate; }

    public Instant getActualStartDate() { return actualStartDate; }
    public void setActualStartDate(Instant actualStartDate) { this.actualStartDate = actualStartDate; }

    public Instant getActualEndDate() { return actualEndDate; }
    public void setActualEndDate(Instant actualEndDate) { this.actualEndDate = actualEndDate; }

    public Instant getDeliveryDateTime() { return deliveryDateTime; }
    public void setDeliveryDateTime(Instant deliveryDateTime) { this.deliveryDateTime = deliveryDateTime; }

    public BigDecimal getTotalPlannedQty() { return totalPlannedQty; }
    public void setTotalPlannedQty(BigDecimal totalPlannedQty) { this.totalPlannedQty = totalPlannedQty; }

    public BigDecimal getTotalActualQty() { return totalActualQty; }
    public void setTotalActualQty(BigDecimal totalActualQty) { this.totalActualQty = totalActualQty; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public List<OrderLineResponseDto> getLines() { return lines; }
    public void setLines(List<OrderLineResponseDto> lines) { this.lines = lines; }

    // ── Nested Line DTO ───────────────────────────────────────────────

    public static class OrderLineResponseDto {
        private UUID id;
        private Integer lineNumber;
        private String lineType;
        private UUID modelId;
        private UUID materialId;
        private BigDecimal quantityOrdered;
        private BigDecimal quantityProduced;
        private BigDecimal quantityDelivered;
        private BigDecimal quantityCancelled;
        private String unit;
        private BigDecimal unitPrice;
        private String lineStatus;
        private UUID bomCalculationId;
        private String notes;

        public UUID getId() { return id; }
        public void setId(UUID id) { this.id = id; }

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
}
