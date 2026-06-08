package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shop_order")
public class ShopOrder {

    public static final String STATUS_PENDING    = "PENDING";
    public static final String STATUS_CONFIRMED  = "CONFIRMED";
    public static final String STATUS_PREPARING  = "PREPARING";
    public static final String STATUS_READY      = "READY";
    public static final String STATUS_PICKED_UP  = "PICKED_UP";
    public static final String STATUS_COMPLETED  = "COMPLETED";
    public static final String STATUS_CANCELLED  = "CANCELLED";

    public static final String FULFILLMENT_DINE_IN  = "DINE_IN";
    public static final String FULFILLMENT_PICKUP   = "PICKUP";
    public static final String FULFILLMENT_DELIVERY = "DELIVERY";

    public static final String PAYMENT_CASH     = "CASH";
    public static final String PAYMENT_BANK_QR  = "BANK_QR";

    public static final String PAY_STATUS_UNPAID = "UNPAID";
    public static final String PAY_STATUS_PAID   = "PAID";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "order_code", nullable = false, length = 50)
    private String orderCode;

    @Column(name = "order_number")
    private Integer orderNumber;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "table_id")
    private ShopTable table;

    @Column(name = "fulfillment_type", length = 20)
    private String fulfillmentType;

    @Column(name = "status", length = 20)
    private String status;

    @Column(name = "customer_name", length = 100)
    private String customerName;

    @Column(name = "customer_phone", length = 30)
    private String customerPhone;

    @Column(name = "delivery_provider", length = 30)
    private String deliveryProvider;

    @Column(name = "delivery_address", columnDefinition = "TEXT")
    private String deliveryAddress;

    @Column(name = "delivery_fee", columnDefinition = "numeric")
    private BigDecimal deliveryFee;

    @Column(name = "total_raw_cost", columnDefinition = "numeric")
    private BigDecimal totalRawCost;

    @Column(name = "total_amount", columnDefinition = "numeric")
    private BigDecimal totalAmount;

    @Column(name = "payment_method", length = 20)
    private String paymentMethod;

    @Column(name = "payment_status", length = 20)
    private String paymentStatus;

    @Column(name = "payment_qr", columnDefinition = "TEXT")
    private String paymentQr;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "source_token", length = 100)
    private String sourceToken;

    @Column(name = "created_at")
    private Instant createdAt;

    @Column(name = "confirmed_at")
    private Instant confirmedAt;

    @Column(name = "ready_at")
    private Instant readyAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    public ShopOrder() {}

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = STATUS_PENDING;
        if (paymentStatus == null) paymentStatus = PAY_STATUS_UNPAID;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public String getOrderCode() { return orderCode; }
    public void setOrderCode(String orderCode) { this.orderCode = orderCode; }
    public Integer getOrderNumber() { return orderNumber; }
    public void setOrderNumber(Integer orderNumber) { this.orderNumber = orderNumber; }
    public ShopTable getTable() { return table; }
    public void setTable(ShopTable table) { this.table = table; }
    public String getFulfillmentType() { return fulfillmentType; }
    public void setFulfillmentType(String fulfillmentType) { this.fulfillmentType = fulfillmentType; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
    public String getDeliveryProvider() { return deliveryProvider; }
    public void setDeliveryProvider(String deliveryProvider) { this.deliveryProvider = deliveryProvider; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(BigDecimal deliveryFee) { this.deliveryFee = deliveryFee; }
    public BigDecimal getTotalRawCost() { return totalRawCost; }
    public void setTotalRawCost(BigDecimal totalRawCost) { this.totalRawCost = totalRawCost; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public String getPaymentMethod() { return paymentMethod; }
    public void setPaymentMethod(String paymentMethod) { this.paymentMethod = paymentMethod; }
    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }
    public String getPaymentQr() { return paymentQr; }
    public void setPaymentQr(String paymentQr) { this.paymentQr = paymentQr; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public void setConfirmedAt(Instant confirmedAt) { this.confirmedAt = confirmedAt; }
    public Instant getReadyAt() { return readyAt; }
    public void setReadyAt(Instant readyAt) { this.readyAt = readyAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public String getSourceToken() { return sourceToken; }
    public void setSourceToken(String sourceToken) { this.sourceToken = sourceToken; }
}
