package com.ams.bomcore.controller.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * Projection DTO for order_consumption joined with order_header and material.
 */
public class OrderConsumptionDto {

    private UUID id;
    private UUID orderId;
    private String orderNumber;
    private String orderStatus;
    private Instant deliveryDateTime;

    private UUID materialId;
    private String materialCode;
    private String materialName;

    private BigDecimal plannedQty;
    private BigDecimal adjustedQty;
    private BigDecimal availableQty;
    private String checkResult;

    private UUID tenantId;
    private UUID companyId;
    private Instant createdAt;
    private String updatedBy;

    /** Inventory row UUID that was physically deducted (from order_consumption_log). */
    private UUID deductedInventoryId;

    public OrderConsumptionDto() {}

    public OrderConsumptionDto(
            UUID id, UUID orderId,
            String orderNumber, String orderStatus, Instant deliveryDateTime,
            UUID materialId, String materialCode, String materialName,
            BigDecimal plannedQty, BigDecimal adjustedQty, BigDecimal availableQty,
            String checkResult, UUID tenantId, UUID companyId, Instant createdAt,
            String updatedBy,
            UUID deductedInventoryId) {
        this.id = id;
        this.orderId = orderId;
        this.orderNumber = orderNumber;
        this.orderStatus = orderStatus;
        this.deliveryDateTime = deliveryDateTime;
        this.materialId = materialId;
        this.materialCode = materialCode;
        this.materialName = materialName;
        this.plannedQty = plannedQty;
        this.adjustedQty = adjustedQty;
        this.availableQty = availableQty;
        this.checkResult = checkResult;
        this.tenantId = tenantId;
        this.companyId = companyId;
        this.createdAt = createdAt;
        this.updatedBy = updatedBy;
        this.deductedInventoryId = deductedInventoryId;
    }

    // ── Getters ────────────────────────────────────────────────────────

    public UUID getId() { return id; }
    public UUID getOrderId() { return orderId; }
    public String getOrderNumber() { return orderNumber; }
    public String getOrderStatus() { return orderStatus; }
    public Instant getDeliveryDateTime() { return deliveryDateTime; }
    public UUID getMaterialId() { return materialId; }
    public String getMaterialCode() { return materialCode; }
    public String getMaterialName() { return materialName; }
    public BigDecimal getPlannedQty() { return plannedQty; }
    public BigDecimal getAdjustedQty() { return adjustedQty; }
    public BigDecimal getAvailableQty() { return availableQty; }
    public String getCheckResult() { return checkResult; }
    public UUID getTenantId() { return tenantId; }
    public UUID getCompanyId() { return companyId; }
    public Instant getCreatedAt() { return createdAt; }
    public String getUpdatedBy() { return updatedBy; }
    public UUID getDeductedInventoryId() { return deductedInventoryId; }
}