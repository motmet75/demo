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
    private String batchNo;
    private Instant expirationDateTime;
    private Instant productionDateTime;
    private Instant createdAt;

    public InventoryViewDTO(UUID inventoryId, UUID tenantId, UUID companyId, UUID materialId, String materialCode, String materialName,
                            UUID warehouseId, String warehouseCode, String warehouseName,
                            BigDecimal quantityOnHand, BigDecimal quantityReserved, String batchNo,
                            Instant expirationDateTime, Instant productionDateTime, Instant createdAt) {
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
        this.batchNo = batchNo;
        this.expirationDateTime = expirationDateTime;
        this.productionDateTime = productionDateTime;
        this.createdAt = createdAt;
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
    public String getBatchNo() { return batchNo; }
    public Instant getExpirationDateTime() { return expirationDateTime; }
    public Instant getProductionDateTime() { return productionDateTime; }
    public Instant getCreatedAt() { return createdAt; }
}