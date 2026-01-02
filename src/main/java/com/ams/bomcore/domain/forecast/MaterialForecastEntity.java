package com.ams.bomcore.domain.forecast;

import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import com.ams.bomcore.domain.inventory.WarehouseEntity;
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
 * Append-only, read-optimized entity for table `material_forecast`.
 * - No cascade logic; associations are LAZY.
 */
@Entity
@Table(name = "material_forecast")
@Immutable
public class MaterialForecastEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "warehouse_id", nullable = false)
    private WarehouseEntity warehouse;

    @Column(name = "forecast_date", nullable = false)
    private LocalDate forecastDate;

    @Column(name = "forecast_qty", nullable = false, precision = 14, scale = 4)
    private java.math.BigDecimal forecastQty;

    @Column(name = "model_version", length = 20)
    private String modelVersion;

    public MaterialForecastEntity() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
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

    public LocalDate getForecastDate() {
        return forecastDate;
    }

    public void setForecastDate(LocalDate forecastDate) {
        this.forecastDate = forecastDate;
    }

    public java.math.BigDecimal getForecastQty() {
        return forecastQty;
    }

    public void setForecastQty(java.math.BigDecimal forecastQty) {
        this.forecastQty = forecastQty;
    }

    public String getModelVersion() {
        return modelVersion;
    }

    public void setModelVersion(String modelVersion) {
        this.modelVersion = modelVersion;
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
        MaterialForecastEntity that = (MaterialForecastEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "MaterialForecastEntity{" +
                "id=" + id +
                ", material=" + (material != null ? material.getId() : null) +
                ", warehouse=" + (warehouse != null ? warehouse.getId() : null) +
                ", forecastDate=" + forecastDate +
                ", forecastQty=" + forecastQty +
                ", modelVersion='" + modelVersion + '\'' +
                '}';
    }
}
