package com.ams.bomcore.domain.modelbom;

import java.math.BigDecimal;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.model.Model;

/**
 * JPA entity mapping for table `model_bom` which links Model -> Material with qty per unit
 */
@Entity
@Table(name = "model_bom")
public class ModelBom {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    // company_id column to scope ModelBom to a company when applicable
    @Column(name = "company_id")
    private UUID companyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private Model model;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(name = "qty_per_unit", precision = 14, scale = 4, nullable = false)
    private BigDecimal qtyPerUnit;

    public ModelBom() {
        // default constructor
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

    public Model getModel() {
        return model;
    }

    public void setModel(Model model) {
        this.model = model;
    }

    public Material getMaterial() {
        return material;
    }

    public void setMaterial(Material material) {
        this.material = material;
    }

    public BigDecimal getQtyPerUnit() {
        return qtyPerUnit;
    }

    public void setQtyPerUnit(BigDecimal qtyPerUnit) {
        this.qtyPerUnit = qtyPerUnit;
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
        ModelBom that = (ModelBom) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "ModelBom{" +
                "id=" + id +
                ", tenantId=" + tenantId +
                ", companyId=" + companyId +
                ", model=" + (model != null ? model.getId() : null) +
                ", material=" + (material != null ? material.getId() : null) +
                ", qtyPerUnit=" + qtyPerUnit +
                '}';
    }
}