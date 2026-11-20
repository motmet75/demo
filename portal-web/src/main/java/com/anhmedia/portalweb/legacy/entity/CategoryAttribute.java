// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity;

import java.time.LocalDateTime;
import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;
import jakarta.persistence.UniqueConstraint;

import com.anhmedia.portalweb.legacy.Utilities;

@Entity
@Table(name = "category_attribute", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"category_code", "attribute_code"})
})
@Access(value = AccessType.FIELD)
public class CategoryAttribute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "category_code", nullable = false, length = 100)
    private String categoryCode = "";

    @Column(name = "attribute_code", nullable = false, length = 100)
    private String attributeCode = "";

    @Column(name = "required", nullable = false)
    private Boolean required = false;

    @Column(name = "filterable", nullable = false)
    private Boolean filterable = true;

    @Column(name = "searchable", nullable = false)
    private Boolean searchable = true;

    @Column(name = "visible_on_card", nullable = false)
    private Boolean visibleOnCard = false;

    @Column(name = "visible_on_detail", nullable = false)
    private Boolean visibleOnDetail = true;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @Column(name = "created_time")
    private LocalDateTime createdTime = LocalDateTime.now();

    @Transient
    private ProductAttribute attribute;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getCategoryCode() { return categoryCode == null ? "" : Utilities.GetBackStringValue(categoryCode); }
    public void setCategoryCode(String categoryCode) { this.categoryCode = normalizeCode(categoryCode); }

    public String getAttributeCode() { return attributeCode == null ? "" : Utilities.GetBackStringValue(attributeCode); }
    public void setAttributeCode(String attributeCode) { this.attributeCode = normalizeCode(attributeCode); }

    public Boolean getRequired() { return required == null ? Boolean.FALSE : required; }
    public void setRequired(Boolean required) { this.required = required; }

    public Boolean getFilterable() { return filterable == null ? Boolean.TRUE : filterable; }
    public void setFilterable(Boolean filterable) { this.filterable = filterable; }

    public Boolean getSearchable() { return searchable == null ? Boolean.TRUE : searchable; }
    public void setSearchable(Boolean searchable) { this.searchable = searchable; }

    public Boolean getVisibleOnCard() { return visibleOnCard == null ? Boolean.FALSE : visibleOnCard; }
    public void setVisibleOnCard(Boolean visibleOnCard) { this.visibleOnCard = visibleOnCard; }

    public Boolean getVisibleOnDetail() { return visibleOnDetail == null ? Boolean.TRUE : visibleOnDetail; }
    public void setVisibleOnDetail(Boolean visibleOnDetail) { this.visibleOnDetail = visibleOnDetail; }

    public Integer getDisplayOrder() { return displayOrder == null ? 0 : displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder == null ? 0 : displayOrder; }

    public Boolean getActive() { return active == null ? Boolean.TRUE : active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getCreatedTime() { return createdTime; }
    public void setCreatedTime(LocalDateTime createdTime) { this.createdTime = createdTime; }

    public ProductAttribute getAttribute() { return attribute; }
    public void setAttribute(ProductAttribute attribute) { this.attribute = attribute; }

    public String getAttributeName() { return attribute == null ? getAttributeCode() : attribute.getAttributeName(); }
    public String getDataType() { return attribute == null ? ProductAttribute.DATA_TYPE_TEXT : attribute.getDataType(); }
    public String getFilterType() { return attribute == null ? ProductAttribute.FILTER_TYPE_TEXT : attribute.getFilterType(); }
    public String getUnit() { return attribute == null ? "" : attribute.getUnit(); }

    private String normalizeCode(String value) {
        String code = value == null ? "" : Utilities.ValidateInputValue(value).trim();
        return code.toUpperCase().replaceAll("[^A-Z0-9_]+", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
    }
}