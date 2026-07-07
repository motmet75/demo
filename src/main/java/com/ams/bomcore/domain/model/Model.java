package com.ams.bomcore.domain.model;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

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

    @Column(name = "image_url", columnDefinition = "TEXT")
    private String imageUrl;

    /** JSON array of model UUIDs that are allowed as side items/toppings for this model, e.g. ["uuid1","uuid2"]. Null means no sides allowed. */
    @Column(name = "allowed_side_ids", columnDefinition = "TEXT")
    private String allowedSideIds;

    @Column(name = "shop_available_units_override", columnDefinition = "numeric")
    private BigDecimal shopAvailableUnitsOverride;

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

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public String getAllowedSideIds() { return allowedSideIds; }
    public void setAllowedSideIds(String allowedSideIds) { this.allowedSideIds = allowedSideIds; }
    public BigDecimal getShopAvailableUnitsOverride() { return shopAvailableUnitsOverride; }
    public void setShopAvailableUnitsOverride(BigDecimal shopAvailableUnitsOverride) { this.shopAvailableUnitsOverride = shopAvailableUnitsOverride; }

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