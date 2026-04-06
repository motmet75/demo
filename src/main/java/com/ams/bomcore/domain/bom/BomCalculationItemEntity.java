package com.ams.bomcore.domain.bom;

import java.math.BigDecimal;
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
import jakarta.persistence.Table;

/**
 * Entity mapping for table `bom_calculation_item`.
 */
@Entity
@Table(name = "bom_calculation_item")
public class BomCalculationItemEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "calculation_id", nullable = false)
    private BomCalculationEntity calculation;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(name = "required_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal requiredQty;

    @Column(name = "available_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal availableQty;

    @Column(name = "shortage_qty", nullable = false, columnDefinition = "numeric")
    private BigDecimal shortageQty;

    public BomCalculationItemEntity() {
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

    public BomCalculationEntity getCalculation() {
        return calculation;
    }

    public void setCalculation(BomCalculationEntity calculation) {
        this.calculation = calculation;
    }

    public Material getMaterial() {
        return material;
    }

    public void setMaterial(Material material) {
        this.material = material;
    }

    public BigDecimal getRequiredQty() {
        return requiredQty;
    }

    public void setRequiredQty(BigDecimal requiredQty) {
        this.requiredQty = requiredQty;
    }

    public BigDecimal getAvailableQty() {
        return availableQty;
    }

    public void setAvailableQty(BigDecimal availableQty) {
        this.availableQty = availableQty;
    }

    public BigDecimal getShortageQty() {
        return shortageQty;
    }

    public void setShortageQty(BigDecimal shortageQty) {
        this.shortageQty = shortageQty;
    }

    @PrePersist
    private void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BomCalculationItemEntity that = (BomCalculationItemEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "BomCalculationItemEntity{" +
                "id=" + id +
                ", tenantId=" + tenantId +
                ", calculation=" + (calculation != null ? calculation.getId() : null) +
                ", material=" + (material != null ? material.getId() : null) +
                ", requiredQty=" + requiredQty +
                ", availableQty=" + availableQty +
                ", shortageQty=" + shortageQty +
                '}';
    }
}