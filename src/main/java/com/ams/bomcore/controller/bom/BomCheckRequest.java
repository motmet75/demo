package com.ams.bomcore.controller.bom;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class BomCheckRequest {

    @NotBlank
    private String modelCode;

    @NotNull
    @DecimalMin(value = "0.0001")
    private BigDecimal quantity;

    // optional tenant id; if omitted, service should resolve tenant from context
    private String tenantId;

    public String getModelCode() {
        return modelCode;
    }

    public void setModelCode(String modelCode) {
        this.modelCode = modelCode;
    }

    public BigDecimal getQuantity() {
        return quantity;
    }

    public void setQuantity(BigDecimal quantity) {
        this.quantity = quantity;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }
}