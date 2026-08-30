package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;

import java.time.Instant;
import java.util.UUID;

/**
 * Manual "Close today" override for a company. One row per (tenantId, companyId).
 * When closedUntil is set and in the future, customer ordering is blocked regardless of
 * the regular shift schedule. It auto-expires (no cron needed) — once Instant.now() passes
 * closedUntil, ShopHoursService treats the shop as open again per the normal shift schedule.
 */
@Entity
@Table(name = "shop_closure")
public class ShopClosure {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "closed_until")
    private Instant closedUntil;

    @Column(name = "closed_by", length = 120)
    private String closedBy;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (updatedAt == null) updatedAt = Instant.now();
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public Instant getClosedAt() { return closedAt; }
    public void setClosedAt(Instant closedAt) { this.closedAt = closedAt; }
    public Instant getClosedUntil() { return closedUntil; }
    public void setClosedUntil(Instant closedUntil) { this.closedUntil = closedUntil; }
    public String getClosedBy() { return closedBy; }
    public void setClosedBy(String closedBy) { this.closedBy = closedBy; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
