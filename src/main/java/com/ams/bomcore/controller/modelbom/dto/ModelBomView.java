package com.ams.bomcore.controller.modelbom.dto;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * DTO returned to frontend when listing BOM rows for a model. Contains material code/name and ids.
 * Also includes model-level fields (hsCode, coCriteria) for display in the model view popup.
 */
public class ModelBomView {
    private UUID id;
    private UUID modelId;
    private String modelCode;
    private String modelName;
    private String hsCode;
    private String coCriteria;
    private UUID materialId;
    private String materialCode;
    private String materialName;
    private BigDecimal qtyPerUnit;
    private BigDecimal warehouseQty;
    private String warehouseUnit;
    private BigDecimal bomUnitPerWarehouseUnit;
    public ModelBomView() { }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public UUID getModelId() { return modelId; }
    public void setModelId(UUID modelId) { this.modelId = modelId; }

    public String getModelCode() { return modelCode; }
    public void setModelCode(String modelCode) { this.modelCode = modelCode; }

    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }

    public String getHsCode() { return hsCode; }
    public void setHsCode(String hsCode) { this.hsCode = hsCode; }

    public String getCoCriteria() { return coCriteria; }
    public void setCoCriteria(String coCriteria) { this.coCriteria = coCriteria; }

    public UUID getMaterialId() { return materialId; }
    public void setMaterialId(UUID materialId) { this.materialId = materialId; }

    public String getMaterialCode() { return materialCode; }
    public void setMaterialCode(String materialCode) { this.materialCode = materialCode; }

    public String getMaterialName() { return materialName; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }

    public BigDecimal getQtyPerUnit() { return qtyPerUnit; }
    public void setQtyPerUnit(BigDecimal qtyPerUnit) { this.qtyPerUnit = qtyPerUnit; }

    public BigDecimal getWarehouseQty() { return warehouseQty; }
    public void setWarehouseQty(BigDecimal warehouseQty) { this.warehouseQty = warehouseQty; }

    public String getWarehouseUnit() { return warehouseUnit; }
    public void setWarehouseUnit(String warehouseUnit) { this.warehouseUnit = warehouseUnit; }

    public BigDecimal getBomUnitPerWarehouseUnit() { return bomUnitPerWarehouseUnit; }
    public void setBomUnitPerWarehouseUnit(BigDecimal bomUnitPerWarehouseUnit) { this.bomUnitPerWarehouseUnit = bomUnitPerWarehouseUnit; }}
