package com.ams.bomcore.controller.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO for inventory movement view, optimized for grid display.
 */
public class InventoryMovementViewDTO {

    private UUID id;
    private UUID tenantId;
    private UUID companyId;
    private UUID materialId;
    private String materialCode;
    private String materialName;
    private UUID fromWarehouseId;
    private String fromWarehouseCode;
    private String fromWarehouseName;
    private UUID toWarehouseId;
    private String toWarehouseCode;
    private String toWarehouseName;
    private BigDecimal quantity;
    private String unit;
    private String movementType;
    private String reason;
    private String referenceType;
    private UUID referenceId;
    private String batchNo;
    private String status;
    private Instant createdAt;
    private String createdBy;
    private Instant confirmedAt;
    private String confirmedBy;
    private String notes;

    public InventoryMovementViewDTO() {
    }

    public InventoryMovementViewDTO(UUID id, UUID tenantId, UUID companyId,
                                    UUID materialId, String materialCode, String materialName,
                                    UUID fromWarehouseId, String fromWarehouseCode, String fromWarehouseName,
                                    UUID toWarehouseId, String toWarehouseCode, String toWarehouseName,
                                    BigDecimal quantity, String unit, String movementType,
                                    String reason, String referenceType, UUID referenceId,
                                    String batchNo, String status, Instant createdAt, String createdBy,
                                    Instant confirmedAt, String confirmedBy, String notes) {
        this.id = id;
        this.tenantId = tenantId;
        this.companyId = companyId;
        this.materialId = materialId;
        this.materialCode = materialCode;
        this.materialName = materialName;
        this.fromWarehouseId = fromWarehouseId;
        this.fromWarehouseCode = fromWarehouseCode;
        this.fromWarehouseName = fromWarehouseName;
        this.toWarehouseId = toWarehouseId;
        this.toWarehouseCode = toWarehouseCode;
        this.toWarehouseName = toWarehouseName;
        this.quantity = quantity;
        this.unit = unit;
        this.movementType = movementType;
        this.reason = reason;
        this.referenceType = referenceType;
        this.referenceId = referenceId;
        this.batchNo = batchNo;
        this.status = status;
        this.createdAt = createdAt;
        this.createdBy = createdBy;
        this.confirmedAt = confirmedAt;
        this.confirmedBy = confirmedBy;
        this.notes = notes;
    }

    // Getters and Setters
    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }

    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }

    public String getMaterialName() { return materialName; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }

    public UUID getFromWarehouseId() { return fromWarehouseId; }
    public void setFromWarehouseId(UUID fromWarehouseId) { this.fromWarehouseId = fromWarehouseId; }

    public String getFromWarehouseCode() { return fromWarehouseCode; }
    public void setFromWarehouseCode(String fromWarehouseCode) { this.fromWarehouseCode = fromWarehouseCode; }

    public String getFromWarehouseName() { return fromWarehouseName; }
    public void setFromWarehouseName(String fromWarehouseName) { this.fromWarehouseName = fromWarehouseName; }

    public UUID getToWarehouseId() { return toWarehouseId; }
    public void setToWarehouseId(UUID toWarehouseId) { this.toWarehouseId = toWarehouseId; }

    public String getToWarehouseCode() { return toWarehouseCode; }
    public void setToWarehouseCode(String toWarehouseCode) { this.toWarehouseCode = toWarehouseCode; }

    public String getToWarehouseName() { return toWarehouseName; }
    public void setToWarehouseName(String toWarehouseName) { this.toWarehouseName = toWarehouseName; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }

    public String getMovementType() { return movementType; }
    public void setMovementType(String movementType) { this.movementType = movementType; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }

    public String getReferenceType() { return referenceType; }
    public void setReferenceType(String referenceType) { this.referenceType = referenceType; }

    public UUID getReferenceId() { return referenceId; }
    public void setReferenceId(UUID referenceId) { this.referenceId = referenceId; }

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(Instant confirmedAt) { this.confirmedAt = confirmedAt; }

    public String getConfirmedBy() { return confirmedBy; }
    public void setConfirmedBy(String confirmedBy) { this.confirmedBy = confirmedBy; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
