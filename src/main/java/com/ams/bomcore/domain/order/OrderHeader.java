package com.ams.bomcore.domain.order;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

/**
 * JPA entity for table {@code order_header}.
 * Represents a sales, production, transfer or internal order.
 * Status lifecycle: DRAFT → CONFIRMED → IN_PRODUCTION → PARTIALLY_COMPLETED → COMPLETED → CANCELLED
 */
@Entity
@Table(name = "order_header")
public class OrderHeader {

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_CONFIRMED = "CONFIRMED";
    public static final String STATUS_IN_PRODUCTION = "IN_PRODUCTION";
    public static final String STATUS_PARTIALLY_COMPLETED = "PARTIALLY_COMPLETED";
    public static final String STATUS_COMPLETED = "COMPLETED";
    public static final String STATUS_DELIVERED = "DELIVERED";
    public static final String STATUS_CANCELLED = "CANCELLED";
    public static final String STATUS_CANCEL_PENDING = "CANCEL_PENDING";
    public static final String STATUS_MATERIAL_READY = "MATERIAL_READY";

    public static final String TYPE_SALES = "SALES";
    public static final String TYPE_PRODUCTION = "PRODUCTION";
    public static final String TYPE_TRANSFER = "TRANSFER";
    public static final String TYPE_INTERNAL = "INTERNAL";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "order_number", nullable = false, length = 50)
    private String orderNumber;

    @Column(name = "order_type", nullable = false, length = 20)
    private String orderType;

    @Column(name = "status", nullable = false, length = 30)
    private String status = STATUS_DRAFT;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "production_batch_id")
    private UUID productionBatchId;

    @Column(name = "planned_start_date")
    private LocalDate plannedStartDate;

    @Column(name = "planned_end_date")
    private LocalDate plannedEndDate;

    @Column(name = "actual_start_date")
    private Instant actualStartDate;

    @Column(name = "actual_end_date")
    private Instant actualEndDate;

    @Column(name = "delivery_date_time")
    private Instant deliveryDateTime;

    @Column(name = "total_planned_qty", columnDefinition = "numeric")
    private BigDecimal totalPlannedQty;

    @Column(name = "total_actual_qty", columnDefinition = "numeric")
    private BigDecimal totalActualQty;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "created_by", length = 100)
    private String createdBy;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "updated_by", length = 100)
    private String updatedBy;

    @Column(name = "destination_warehouse_id")
    private UUID destinationWarehouseId;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    @OrderBy("lineNumber ASC")
    private List<OrderLine> lines = new ArrayList<>();

    public OrderHeader() {
    }

    @PrePersist
    private void prePersist() {
        if (id == null) {
			id = UUID.randomUUID();
		}
        if (createdAt == null) {
			createdAt = Instant.now();
		}
        updatedAt = Instant.now();
        if (status == null) {
			status = STATUS_DRAFT;
		}
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    // ── Getters & Setters ─────────────────────────────────────────────

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getOrderNumber() { return orderNumber; }
    public void setOrderNumber(String orderNumber) { this.orderNumber = orderNumber; }

    public String getOrderType() { return orderType; }
    public void setOrderType(String orderType) { this.orderType = orderType; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }

    public UUID getProductionBatchId() { return productionBatchId; }
    public void setProductionBatchId(UUID productionBatchId) { this.productionBatchId = productionBatchId; }

    public LocalDate getPlannedStartDate() { return plannedStartDate; }
    public void setPlannedStartDate(LocalDate plannedStartDate) { this.plannedStartDate = plannedStartDate; }

    public LocalDate getPlannedEndDate() { return plannedEndDate; }
    public void setPlannedEndDate(LocalDate plannedEndDate) { this.plannedEndDate = plannedEndDate; }

    public Instant getActualStartDate() { return actualStartDate; }
    public void setActualStartDate(Instant actualStartDate) { this.actualStartDate = actualStartDate; }

    public Instant getActualEndDate() { return actualEndDate; }
    public void setActualEndDate(Instant actualEndDate) { this.actualEndDate = actualEndDate; }

    public Instant getDeliveryDateTime() { return deliveryDateTime; }
    public void setDeliveryDateTime(Instant deliveryDateTime) { this.deliveryDateTime = deliveryDateTime; }

    public BigDecimal getTotalPlannedQty() { return totalPlannedQty; }
    public void setTotalPlannedQty(BigDecimal totalPlannedQty) { this.totalPlannedQty = totalPlannedQty; }

    public BigDecimal getTotalActualQty() { return totalActualQty; }
    public void setTotalActualQty(BigDecimal totalActualQty) { this.totalActualQty = totalActualQty; }

    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }

    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }

    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }

    public String getCreatedBy() { return createdBy; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }

    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }

    public String getUpdatedBy() { return updatedBy; }
    public void setUpdatedBy(String updatedBy) { this.updatedBy = updatedBy; }

    public UUID getDestinationWarehouseId() { return destinationWarehouseId; }
    public void setDestinationWarehouseId(UUID destinationWarehouseId) { this.destinationWarehouseId = destinationWarehouseId; }

    public List<OrderLine> getLines() { return lines; }
    public void setLines(List<OrderLine> lines) { this.lines = lines; }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
			return true;
		}
        if (o == null || getClass() != o.getClass()) {
			return false;
		}
        OrderHeader that = (OrderHeader) o;
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() { return Objects.hash(id); }

    @Override
    public String toString() {
        return "OrderHeader{id=" + id + ", orderNumber='" + orderNumber + "', status='" + status + "'}";
    }
}
