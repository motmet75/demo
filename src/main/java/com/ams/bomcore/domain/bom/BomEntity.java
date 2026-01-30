package com.ams.bomcore.domain.bom;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.ams.bomcore.domain.model.Model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * Entity mapping for the `bom` table.
 */
@Entity
@Table(name = "bom", uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "model_id", "version"}))
public class BomEntity {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    // tenant isolation key (string to match TenantContext usage elsewhere)
    @Column(name = "tenant_id", nullable = false, length = 100)
    private String tenantId;

    // company scope for BOM (nullable if BOM is tenant-wide)
    @Column(name = "company_id", length = 100)
    private String companyId;

    @ManyToOne
    @JoinColumn(name = "model_id", nullable = false)
    private Model model;

    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "status", nullable = false, length = 20)
    private String status;

    @Column(name = "created_at")
    private Instant createdAt;

    public BomEntity() {
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

    public Model getModel() {
        return model;
    }

    public void setModel(Model model) {
        this.model = model;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
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
        BomEntity bomEntity = (BomEntity) o;
        return Objects.equals(id, bomEntity.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "BomEntity{" +
                "id=" + id +
                ", tenantId='" + tenantId + '\'' +
                ", companyId='" + companyId + '\'' +
                ", model=" + (model != null ? model.getId() : null) +
                ", version=" + version +
                ", status='" + status + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}