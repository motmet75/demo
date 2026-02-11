package com.ams.bomcore.controller.inventory.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * DTO optimized for grid display of Inventory rows. Populated by a repository query
 * that joins Inventory, Material and Warehouse in one query to avoid N+1.
 */
public class InventoryViewDTO {

    private UUID inventoryId;
    private UUID tenantId;
    private UUID companyId;
    private UUID materialId;
    private String materialCode;
    private String materialName;
    private UUID warehouseId;
    private String warehouseCode;
    private String warehouseName;
    private BigDecimal quantityOnHand;
    private BigDecimal quantityReserved;
    private BigDecimal quantityLocked;
    private String batchNo;
    private String contractCode;
    private String unit;
    private BigDecimal unitPrice;
    private String currency;
    private Instant expirationDateTime;
    private Instant productionDateTime;
    private Instant createdAt;
    private Boolean visible;
    private Boolean approved;
    private Boolean locked;

    public InventoryViewDTO(UUID inventoryId, UUID tenantId, UUID companyId, UUID materialId, String materialCode, String materialName,
                            UUID warehouseId, String warehouseCode, String warehouseName,
                            BigDecimal quantityOnHand, BigDecimal quantityReserved, BigDecimal quantityLocked, String batchNo,
                            String contractCode, String unit, BigDecimal unitPrice, String currency,
                            Instant expirationDateTime, Instant productionDateTime, Instant createdAt,
                            Boolean visible, Boolean approved, Boolean locked) {
        this.inventoryId = inventoryId;
        this.tenantId = tenantId;
        this.companyId = companyId;
        this.materialId = materialId;
        this.materialCode = materialCode;
        this.materialName = materialName;
        this.warehouseId = warehouseId;
        this.warehouseCode = warehouseCode;
        this.warehouseName = warehouseName;
        this.quantityOnHand = quantityOnHand;
        this.quantityReserved = quantityReserved;
        this.quantityLocked = quantityLocked;
        this.batchNo = batchNo;
        this.contractCode = contractCode;
        this.unit = unit;
        this.unitPrice = unitPrice;
        this.currency = currency;
        this.expirationDateTime = expirationDateTime;
        this.productionDateTime = productionDateTime;
        this.createdAt = createdAt;
        this.visible = visible;
        this.approved = approved;
        this.locked = locked;
    }

    // Getters
    public UUID getInventoryId() { return inventoryId; }
    public UUID getTenantId() { return tenantId; }
    public UUID getCompanyId() { return companyId; }
    public UUID getMaterialId() { return materialId; }
    public String getMaterialCode() { return materialCode; }
    public String getMaterialName() { return materialName; }
    public UUID getWarehouseId() { return warehouseId; }
    public String getWarehouseCode() { return warehouseCode; }
    public String getWarehouseName() { return warehouseName; }
    public BigDecimal getQuantityOnHand() { return quantityOnHand; }
    public BigDecimal getQuantityReserved() { return quantityReserved; }
    public BigDecimal getQuantityLocked() { return quantityLocked; }
    public String getBatchNo() { return batchNo; }
    public String getContractCode() { return contractCode; }
    public String getUnit() { return unit; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public String getCurrency() { return currency; }
    public Instant getExpirationDateTime() { return expirationDateTime; }
    public Instant getProductionDateTime() { return productionDateTime; }
    public Instant getCreatedAt() { return createdAt; }
    public Boolean getVisible() { return visible; }
    public Boolean getApproved() { return approved; }
    public Boolean getLocked() { return locked; }
}
