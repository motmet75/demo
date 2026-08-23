package com.ams.bomcore.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

/**
 * JPA entity mapping for table `model` (product models)
 */
@Entity
@Table(name = "model")
public class Model {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    // company id as UUID
    @Column(name = "company_id")
    private UUID companyId;

    @Column(name = "model_code", nullable = false, unique = true, length = 50)
    private String modelCode;

    @Column(name = "model_name", nullable = false, columnDefinition = "TEXT")
    private String modelName;

    /** JSON object keyed by language code, e.g. {"cn":"...","tw":"...","vi":"..."}. */
    @Column(name = "model_name_translations", columnDefinition = "TEXT")
    private String modelNameTranslations;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "hs_code", length = 20)
    private String hsCode;

    @Column(name = "co_criteria", length = 100)
    private String coCriteria;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "selling_price", columnDefinition = "numeric")
    private BigDecimal sellingPrice;

    @Column(name = "category", length = 50)
    private String category;

    @Column(name = "category_translations", columnDefinition = "TEXT")
    private String categoryTranslations;

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    /** Customer-facing ingredient/composition text displayed on the ordering menu. */
    @Column(name = "ingredients", columnDefinition = "TEXT")
    private String ingredients;

    /**
     * JSON side/topping links: [{"modelId":"uuid","maxQty":5}].
     * Legacy UUID string arrays remain readable for backward compatibility.
     */
    @Column(name = "allowed_side_ids", columnDefinition = "TEXT")
    private String allowedSideIds;

    @Column(name = "shop_available_units_override", columnDefinition = "numeric")
    private BigDecimal shopAvailableUnitsOverride;

    @Column(name = "shop_available_units_override_date")
    private LocalDate shopAvailableUnitsOverrideDate;

    @Transient
    private BigDecimal shopDailyLimitUnits;

    @Transient
    private BigDecimal shopDailySoldUnits;

    @Transient
    private BigDecimal shopDailyRemainingUnits;

    public Model() {
        // default constructor required by JPA
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

    public String getModelCode() {
        return modelCode;
    }

    public void setModelCode(String modelCode) {
        this.modelCode = modelCode;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getModelNameTranslations() { return modelNameTranslations; }
    public void setModelNameTranslations(String modelNameTranslations) { this.modelNameTranslations = modelNameTranslations; }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public String getHsCode() {
        return hsCode;
    }

    public void setHsCode(String hsCode) {
        this.hsCode = hsCode;
    }

    public String getCoCriteria() {
        return coCriteria;
    }

    public void setCoCriteria(String coCriteria) {
        this.coCriteria = coCriteria;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public BigDecimal getSellingPrice() { return sellingPrice; }
    public void setSellingPrice(BigDecimal sellingPrice) { this.sellingPrice = sellingPrice; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getCategoryTranslations() { return categoryTranslations; }
    public void setCategoryTranslations(String categoryTranslations) { this.categoryTranslations = categoryTranslations; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getIngredients() { return ingredients; }
    public void setIngredients(String ingredients) { this.ingredients = ingredients; }

    public String getAllowedSideIds() { return allowedSideIds; }
    public void setAllowedSideIds(String allowedSideIds) { this.allowedSideIds = allowedSideIds; }
    public BigDecimal getShopAvailableUnitsOverride() { return shopAvailableUnitsOverride; }
    public void setShopAvailableUnitsOverride(BigDecimal shopAvailableUnitsOverride) { this.shopAvailableUnitsOverride = shopAvailableUnitsOverride; }
    public LocalDate getShopAvailableUnitsOverrideDate() { return shopAvailableUnitsOverrideDate; }
    public void setShopAvailableUnitsOverrideDate(LocalDate shopAvailableUnitsOverrideDate) { this.shopAvailableUnitsOverrideDate = shopAvailableUnitsOverrideDate; }
    public BigDecimal getShopDailyLimitUnits() { return shopDailyLimitUnits; }
    public void setShopDailyLimitUnits(BigDecimal shopDailyLimitUnits) { this.shopDailyLimitUnits = shopDailyLimitUnits; }
    public BigDecimal getShopDailySoldUnits() { return shopDailySoldUnits; }
    public void setShopDailySoldUnits(BigDecimal shopDailySoldUnits) { this.shopDailySoldUnits = shopDailySoldUnits; }
    public BigDecimal getShopDailyRemainingUnits() { return shopDailyRemainingUnits; }
    public void setShopDailyRemainingUnits(BigDecimal shopDailyRemainingUnits) { this.shopDailyRemainingUnits = shopDailyRemainingUnits; }

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
        Model model = (Model) o;
        return Objects.equals(id, model.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Model{" +
                "id=" + id +
                ", tenantId='" + tenantId + '\'' +
                ", companyId='" + companyId + '\'' +
                ", modelCode='" + modelCode + '\'' +
                ", modelName='" + modelName + '\'' +
                ", hsCode='" + hsCode + '\'' +
                ", coCriteria='" + coCriteria + '\'' +
                ", isActive=" + isActive +
                ", createdAt=" + createdAt +
                '}';
    }
}
