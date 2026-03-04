package com.ams.bomcore.controller.order.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;

/**
 * DTO for updating an order header (fields + optionally replace lines).
 * Only DRAFT orders can be fully updated.
 */
public class OrderUpdateDto {

    @NotBlank(message = "orderType is required")
    private String orderType;

    private UUID customerId;
    private LocalDate plannedStartDate;
    private LocalDate plannedEndDate;
    private String notes;
    private String updatedBy;

    /** If non-null and non-empty, replaces all existing lines (only allowed in DRAFT status) */
    @Valid
    private List<OrderCreateDto.OrderLineCreateDto> lines = new ArrayList<>();

    // ── Getters & Setters ─────────────────────────────────────────────

    public String getOrderType() { return orderType; }
    public void setOrderType(String orderType) { this.orderType = orderType; }

    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }

    public LocalDate getPlannedStartDate() { return plannedStartDate; }
    public void setPlannedStartDate(LocalDate plannedStartDate) { this.plannedStartDate = plannedStartDate; }

    public LocalDate getPlannedEndDate() { return plannedEndDate; }
    public void setPlannedEndDate(LocalDate plannedEndDate) { this.plannedEndDate = plannedEndDate; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public List<OrderCreateDto.OrderLineCreateDto> getLines() { return lines; }
    public void setLines(List<OrderCreateDto.OrderLineCreateDto> lines) { this.lines = lines; }
}
