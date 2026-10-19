package com.ams.bomcore.domain.shop;

import jakarta.persistence.*;
import java.util.UUID;

@Entity
@Table(name = "vin_hoadon_shop_invoice_order",
        uniqueConstraints = @UniqueConstraint(name = "uq_vin_hoadon_invoiced_order", columnNames = "order_id"))
public class VinHoadonShopInvoiceOrder {
    @Id private UUID id;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "invoice_id") private VinHoadonShopInvoice invoice;
    @ManyToOne(fetch = FetchType.LAZY, optional = false) @JoinColumn(name = "order_id") private ShopOrder order;
    @Column(name = "tenant_id", nullable = false) private UUID tenantId;
    @Column(name = "company_id", nullable = false) private UUID companyId;
    @PrePersist void create() { if (id == null) id = UUID.randomUUID(); }
    public UUID getId() { return id; }
    public VinHoadonShopInvoice getInvoice() { return invoice; } public void setInvoice(VinHoadonShopInvoice v) { invoice = v; }
    public ShopOrder getOrder() { return order; } public void setOrder(ShopOrder v) { order = v; }
    public UUID getTenantId() { return tenantId; } public void setTenantId(UUID v) { tenantId = v; }
    public UUID getCompanyId() { return companyId; } public void setCompanyId(UUID v) { companyId = v; }
}
