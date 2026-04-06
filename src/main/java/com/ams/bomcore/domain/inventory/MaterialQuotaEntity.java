package com.ams.bomcore.domain.inventory;

import java.math.BigDecimal;
import java.time.Instant;
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
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.UniqueConstraint;

/**
 * Entity mapping for table `material_quota`.
 * Tracks allocated and consumed quota per material per period.
 */
@Entity
@Table(name = "material_quota", uniqueConstraints = @UniqueConstraint(columnNames = {"material_id", "tenant_id", "company_id", "quota_period"}))
public class MaterialQuotaEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @Column(name = "quota_period", nullable = false)
    private LocalDate quotaPeriod;

    @Column(name = "allocated_quota", nullable = false, columnDefinition = "numeric")
    private BigDecimal allocatedQuota = BigDecimal.ZERO;

    @Column(name = "consumed_quota", nullable = false, columnDefinition = "numeric")
    private BigDecimal consumedQuota = BigDecimal.ZERO;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    public MaterialQuotaEntity() {
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

    public LocalDate getQuotaPeriod() {
        return quotaPeriod;
    }

    public void setQuotaPeriod(LocalDate quotaPeriod) {
        this.quotaPeriod = quotaPeriod;
    }

    public BigDecimal getAllocatedQuota() {
        return allocatedQuota;
    }

    public void setAllocatedQuota(BigDecimal allocatedQuota) {
        this.allocatedQuota = allocatedQuota;
    }

    public BigDecimal getConsumedQuota() {
        return consumedQuota;
    }

    public void setConsumedQuota(BigDecimal consumedQuota) {
        this.consumedQuota = consumedQuota;
    }

    @Transient
    public BigDecimal getRemainingQuota() {
        return allocatedQuota.subtract(consumedQuota);
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
        updatedAt = Instant.now();
        if (allocatedQuota == null) {
            allocatedQuota = BigDecimal.ZERO;
        }
        if (consumedQuota == null) {
            consumedQuota = BigDecimal.ZERO;
        }
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        MaterialQuotaEntity that = (MaterialQuotaEntity) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "MaterialQuotaEntity{" +
                "id=" + id +
                ", tenantId=" + tenantId +
                ", companyId=" + companyId +
                ", material=" + (material != null ? material.getId() : null) +
                ", quotaPeriod=" + quotaPeriod +
                ", allocatedQuota=" + allocatedQuota +
                ", consumedQuota=" + consumedQuota +
                ", createdAt=" + createdAt +
                '}';
    }
}
