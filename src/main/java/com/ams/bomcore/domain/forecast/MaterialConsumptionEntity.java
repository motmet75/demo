package com.ams.bomcore.domain.forecast;

import java.time.LocalDate;
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
import org.hibernate.annotations.Immutable;

/**
 * Append-only, read-optimized entity for table `material_consumption`.
 * - No cascade logic; associations are LAZY.
 */
@Entity
@Table(name = "material_consumption")
@Immutable
public class MaterialConsumptionEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false, length = 100)
    private String tenantId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(name = "quantity", nullable = false, columnDefinition = "numeric")
    private java.math.BigDecimal quantity;

    @Column(name = "source", nullable = false, length = 30)
    private String source;

    @Column(name = "consumed_at", nullable = false)
    private LocalDate consumedAt;

    public MaterialConsumptionEntity() {
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

    public Material getMaterial() {
        return material;
    }

    public void setMaterial(Material material) {
        this.material = material;
    }

    public java.math.BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(java.math.BigDecimal quantity) {
        this.quantity = quantity;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public LocalDate getConsumedAt() {
        return consumedAt;
    }

    public void setConsumedAt(LocalDate consumedAt) {
        this.consumedAt = consumedAt;
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
        MaterialConsumptionEntity that = (MaterialConsumptionEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "MaterialConsumptionEntity{" +
                "id=" + id +
                ", tenantId='" + tenantId + '\'' +
                ", material=" + (material != null ? material.getId() : null) +
                ", quantity=" + quantity +
                ", source='" + source + '\'' +
                ", consumedAt=" + consumedAt +
                '}';
    }
}