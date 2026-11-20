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
import jakarta.persistence.UniqueConstraint;

import com.anhmedia.portalweb.legacy.Utilities;

@Entity
@Table(name = "product_attribute", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"attribute_code"})
})
@Access(value = AccessType.FIELD)
public class ProductAttribute {

    public static final String DATA_TYPE_TEXT = "TEXT";
    public static final String DATA_TYPE_NUMBER = "NUMBER";
    public static final String DATA_TYPE_BOOLEAN = "BOOLEAN";
    public static final String DATA_TYPE_DATE = "DATE";

    public static final String FILTER_TYPE_CHECKBOX = "CHECKBOX";
    public static final String FILTER_TYPE_SELECT = "SELECT";
    public static final String FILTER_TYPE_RANGE = "RANGE";
    public static final String FILTER_TYPE_TEXT = "TEXT";
    public static final String FILTER_TYPE_NONE = "NONE";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "attribute_code", nullable = false, unique = true, length = 100)
    private String attributeCode = "";

    @Column(name = "attribute_name", nullable = false)
    private String attributeName = "";

    @Column(name = "data_type", nullable = false, length = 30)
    private String dataType = DATA_TYPE_TEXT;

    @Column(name = "filter_type", nullable = false, length = 30)
    private String filterType = FILTER_TYPE_TEXT;

    @Column(name = "unit", length = 50)
    private String unit = "";

    @Column(name = "active", nullable = false)
    private Boolean active = true;

    @Column(name = "created_time")
    private LocalDateTime createdTime = LocalDateTime.now();

    @Column(name = "modified_time")
    private LocalDateTime modifiedTime = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getAttributeCode() { return attributeCode == null ? "" : Utilities.GetBackStringValue(attributeCode); }
    public void setAttributeCode(String attributeCode) { this.attributeCode = normalizeCode(attributeCode); }

    public String getAttributeName() { return attributeName == null ? "" : Utilities.GetBackStringValue(attributeName); }
    public void setAttributeName(String attributeName) { this.attributeName = Utilities.ValidateInputValue(attributeName); }

    public String getDataType() { return dataType == null ? DATA_TYPE_TEXT : dataType; }
    public void setDataType(String dataType) { this.dataType = normalizeChoice(dataType, DATA_TYPE_TEXT); }

    public String getFilterType() { return filterType == null ? FILTER_TYPE_TEXT : filterType; }
    public void setFilterType(String filterType) { this.filterType = normalizeChoice(filterType, FILTER_TYPE_TEXT); }

    public String getUnit() { return unit == null ? "" : Utilities.GetBackStringValue(unit); }
    public void setUnit(String unit) { this.unit = Utilities.ValidateInputValue(unit); }

    public Boolean getActive() { return active == null ? Boolean.TRUE : active; }
    public void setActive(Boolean active) { this.active = active; }

    public LocalDateTime getCreatedTime() { return createdTime; }
    public void setCreatedTime(LocalDateTime createdTime) { this.createdTime = createdTime; }

    public LocalDateTime getModifiedTime() { return modifiedTime; }
    public void setModifiedTime(LocalDateTime modifiedTime) { this.modifiedTime = modifiedTime; }

    public String getDisplayName() {
        String label = getAttributeName().isBlank() ? getAttributeCode() : getAttributeName();
        return getUnit().isBlank() ? label : label + " (" + getUnit() + ")";
    }

    private String normalizeCode(String value) {
        String code = value == null ? "" : Utilities.ValidateInputValue(value).trim();
        return code.toUpperCase().replaceAll("[^A-Z0-9_]+", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
    }

    private String normalizeChoice(String value, String fallback) {
        String choice = value == null ? "" : value.trim().toUpperCase();
        return choice.isEmpty() ? fallback : choice;
    }

    @Override
    public String toString() { return getDisplayName(); }
}