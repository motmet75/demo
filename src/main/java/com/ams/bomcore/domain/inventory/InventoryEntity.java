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

    @Column(name = "tenant_id", nullable = false, length = 100)
    private String tenantId;

    @Column(name = "company_id", length = 100)
    private String companyId;

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

    @Column(name = "batch_no", nullable = false, length = 255)
    private String batchNo;

    @Column(name = "quantity_on_hand", nullable = false, precision = 14, scale = 4)
    private BigDecimal quantityOnHand;

    @Column(name = "quantity_locked", precision = 14, scale = 4)
    private BigDecimal quantityLocked;

    @Column(name = "expiration_date")
    private Instant expirationDateTime;

    @Column(name = "production_date")
    private Instant productionDateTime;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public InventoryEntity() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getCompanyId() {
        return companyId;
    }

    public void setCompanyId(String companyId) {
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

    public BigDecimal getQuantityLocked() {
        return quantityLocked;
    }

    public void setQuantityLocked(BigDecimal quantityLocked) {
        this.quantityLocked = quantityLocked;
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
    }

    // Convenience aliases requested by UI/other code
    /**
     * Alias for quantityLocked expressed as quantityReserved per request.
     */
    public BigDecimal getQuantityReserved() {
        return this.quantityLocked;
    }

    public void setQuantityReserved(BigDecimal qty) {
        this.quantityLocked = qty;
    }

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
                ", tenantId='" + tenantId + '\'' +
                ", companyId='" + companyId + '\'' +
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