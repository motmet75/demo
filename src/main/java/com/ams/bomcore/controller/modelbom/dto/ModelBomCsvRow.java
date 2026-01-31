package com.ams.bomcore.controller.modelbom.dto;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * DTO representing one row from the Model-BOM CSV import.
 * Fields correspond to CSV columns in this order:
 *  - modelCode (required)
 *  - modelName (required)
 *  - materialCode (required; must already exist in DB during apply)
 *  - qtyPerUnit (required; BigDecimal)
 *
 * Note: This DTO is only an internal representation for parsing/validation.
 * The import flow will first parse and validate rows into this DTO, then
 * the service layer will handle DB lookups/creation when applying changes.
 */
public class ModelBomCsvRow {

    @NotBlank
    private String modelCode;

    @NotBlank
    private String modelName;

    @NotBlank
    private String materialCode;

    @NotNull
    private BigDecimal qtyPerUnit;

    // Optional: if CSV provides UUID for model (preserve when provided)
    private UUID modelId;

    // Optional tenantId and companyId parsed from CSV (if present)
    private UUID tenantId;
    private UUID companyId;

    public ModelBomCsvRow() {
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

    public String getMaterialCode() {
        return materialCode;
    }

    public void setMaterialCode(String materialCode) {
        this.materialCode = materialCode;
    }

    public BigDecimal getQtyPerUnit() {
        return qtyPerUnit;
    }

    public void setQtyPerUnit(BigDecimal qtyPerUnit) {
        this.qtyPerUnit = qtyPerUnit;
    }

    public UUID getModelId() {
        return modelId;
    }

    public void setModelId(UUID modelId) {
        this.modelId = modelId;
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

    @Override
    public String toString() {
        return "ModelBomCsvRow{" +
                "modelCode='" + modelCode + '\'' +
                ", modelName='" + modelName + '\'' +
                ", materialCode='" + materialCode + '\'' +
                ", qtyPerUnit=" + qtyPerUnit +
                ", modelId=" + modelId +
                ", tenantId=" + tenantId +
                ", companyId=" + companyId +
                '}';
    }
}