package com.ams.bomcore.domain.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.ams.bomcore.domain.material.Material;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * Entity mapping for table `order_consumption_log`.
 * Tracks planned vs real material consumption per order.
 * Order creation is skipped but this entity is needed for BOM calculation reference.
 */
@Entity
@Table(name = "order_consumption_log")
public class OrderConsumptionLogEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "order_id", nullable = false)
    private UUID orderId;

    @Column(name = "bom_calculation_id")
    private UUID bomCalculationId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(name = "planned_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal plannedQty;

    @Column(name = "effective_planned_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal effectivePlannedQty;

    @Column(name = "real_consumption_qty", columnDefinition = "numeric")
    private BigDecimal realConsumptionQty;

    // variance_qty is a generated column in DB; mark as insertable=false updatable=false
    @Column(name = "variance_qty", insertable = false, updatable = false, columnDefinition = "numeric")
    private BigDecimal varianceQty;

    /**
     * UUID of the inventory row that was deducted when this material was issued
     * to production (set during moveToProduction / ISSUE_TO_PRODUCTION).
     * Null until the order reaches MATERIAL_READY status.
     */
    @Column(name = "deducted_inventory_id")
    private UUID deductedInventoryId;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "PROVISIONAL";

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public OrderConsumptionLogEntity() {
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getOrderId() { return orderId; }
    public void setOrderId(UUID orderId) { this.orderId = orderId; }

    public UUID getBomCalculationId() { return bomCalculationId; }
    public void setBomCalculationId(UUID bomCalculationId) { this.bomCalculationId = bomCalculationId; }

    public Material getMaterial() { return material; }
    public void setMaterial(Material material) { this.material = material; }

    public BigDecimal getPlannedQty() { return plannedQty; }
    public void setPlannedQty(BigDecimal plannedQty) { this.plannedQty = plannedQty; }

    public BigDecimal getEffectivePlannedQty() { return effectivePlannedQty; }
    public void setEffectivePlannedQty(BigDecimal effectivePlannedQty) { this.effectivePlannedQty = effectivePlannedQty; }

    public BigDecimal getRealConsumptionQty() { return realConsumptionQty; }
    public void setRealConsumptionQty(BigDecimal realConsumptionQty) { this.realConsumptionQty = realConsumptionQty; }

    public BigDecimal getVarianceQty() { return varianceQty; }

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

    @PrePersist
    private void prePersist() {
        if (id == null) {
			id = UUID.randomUUID();
		}
        if (createdAt == null) {
			createdAt = Instant.now();
		}
        updatedAt = Instant.now();
        if (status == null) {
			status = "PROVISIONAL";
		}
        if (effectivePlannedQty == null && plannedQty != null) {
			effectivePlannedQty = plannedQty;
		}
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
			return true;
		}
        if (o == null || getClass() != o.getClass()) {
			return false;
		}
        OrderConsumptionLogEntity that = (OrderConsumptionLogEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "OrderConsumptionLogEntity{" +
                "id=" + id +
                ", orderId=" + orderId +
                ", material=" + (material != null ? material.getId() : null) +
                ", plannedQty=" + plannedQty +
                ", effectivePlannedQty=" + effectivePlannedQty +
                ", realConsumptionQty=" + realConsumptionQty +
                ", deductedInventoryId=" + deductedInventoryId +
                ", status='" + status + '\'' +
                ", tenantId=" + tenantId +
                ", companyId=" + companyId +
                '}';
    }
}
