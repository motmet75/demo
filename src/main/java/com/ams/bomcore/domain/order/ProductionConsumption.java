package com.ams.bomcore.domain.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import com.ams.bomcore.domain.material.Material;

/**
 * JPA entity for table {@code production_consumption}.
 * Tracks per-run planned vs. actual material consumption with a DB-generated variance.
 * {@code variance_qty} is a GENERATED ALWAYS AS column — never written by JPA.
 */
@Entity
@Table(name = "production_consumption")
public class ProductionConsumption {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "production_run_id", nullable = false)
    private ProductionRun productionRun;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(name = "planned_qty", nullable = false, precision = 14, scale = 4)
    private BigDecimal plannedQty;

    @Column(name = "effective_planned_qty", nullable = false, precision = 14, scale = 4)
    private BigDecimal effectivePlannedQty;

    @Column(name = "actual_consumed_qty", precision = 14, scale = 4)
    private BigDecimal actualConsumedQty;

    /**
     * DB-generated column: COALESCE(actual_consumed_qty, effective_planned_qty) - planned_qty.
     * Never set by the application.
     */
    @Column(name = "variance_qty", insertable = false, updatable = false, precision = 14, scale = 4)
    private BigDecimal varianceQty;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public ProductionConsumption() {
    }

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        updatedAt = Instant.now();
        if (effectivePlannedQty == null && plannedQty != null) effectivePlannedQty = plannedQty;
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    // ── Getters & Setters ─────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public ProductionRun getProductionRun() { return productionRun; }
    public void setProductionRun(ProductionRun productionRun) { this.productionRun = productionRun; }

    public Material getMaterial() { return material; }
    public void setMaterial(Material material) { this.material = material; }

    public BigDecimal getPlannedQty() { return plannedQty; }
    public void setPlannedQty(BigDecimal plannedQty) { this.plannedQty = plannedQty; }

    public BigDecimal getEffectivePlannedQty() { return effectivePlannedQty; }
    public void setEffectivePlannedQty(BigDecimal effectivePlannedQty) { this.effectivePlannedQty = effectivePlannedQty; }

    public BigDecimal getActualConsumedQty() { return actualConsumedQty; }
    public void setActualConsumedQty(BigDecimal actualConsumedQty) { this.actualConsumedQty = actualConsumedQty; }

    /** Read-only — computed by the database. */
    public BigDecimal getVarianceQty() { return varianceQty; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        ProductionConsumption that = (ProductionConsumption) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }
}
