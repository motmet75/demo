package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "shop_voucher")
public class ShopVoucher {

    public static final String STATUS_ACTIVE    = "ACTIVE";
    public static final String STATUS_USED      = "USED";
    public static final String STATUS_EXPIRED   = "EXPIRED";
    public static final String STATUS_CANCELLED = "CANCELLED";

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @Column(name = "tenant_id", nullable = false)
    private UUID tenantId;

    @Column(name = "company_id", nullable = false)
    private UUID companyId;

    @Column(name = "code", nullable = false, length = 20)
    private String code;

    @Column(name = "face_value", nullable = false, columnDefinition = "numeric")
    private BigDecimal faceValue;

    @Column(name = "sale_price", columnDefinition = "numeric")
    private BigDecimal salePrice;

    @Column(name = "status", nullable = false, length = 20)
    private String status = STATUS_ACTIVE;

    @Column(name = "customer_id")
    private UUID customerId;

    @Column(name = "issued_order_id")
    private UUID issuedOrderId;

    @Column(name = "redeemed_order_id")
    private UUID redeemedOrderId;

    @Column(name = "redeemed_bill_id")
    private UUID redeemedBillId;

    @Column(name = "redeemed_customer_id")
    private UUID redeemedCustomerId;

    @Column(name = "redeemed_customer_name", length = 150)
    private String redeemedCustomerName;

    @Column(name = "redeemed_at")
    private Instant redeemedAt;

    @Column(name = "expiry_date")
    private LocalDate expiryDate;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (status == null) status = STATUS_ACTIVE;
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getTenantId() { return tenantId; }
    public void setTenantId(UUID tenantId) { this.tenantId = tenantId; }
    public UUID getCompanyId() { return companyId; }
    public void setCompanyId(UUID companyId) { this.companyId = companyId; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public BigDecimal getFaceValue() { return faceValue; }
    public void setFaceValue(BigDecimal faceValue) { this.faceValue = faceValue; }
    public BigDecimal getSalePrice() { return salePrice; }
    public void setSalePrice(BigDecimal salePrice) { this.salePrice = salePrice; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UUID getCustomerId() { return customerId; }
    public void setCustomerId(UUID customerId) { this.customerId = customerId; }
    public UUID getIssuedOrderId() { return issuedOrderId; }
    public void setIssuedOrderId(UUID issuedOrderId) { this.issuedOrderId = issuedOrderId; }
    public UUID getRedeemedOrderId() { return redeemedOrderId; }
    public void setRedeemedOrderId(UUID redeemedOrderId) { this.redeemedOrderId = redeemedOrderId; }
    public UUID getRedeemedBillId() { return redeemedBillId; }
    public void setRedeemedBillId(UUID redeemedBillId) { this.redeemedBillId = redeemedBillId; }
    public UUID getRedeemedCustomerId() { return redeemedCustomerId; }
    public void setRedeemedCustomerId(UUID redeemedCustomerId) { this.redeemedCustomerId = redeemedCustomerId; }
    public String getRedeemedCustomerName() { return redeemedCustomerName; }
    public void setRedeemedCustomerName(String redeemedCustomerName) { this.redeemedCustomerName = redeemedCustomerName; }
    public Instant getRedeemedAt() { return redeemedAt; }
    public void setRedeemedAt(Instant redeemedAt) { this.redeemedAt = redeemedAt; }
    public LocalDate getExpiryDate() { return expiryDate; }
    public void setExpiryDate(LocalDate expiryDate) { this.expiryDate = expiryDate; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
