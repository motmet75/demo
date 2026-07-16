package com.ams.bomcore.domain.material;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/**
 * JPA entity mapping for table `material` in bom_core_schema.sql
 */
@Entity
@Table(name = "material")
public class Material {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne
    @JoinColumn(name = "tenant_id", nullable = false)
    private Tenant tenant;

    @ManyToOne
    @JoinColumn(name = "company_id", nullable = false)
    private Company company;

    @Column(name = "material_code", nullable = false, length = 50)
    private String materialCode;

    @Column(name = "material_name", nullable = false, columnDefinition = "TEXT")
    private String materialName;

    @Column(name = "unit", nullable = false, length = 20)
    private String unit;

    @Column(name = "material_type", nullable = false, length = 30)
    private String materialType;

    @Column(name = "thumbnail_url", columnDefinition = "TEXT")
    private String thumbnailUrl;

    @Column(name = "price")
    private BigDecimal price;

    @Column(name = "inventory_alert_enabled", nullable = false)
    private Boolean inventoryAlertEnabled = Boolean.TRUE;

    @Column(name = "inventory_alert_quantity", columnDefinition = "numeric")
    private BigDecimal inventoryAlertQuantity;

    @Column(name = "inventory_alert_percentage", columnDefinition = "numeric")
    private BigDecimal inventoryAlertPercentage;

    @Column(name = "description", columnDefinition = "TEXT")
    private String description;

    @Column(name = "is_active")
    private Boolean isActive;

    @Column(name = "created_at")
    private Instant createdAt;

    public Material() {
        // default constructor required by JPA
    }

    // Getters and setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public Tenant getTenant() { return tenant; }
    public void setTenant(Tenant tenant) { this.tenant = tenant; }

    public Company getCompany() {
        return company;
    }

    public void setCompany(Company company) {
        this.company = company;
    }

    public String getMaterialCode() {
        return materialCode;
    }

    public void setMaterialCode(String materialCode) {
        this.materialCode = materialCode;
    }

    public String getMaterialName() {
        return materialName;
    }

    public void setMaterialName(String materialName) {
        this.materialName = materialName;
    }

    public String getUnit() {
        return unit;
    }

    public void setUnit(String unit) {
        this.unit = unit;
    }

    public String getMaterialType() {
        return materialType;
    }

    public void setMaterialType(String materialType) {
        this.materialType = materialType;
    }

    public String getThumbnailUrl() {
        return thumbnailUrl;
    }

    public void setThumbnailUrl(String thumbnailUrl) {
        this.thumbnailUrl = thumbnailUrl;
    }

    public BigDecimal getPrice() {
        return price;
    }

    public void setPrice(BigDecimal price) {
        this.price = price;
    }

    public Boolean getInventoryAlertEnabled() {
        return inventoryAlertEnabled;
    }

    public void setInventoryAlertEnabled(Boolean inventoryAlertEnabled) {
        this.inventoryAlertEnabled = inventoryAlertEnabled;
    }

    public BigDecimal getInventoryAlertQuantity() {
        return inventoryAlertQuantity;
    }

    public void setInventoryAlertQuantity(BigDecimal inventoryAlertQuantity) {
        this.inventoryAlertQuantity = inventoryAlertQuantity;
    }

    public BigDecimal getInventoryAlertPercentage() {
        return inventoryAlertPercentage;
    }

    public void setInventoryAlertPercentage(BigDecimal inventoryAlertPercentage) {
        this.inventoryAlertPercentage = inventoryAlertPercentage;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
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
        if (isActive == null) {
            isActive = Boolean.TRUE;
        }
        if (inventoryAlertEnabled == null) {
            inventoryAlertEnabled = Boolean.TRUE;
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
        Material material = (Material) o;
        return Objects.equals(id, material.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }

    @Override
    public String toString() {
        return "Material{" +
                "id=" + id +
                ", tenant=" + (tenant != null ? tenant.getId() : null) +
                ", company=" + (company != null ? company.getId() : null) +
                ", materialCode='" + materialCode + '\'' +
                ", materialName='" + materialName + '\'' +
                ", unit='" + unit + '\'' +
                ", materialType='" + materialType + '\'' +
                ", thumbnailUrl='" + thumbnailUrl + '\'' +
                ", price=" + price +
                ", description='" + description + '\'' +
                ", isActive=" + isActive +
                ", createdAt=" + createdAt +
                '}';
    }
}