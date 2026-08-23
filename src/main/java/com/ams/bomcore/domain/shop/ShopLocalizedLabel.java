package com.ams.bomcore.domain.shop;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shop_localized_label")
public class ShopLocalizedLabel {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id")
    private UUID tenantId;

    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "label_namespace", nullable = false, length = 60)
    private String labelNamespace;

    @Column(name = "label_key", nullable = false, length = 120)
    private String labelKey;

    @Column(name = "default_text", nullable = false, columnDefinition = "TEXT")
    private String defaultText;

    /** JSON object keyed by language code, e.g. {"en":"Paid","vi":"Đã thanh toán"}. */
    @Column(name = "translations", columnDefinition = "TEXT")
    private String translations;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "is_active")
    private Boolean isActive = true;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = createdAt;
        if (displayOrder == null) displayOrder = 0;
        if (isActive == null) isActive = true;
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
    public String getLabelNamespace() { return labelNamespace; }
    public void setLabelNamespace(String labelNamespace) { this.labelNamespace = labelNamespace; }
    public String getLabelKey() { return labelKey; }
    public void setLabelKey(String labelKey) { this.labelKey = labelKey; }
    public String getDefaultText() { return defaultText; }
    public void setDefaultText(String defaultText) { this.defaultText = defaultText; }
    public String getTranslations() { return translations; }
    public void setTranslations(String translations) { this.translations = translations; }
    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }
    public Boolean getIsActive() { return isActive; }
    public void setIsActive(Boolean isActive) { this.isActive = isActive; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}
