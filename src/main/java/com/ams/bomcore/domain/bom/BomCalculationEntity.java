package com.ams.bomcore.domain.bom;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Entity mapping for table `bom_calculation`.
 */
@Entity
@Table(name = "bom_calculation")
public class BomCalculationEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bom_id", nullable = false)
    private BomEntity bom;

    // tenant for calculation - copied from BOM for isolation and easier queries
    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "model_name", nullable = false, length = 100)
    private String modelName;

    @Column(name = "target_qty", nullable = false, precision = 14, scale = 4)
    private BigDecimal targetQty;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "created_at")
    private Instant createdAt;

    @OneToMany(mappedBy = "calculation", fetch = FetchType.LAZY,
            cascade = {CascadeType.PERSIST, CascadeType.MERGE}, orphanRemoval = false)
    private List<BomCalculationItemEntity> items = new ArrayList<>();

    public BomCalculationEntity() {
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public BomEntity getBom() {
        return bom;
    }

    public void setBom(BomEntity bom) {
        this.bom = bom;
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

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public BigDecimal getTargetQty() {
        return targetQty;
    }

    public void setTargetQty(BigDecimal targetQty) {
        this.targetQty = targetQty;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public List<BomCalculationItemEntity> getItems() {
        return items;
    }

    public void setItems(List<BomCalculationItemEntity> items) {
        this.items = items;
    }

    @PrePersist
    private void prePersist() {
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        BomCalculationEntity that = (BomCalculationEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "BomCalculationEntity{" +
                "id=" + id +
                ", bom=" + (bom != null ? bom.getId() : null) +
                ", tenantId=" + tenantId +
                ", modelName='" + modelName + '\'' +
                ", targetQty=" + targetQty +
                ", status='" + status + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}