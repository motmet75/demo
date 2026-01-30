package com.ams.bomcore.domain.bom;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

import com.ams.bomcore.domain.material.Material;

/**
 * BOM item linking a BOM (BomEntity) to Material with quantity
 */
@Entity
@Table(name = "bom_item")
public class BomItem {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "bom_id", nullable = false)
    private BomEntity bom;

    @ManyToOne
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(name = "quantity", nullable = false)
    private Double quantity;

    @Column(name = "created_at")
    private Instant createdAt;

    public BomItem() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public BomEntity getBom() { return bom; }
    public void setBom(BomEntity bom) { this.bom = bom; }

    public Material getMaterial() { return material; }
    public void setMaterial(Material material) { this.material = material; }

    public Double getQuantity() { return quantity; }
    public void setQuantity(Double quantity) { this.quantity = quantity; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BomItem bomItem = (BomItem) o;
        return Objects.equals(id, bomItem.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "BomItem{" +
                "id=" + id +
                ", bom=" + (bom != null ? bom.getId() : null) +
                ", material=" + (material != null ? material.getId() : null) +
                ", quantity=" + quantity +
                ", createdAt=" + createdAt +
                '}';
    }
}
