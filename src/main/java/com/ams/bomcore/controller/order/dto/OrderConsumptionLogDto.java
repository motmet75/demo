package com.ams.bomcore.controller.order.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO for order_consumption_log entries, joined with order_header and material.
 * Includes deducted_inventory_id for traceability.
 */
public class OrderConsumptionLogDto {

    private UUID id;
    private UUID orderId;
    private String orderNumber;
    private String orderStatus;
    private UUID bomCalculationId;

    private UUID materialId;
    private String materialCode;
    private String materialName;

    private BigDecimal plannedQty;
    private BigDecimal effectivePlannedQty;
    private BigDecimal realConsumptionQty;
    private BigDecimal varianceQty;

    /** The inventory row UUID that was deducted when this material was issued to production. */
    private UUID deductedInventoryId;

    private String status;

    private UUID tenantId;
    private UUID companyId;
    private Instant createdAt;
    private Instant updatedAt;

    public OrderConsumptionLogDto() {}

    public OrderConsumptionLogDto(
            UUID id, UUID orderId,
            String orderNumber, String orderStatus,
            UUID bomCalculationId,
            UUID materialId, String materialCode, String materialName,
            BigDecimal plannedQty, BigDecimal effectivePlannedQty,
            BigDecimal realConsumptionQty, BigDecimal varianceQty,
            UUID deductedInventoryId,
            String status,
            UUID tenantId, UUID companyId,
            Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.orderId = orderId;
        this.orderNumber = orderNumber;
        this.orderStatus = orderStatus;
        this.bomCalculationId = bomCalculationId;
        this.materialId = materialId;
        this.materialCode = materialCode;
        this.materialName = materialName;
        this.plannedQty = plannedQty;
        this.effectivePlannedQty = effectivePlannedQty;
        this.realConsumptionQty = realConsumptionQty;
        this.varianceQty = varianceQty;
        this.deductedInventoryId = deductedInventoryId;
        this.status = status;
        this.tenantId = tenantId;
        this.companyId = companyId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getOrderStatus() { return orderStatus; }
    public void setOrderStatus(String orderStatus) { this.orderStatus = orderStatus; }

    public UUID getBomCalculationId() { return bomCalculationId; }
    public void setBomCalculationId(UUID bomCalculationId) { this.bomCalculationId = bomCalculationId; }

    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }

    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }

    public String getMaterialName() { return materialName; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }

    public BigDecimal getPlannedQty() { return plannedQty; }
    public void setPlannedQty(BigDecimal plannedQty) { this.plannedQty = plannedQty; }

    public BigDecimal getEffectivePlannedQty() { return effectivePlannedQty; }
    public void setEffectivePlannedQty(BigDecimal effectivePlannedQty) { this.effectivePlannedQty = effectivePlannedQty; }

    public BigDecimal getRealConsumptionQty() { return realConsumptionQty; }
    public void setRealConsumptionQty(BigDecimal realConsumptionQty) { this.realConsumptionQty = realConsumptionQty; }

    public BigDecimal getVarianceQty() { return varianceQty; }
    public void setVarianceQty(BigDecimal varianceQty) { this.varianceQty = varianceQty; }

    public UUID getDeductedInventoryId() { return deductedInventoryId; }
    public void setDeductedInventoryId(UUID deductedInventoryId) { this.deductedInventoryId = deductedInventoryId; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
