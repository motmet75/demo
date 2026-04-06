package com.ams.bomcore.domain.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.ams.bomcore.domain.material.Material;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.ForeignKey;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Transient;

/**
 * Entity mapping for table `inventory`.
 */
@Entity
@Table(name = "inventory", uniqueConstraints = @UniqueConstraint(columnNames = {"material_id", "warehouse_id", "batch_no"}))
public class InventoryEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id")
    private UUID companyId;

    // Use relationship to Material (no duplicated material code/name stored here)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "material_id", referencedColumnName = "id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_inventory_material"))
    private Material material;

    // Use relationship to WarehouseEntity (no duplicated warehouse code/name stored here)
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "warehouse_id", referencedColumnName = "id", nullable = false,
            foreignKey = @ForeignKey(name = "fk_inventory_warehouse"))
    private WarehouseEntity warehouse;

    // No FK - store contract_id as UUID only (lookup by code during import)
    @Column(name = "contract_id")
    private UUID contractId;

    // Denormalized codes for quick reference/display
    @Column(name = "material_code", length = 50)
    private String materialCodeDenorm;

    @Column(name = "warehouse_code", length = 50)
    private String warehouseCodeDenorm;

    @Column(name = "contract_code", length = 50)
    private String contractCode;

    @Column(name = "batch_no", nullable = false, length = 255)
    private String batchNo;

    @Column(name = "order_to_deduction", length = 100)
    private String orderToDeduction;

    @Column(name = "user_name", nullable = false, length = 100)
    private String userName = "system";

    @Column(name = "unit", nullable = false, length = 20)
    private String unit = "pcs";

    @Column(name = "unit_price", columnDefinition = "numeric")
    private BigDecimal unitPrice = BigDecimal.ZERO;

    @Column(name = "currency", length = 3)
    private String currency = "USD";

    @Column(name = "hs_code", length = 20)
    private String hsCode;

    @Column(name = "origin_type", length = 50)
    private String originType;

    @Column(name = "origin_country", length = 2)
    private String originCountry;

    @Column(name = "xform_no", length = 50)
    private String xformNo;

    @Column(name = "cds_no", length = 50)
    private String cdsNo;

    @Column(name = "purchase_no", length = 50)
    private String purchaseNo;

    @Column(name = "quantity_on_hand", nullable = false, columnDefinition = "numeric")
    private BigDecimal quantityOnHand;

    @Column(name = "quantity_total", columnDefinition = "numeric")
    private BigDecimal quantityTotal;

    @Column(name = "quantity_reserved", columnDefinition = "numeric")
    private BigDecimal quantityReserved;

    @Column(name = "quantity_locked", columnDefinition = "numeric")
    private BigDecimal quantityLocked;

    @Column(name = "material_quota", columnDefinition = "numeric")
    private BigDecimal materialQuota;

    @Column(name = "material_quota_percentage", columnDefinition = "numeric")
    private BigDecimal materialQuotaPercentage;

    // Dates & timestamps
    @Column(name = "xform_date")
    private java.time.LocalDate xformDate;

    @Column(name = "purchase_date_time")
    private Instant purchaseDateTime;

    @Column(name = "cds_date_time")
    private Instant cdsDateTime;

    @Column(name = "production_date_time")
    private Instant productionDateTime;

    @Column(name = "expiration_date_time")
    private Instant expirationDateTime;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "modified_time")
    private Instant modifiedTime;

    @Column(name = "updated_at")
    private Instant updatedAt;

    // Status flags
    @Column(name = "visible", nullable = false)
    private Boolean visible = true;

    @Column(name = "approved", nullable = false)
    private Boolean approved = false;

    @Column(name = "locked", nullable = false)
    private Boolean locked = false;

    public InventoryEntity() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getTenantId() {
        return tenantId;
    }

    public void setTenantId(UUID tenantId) {
        this.tenantId = tenantId;
    }

    public UUID getCompanyId() {
        return companyId;
    }

    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public Material getMaterial() {
        return material;
    }

    public void setMaterial(Material material) {
        this.material = material;
    }

    public WarehouseEntity getWarehouse() {
        return warehouse;
    }

    public void setWarehouse(WarehouseEntity warehouse) {
        this.warehouse = warehouse;
    }

    public String getBatchNo() {
        return batchNo;
    }

    public void setBatchNo(String batchNo) {
        this.batchNo = batchNo;
    }

    public BigDecimal getQuantityOnHand() {
        return quantityOnHand;
    }

    public void setQuantityOnHand(BigDecimal quantityOnHand) {
        this.quantityOnHand = quantityOnHand;
    }

    public BigDecimal getQuantityTotal() {
        return quantityTotal;
    }

    public void setQuantityTotal(BigDecimal quantityTotal) {
        this.quantityTotal = quantityTotal;
    }

    public BigDecimal getQuantityLocked() {
        return quantityLocked;
    }

    public void setQuantityLocked(BigDecimal quantityLocked) {
        this.quantityLocked = quantityLocked;
    }

    public UUID getContractId() {
        return contractId;
    }

    public void setContractId(UUID contractId) {
        this.contractId = contractId;
    }

    public String getMaterialCodeDenorm() {
        return materialCodeDenorm;
    }

    public void setMaterialCodeDenorm(String materialCodeDenorm) {
        this.materialCodeDenorm = materialCodeDenorm;
    }

    public String getWarehouseCodeDenorm() {
        return warehouseCodeDenorm;
    }

    public void setWarehouseCodeDenorm(String warehouseCodeDenorm) {
        this.warehouseCodeDenorm = warehouseCodeDenorm;
    }

    public String getContractCode() {
        return contractCode;
    }

    public void setContractCode(String contractCode) {
        this.contractCode = contractCode;
    }

    public String getOrderToDeduction() {
        return orderToDeduction;
    }

    public void setOrderToDeduction(String orderToDeduction) {
        this.orderToDeduction = orderToDeduction;
    }

    public String getUserName() {
        return userName;
    }

    public void setUserName(String userName) {
        this.userName = userName;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public BigDecimal getUnitPrice() {
        return unitPrice;
    }

    public void setUnitPrice(BigDecimal unitPrice) {
        this.unitPrice = unitPrice;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public String getHsCode() {
        return hsCode;
    }

    public void setHsCode(String hsCode) {
        this.hsCode = hsCode;
    }

    public String getOriginType() {
        return originType;
    }

    public void setOriginType(String originType) {
        this.originType = originType;
    }

    public String getOriginCountry() {
        return originCountry;
    }

    public void setOriginCountry(String originCountry) {
        this.originCountry = originCountry;
    }

    public String getXformNo() {
        return xformNo;
    }

    public void setXformNo(String xformNo) {
        this.xformNo = xformNo;
    }

    public String getCdsNo() {
        return cdsNo;
    }

    public void setCdsNo(String cdsNo) {
        this.cdsNo = cdsNo;
    }

    public String getPurchaseNo() {
        return purchaseNo;
    }

    public void setPurchaseNo(String purchaseNo) {
        this.purchaseNo = purchaseNo;
    }

    public BigDecimal getQuantityReserved() {
        return quantityReserved;
    }

    public void setQuantityReserved(BigDecimal quantityReserved) {
        this.quantityReserved = quantityReserved;
    }

    public BigDecimal getMaterialQuota() {
        return materialQuota;
    }

    public void setMaterialQuota(BigDecimal materialQuota) {
        this.materialQuota = materialQuota;
    }

    public BigDecimal getMaterialQuotaPercentage() {
        return materialQuotaPercentage;
    }

    public void setMaterialQuotaPercentage(BigDecimal materialQuotaPercentage) {
        this.materialQuotaPercentage = materialQuotaPercentage;
    }

    public java.time.LocalDate getXformDate() {
        return xformDate;
    }

    public void setXformDate(java.time.LocalDate xformDate) {
        this.xformDate = xformDate;
    }

    public Instant getPurchaseDateTime() {
        return purchaseDateTime;
    }

    public void setPurchaseDateTime(Instant purchaseDateTime) {
        this.purchaseDateTime = purchaseDateTime;
    }

    public Instant getCdsDateTime() {
        return cdsDateTime;
    }

    public void setCdsDateTime(Instant cdsDateTime) {
        this.cdsDateTime = cdsDateTime;
    }

    public Instant getModifiedTime() {
        return modifiedTime;
    }

    public void setModifiedTime(Instant modifiedTime) {
        this.modifiedTime = modifiedTime;
    }

    public Boolean getVisible() {
        return visible;
    }

    public void setVisible(Boolean visible) {
        this.visible = visible;
    }

    public Boolean getApproved() {
        return approved;
    }

    public void setApproved(Boolean approved) {
        this.approved = approved;
    }

    public Boolean getLocked() {
        return locked;
    }

    public void setLocked(Boolean locked) {
        this.locked = locked;
    }

    public Instant getExpirationDateTime() {
        return expirationDateTime;
    }

    public void setExpirationDateTime(Instant expirationDateTime) {
        this.expirationDateTime = expirationDateTime;
    }

    public Instant getProductionDateTime() {
        return productionDateTime;
    }

    public void setProductionDateTime(Instant productionDateTime) {
        this.productionDateTime = productionDateTime;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }

    @PrePersist
    private void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
        if (updatedAt == null) {
            updatedAt = Instant.now();
        }
        if (quantityLocked == null) {
            quantityLocked = BigDecimal.ZERO;
        }
        if (quantityReserved == null) {
            quantityReserved = BigDecimal.ZERO;
        }
        if (quantityOnHand == null) {
            quantityOnHand = BigDecimal.ZERO;
        }
        if (quantityTotal == null) {
            quantityTotal = quantityOnHand != null ? quantityOnHand : BigDecimal.ZERO;
        }
        if (unitPrice == null) {
            unitPrice = BigDecimal.ZERO;
        }
        if (visible == null) {
            visible = true;
        }
        if (approved == null) {
            approved = false;
        }
        if (locked == null) {
            locked = false;
        }
        if (userName == null || userName.trim().isEmpty()) {
            userName = "system";
        }
        if (unit == null || unit.trim().isEmpty()) {
            unit = "pcs";
        }
        if (currency == null || currency.trim().isEmpty()) {
            currency = "USD";
        }
        // Sync denormalized codes
        if (material != null && materialCodeDenorm == null) {
            materialCodeDenorm = material.getMaterialCode();
        }
        if (warehouse != null && warehouseCodeDenorm == null) {
            warehouseCodeDenorm = warehouse.getCode();
        }
    }

    // Convenience aliases requested by UI/other code
    /**
     * Derived warehouse code from the related WarehouseEntity (may be null).
     */
    @Transient
    public String getWarehouseCode() {
        return warehouse == null ? null : warehouse.getCode();
    }

    /**
     * Derived material code from the related Material (may be null).
     */
    @Transient
    public String getMaterialCode() {
        return material == null ? null : material.getMaterialCode();
    }

    /**
     * Alias for updatedAt as lastUpdated
     */
    public Instant getLastUpdated() {
        return this.updatedAt;
    }

    public void setLastUpdated(Instant ts) {
        this.updatedAt = ts;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        InventoryEntity that = (InventoryEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "InventoryEntity{" +
                "id=" + id +
                ", tenantId=" + tenantId +
                ", companyId=" + companyId +
                ", material=" + (material != null ? material.getId() : null) +
                ", warehouse=" + (warehouse != null ? warehouse.getId() : null) +
                ", batchNo=" + batchNo +
                ", quantityOnHand=" + quantityOnHand +
                ", quantityLocked=" + quantityLocked +
                ", expirationDateTime=" + expirationDateTime +
                ", productionDateTime=" + productionDateTime +
                ", createdAt=" + createdAt +
                ", updatedAt=" + updatedAt +
                '}';
    }
}