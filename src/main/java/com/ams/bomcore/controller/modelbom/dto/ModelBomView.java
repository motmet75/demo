package com.ams.bomcore.controller.modelbom.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * DTO returned to frontend when listing BOM rows for a model. Contains material code/name and ids.
 */
public class ModelBomView {
    private UUID id;
    private UUID materialId;
    private String materialCode;
    private String materialName;
    private BigDecimal qtyPerUnit;

    public ModelBomView() { }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }

    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }

    public String getMaterialName() { return materialName; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }

    public BigDecimal getQtyPerUnit() { return qtyPerUnit; }
    public void setQtyPerUnit(BigDecimal qtyPerUnit) { this.qtyPerUnit = qtyPerUnit; }
}
