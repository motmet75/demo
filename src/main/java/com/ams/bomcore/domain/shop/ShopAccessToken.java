package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shop_access_token",
       indexes = @Index(name = "idx_shop_access_token_token", columnList = "token", unique = true))
public class ShopAccessToken {

    public static final String TYPE_TABLE_QR     = "TABLE_QR";
    public static final String TYPE_QUEUE_QR     = "QUEUE_QR";
    public static final String TYPE_DISPLAY_BOARD = "DISPLAY_BOARD";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "token", nullable = false, length = 100, unique = true)
    private String token;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "table_id")
    private UUID tableId;

    @Column(name = "token_type", length = 50)
    private String tokenType;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "access_count")
    private Integer accessCount = 0;

    @Column(name = "last_accessed_at")
    private Instant lastAccessedAt;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "enabled")
    private Boolean enabled = true;

    @Column(name = "max_orders")
    private Integer maxOrders;

    @Column(name = "counter_locked")
    private Boolean counterLocked = false;

    @Column(name = "counter_locked_at")
    private Instant counterLockedAt;

    @Column(name = "counter_locked_by", length = 120)
    private String counterLockedBy;

    public ShopAccessToken() {}

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (enabled == null) enabled = true;
        if (accessCount == null) accessCount = 0;
        if (counterLocked == null) counterLocked = false;
    }

    public boolean isValid() {
        if (!Boolean.TRUE.equals(enabled)) return false;
        if (expiresAt != null && Instant.now().isAfter(expiresAt)) return false;
        return true;
    }

    public void recordAccess() {
        this.accessCount = (this.accessCount == null ? 0 : this.accessCount) + 1;
        this.lastAccessedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getToken() { return token; }
    public void setToken(String token) { this.token = token; }
    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public UUID getTableId() { return tableId; }
    public void setTableId(UUID tableId) { this.tableId = tableId; }
    public String getTokenType() { return tokenType; }
    public void setTokenType(String tokenType) { this.tokenType = tokenType; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Integer getAccessCount() { return accessCount; }
    public void setAccessCount(Integer accessCount) { this.accessCount = accessCount; }
    public Instant getLastAccessedAt() { return lastAccessedAt; }
    public void setLastAccessedAt(Instant lastAccessedAt) { this.lastAccessedAt = lastAccessedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getExpiresAt() { return expiresAt; }
    public void setExpiresAt(Instant expiresAt) { this.expiresAt = expiresAt; }
    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
    public Integer getMaxOrders() { return maxOrders; }
    public void setMaxOrders(Integer maxOrders) { this.maxOrders = maxOrders; }
    public Boolean getCounterLocked() { return Boolean.TRUE.equals(counterLocked); }
    public void setCounterLocked(Boolean counterLocked) { this.counterLocked = counterLocked; }
    public Instant getCounterLockedAt() { return counterLockedAt; }
    public void setCounterLockedAt(Instant counterLockedAt) { this.counterLockedAt = counterLockedAt; }
    public String getCounterLockedBy() { return counterLockedBy; }
    public void setCounterLockedBy(String counterLockedBy) { this.counterLockedBy = counterLockedBy; }
}
