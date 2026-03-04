package com.ams.bomcore.controller.order.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * DTO for the FINISH order endpoint.
 * Caller may optionally provide real consumption quantities per material.
 * If a material entry is omitted, the service defaults to effective_planned_qty.
 */
public class OrderFinishDto {

    /** Optional: real consumption overrides per material */
    private List<RealConsumptionEntry> realConsumptions = new ArrayList<>();

    private String updatedBy;

    public List<RealConsumptionEntry> getRealConsumptions() { return realConsumptions; }
    public void setRealConsumptions(List<RealConsumptionEntry> realConsumptions) {
        this.realConsumptions = realConsumptions;
    }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    // ── Nested DTO ────────────────────────────────────────────────────

    public static class RealConsumptionEntry {

        /** The order_consumption_log id OR material_id — service will look up by materialId per order */
        private UUID materialId;

        /** Real qty actually consumed. If null, defaults to effective_planned_qty */
        private BigDecimal realQty;

        public UUID getMaterialId() { return materialId; }
        public void setMaterialId(UUID materialId) { this.materialId = materialId; }

        public BigDecimal getRealQty() { return realQty; }
        public void setRealQty(BigDecimal realQty) { this.realQty = realQty; }
    }
}
