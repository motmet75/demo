package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "shop_bill_item")
public class ShopBillItem {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bill_id", nullable = false)
    private ShopBill bill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "original_bill_id", nullable = false)
    private ShopBill originalBill;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_item_id", nullable = false)
    private ShopOrderItem orderItem;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at")
    private Instant updatedAt;

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
        if (createdAt == null) createdAt = Instant.now();
        if (updatedAt == null) updatedAt = createdAt;
    }

    @PreUpdate
    private void preUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public ShopBill getBill() { return bill; }
    public void setBill(ShopBill bill) { this.bill = bill; }
    public ShopBill getOriginalBill() { return originalBill; }
    public void setOriginalBill(ShopBill originalBill) { this.originalBill = originalBill; }
    public ShopOrderItem getOrderItem() { return orderItem; }
    public void setOrderItem(ShopOrderItem orderItem) { this.orderItem = orderItem; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(Instant updatedAt) { this.updatedAt = updatedAt; }
}