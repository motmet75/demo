package com.ams.bomcore.domain.tenant;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * Tenant (Agent / Platform Owner)
 */
@Entity
@Table(name = "tenant")
public class Tenant {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_code", nullable = false, unique = true, length = 100)
    private String tenantCode;

    @Column(name = "tenant_name", nullable = false, columnDefinition = "TEXT")
    private String tenantName;

    @Column(name = "tenant_type", length = 50)
    private String tenantType; // e.g., AGENT, PLATFORM_OWNER

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = Boolean.TRUE;

    @Column(name = "max_companies", nullable = false)
    private Integer maxCompanies = 1;

    @Column(name = "created_at")
    private Instant createdAt;

    public Tenant() {}

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getTenantCode() { return tenantCode; }
    public void setTenantCode(String tenantCode) { this.tenantCode = tenantCode; }

    public String getTenantName() { return tenantName; }
    public void setTenantName(String tenantName) { this.tenantName = tenantName; }

    public String getTenantType() { return tenantType; }
    public void setTenantType(String tenantType) { this.tenantType = tenantType; }

    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }

    public Integer getMaxCompanies() { return maxCompanies; }
    public void setMaxCompanies(Integer maxCompanies) { this.maxCompanies = maxCompanies; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    @PrePersist
    private void prePersist() {
        if (id == null) {
			id = UUID.randomUUID();
		}
        if (createdAt == null) {
			createdAt = Instant.now();
		}
        if (isActive == null) {
			isActive = Boolean.TRUE;
		}
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
			return true;
		}
        if (o == null || getClass() != o.getClass()) {
			return false;
		}
        Tenant tenant = (Tenant) o;
        return Objects.equals(id, tenant.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "Tenant{" +
                "id=" + id +
                ", tenantCode='" + tenantCode + '\'' +
                ", tenantName='" + tenantName + '\'' +
                ", tenantType='" + tenantType + '\'' +
                ", isActive='" + isActive + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}