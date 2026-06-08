package com.ams.bomcore.controller.shop.dto;

import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopOrderItem;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class ShopOrderResponseDto {

    private UUID id;
    private String orderCode;
    private Integer orderNumber;
    private UUID tenantId;
    private UUID companyId;
    private String tableId;
    private String tableName;
    private String fulfillmentType;
    private String status;
    private String customerName;
    private String customerPhone;
    private String deliveryProvider;
    private String deliveryAddress;
    private BigDecimal deliveryFee;
    private BigDecimal totalRawCost;
    private BigDecimal totalAmount;
    private String paymentMethod;
    private String paymentStatus;
    private String paymentQr;
    private String notes;
    private Instant createdAt;
    private Instant confirmedAt;
    private Instant readyAt;
    private Instant completedAt;
    private List<ItemDto> items;

    public static class ItemDto {
        private UUID id;
        private UUID modelId;
        private String modelName;
        private BigDecimal quantity;
        private BigDecimal unitPrice;
        private BigDecimal unitRawCost;
        private BigDecimal lineTotal;
        private String selectedOptions;
        private String itemNotes;

        public static ItemDto from(ShopOrderItem item) {
            ItemDto dto = new ItemDto();
            dto.id = item.getId();
            dto.modelId = item.getModel() != null ? item.getModel().getId() : null;
            dto.modelName = item.getModelName();
            dto.quantity = item.getQuantity();
            dto.unitPrice = item.getUnitPrice();
            dto.unitRawCost = item.getUnitRawCost();
            dto.lineTotal = item.getLineTotal();
            dto.selectedOptions = item.getSelectedOptions();
            dto.itemNotes = item.getItemNotes();
            return dto;
        }

        public UUID getId() { return id; }
        public UUID getModelId() { return modelId; }
        public String getModelName() { return modelName; }
        public BigDecimal getQuantity() { return quantity; }
        public BigDecimal getUnitPrice() { return unitPrice; }
        public BigDecimal getUnitRawCost() { return unitRawCost; }
        public BigDecimal getLineTotal() { return lineTotal; }
        public String getSelectedOptions() { return selectedOptions; }
        public String getItemNotes() { return itemNotes; }
    }

    public static ShopOrderResponseDto from(ShopOrder order, List<ShopOrderItem> items) {
        ShopOrderResponseDto dto = new ShopOrderResponseDto();
        dto.id = order.getId();
        dto.orderCode = order.getOrderCode();
        dto.orderNumber = order.getOrderNumber();
        dto.tenantId = order.getTenantId();
        dto.companyId = order.getCompanyId();
        if (order.getTable() != null) {
            dto.tableId = order.getTable().getId().toString();
            dto.tableName = order.getTable().getTableName();
        }
        dto.fulfillmentType = order.getFulfillmentType();
        dto.status = order.getStatus();
        dto.customerName = order.getCustomerName();
        dto.customerPhone = order.getCustomerPhone();
        dto.deliveryProvider = order.getDeliveryProvider();
        dto.deliveryAddress = order.getDeliveryAddress();
        dto.deliveryFee = order.getDeliveryFee();
        dto.totalRawCost = order.getTotalRawCost();
        dto.totalAmount = order.getTotalAmount();
        dto.paymentMethod = order.getPaymentMethod();
        dto.paymentStatus = order.getPaymentStatus();
        dto.paymentQr = order.getPaymentQr();
        dto.notes = order.getNotes();
        dto.createdAt = order.getCreatedAt();
        dto.confirmedAt = order.getConfirmedAt();
        dto.readyAt = order.getReadyAt();
        dto.completedAt = order.getCompletedAt();
        dto.items = items.stream().map(ItemDto::from).toList();
        return dto;
    }

    public UUID getId() { return id; }
    public String getOrderCode() { return orderCode; }
    public Integer getOrderNumber() { return orderNumber; }
    public UUID getTenantId() { return tenantId; }
    public UUID getCompanyId() { return companyId; }
    public String getTableId() { return tableId; }
    public String getTableName() { return tableName; }
    public String getFulfillmentType() { return fulfillmentType; }
    public String getStatus() { return status; }
    public String getCustomerName() { return customerName; }
    public String getCustomerPhone() { return customerPhone; }
    public String getDeliveryProvider() { return deliveryProvider; }
    public String getDeliveryAddress() { return deliveryAddress; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public BigDecimal getTotalRawCost() { return totalRawCost; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getPaymentStatus() { return paymentStatus; }
    public String getPaymentQr() { return paymentQr; }
    public String getNotes() { return notes; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public Instant getReadyAt() { return readyAt; }
    public Instant getCompletedAt() { return completedAt; }
    public List<ItemDto> getItems() { return items; }
}
