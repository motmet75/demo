// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity;

import java.math.BigDecimal;
import java.time.LocalDate;
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
@Table(name = "product_attribute_value", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"product_id", "attribute_code"})
})
@Access(value = AccessType.FIELD)
public class ProductAttributeValue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(name = "attribute_code", nullable = false, length = 100)
    private String attributeCode = "";

    @Column(name = "text_value")
    private String textValue;

    @Column(name = "number_value", precision = 18, scale = 4)
    private BigDecimal numberValue;

    @Column(name = "boolean_value")
    private Boolean booleanValue;

    @Column(name = "date_value")
    private LocalDate dateValue;

    @Column(name = "visible", nullable = false)
    private Boolean visible = true;

    @Column(name = "created_time")
    private LocalDateTime createdTime = LocalDateTime.now();

    @Column(name = "modified_time")
    private LocalDateTime modifiedTime = LocalDateTime.now();

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }

    public String getAttributeCode() { return attributeCode == null ? "" : Utilities.GetBackStringValue(attributeCode); }
    public void setAttributeCode(String attributeCode) { this.attributeCode = normalizeCode(attributeCode); }

    public String getTextValue() { return textValue == null ? "" : Utilities.GetBackStringValue(textValue); }
    public void setTextValue(String textValue) { this.textValue = Utilities.ValidateInputValue(textValue); }

    public BigDecimal getNumberValue() { return numberValue; }
    public void setNumberValue(BigDecimal numberValue) { this.numberValue = numberValue; }

    public Boolean getBooleanValue() { return booleanValue; }
    public void setBooleanValue(Boolean booleanValue) { this.booleanValue = booleanValue; }

    public LocalDate getDateValue() { return dateValue; }
    public void setDateValue(LocalDate dateValue) { this.dateValue = dateValue; }

    public Boolean getVisible() { return visible == null ? Boolean.TRUE : visible; }
    public void setVisible(Boolean visible) { this.visible = visible; }

    public LocalDateTime getCreatedTime() { return createdTime; }
    public void setCreatedTime(LocalDateTime createdTime) { this.createdTime = createdTime; }

    public LocalDateTime getModifiedTime() { return modifiedTime; }
    public void setModifiedTime(LocalDateTime modifiedTime) { this.modifiedTime = modifiedTime; }

    public void clearTypedValues() {
        textValue = null;
        numberValue = null;
        booleanValue = null;
        dateValue = null;
    }

    public Object getTypedValue(String dataType) {
        String type = dataType == null ? ProductAttribute.DATA_TYPE_TEXT : dataType;
        if (ProductAttribute.DATA_TYPE_NUMBER.equals(type)) return numberValue;
        if (ProductAttribute.DATA_TYPE_BOOLEAN.equals(type)) return booleanValue;
        if (ProductAttribute.DATA_TYPE_DATE.equals(type)) return dateValue;
        return getTextValue();
    }

    public String getDisplayValue(String dataType) {
        Object value = getTypedValue(dataType);
        return value == null ? "" : String.valueOf(value);
    }

    private String normalizeCode(String value) {
        String code = value == null ? "" : Utilities.ValidateInputValue(value).trim();
        return code.toUpperCase().replaceAll("[^A-Z0-9_]+", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
    }
}