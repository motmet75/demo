package com.ams.bomcore.controller.shop.dto;

import com.ams.bomcore.domain.shop.ShopBill;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopOrderItem;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Collections;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public class ShopOrderResponseDto {

    private UUID id;
    private String orderCode;
    private Integer orderNumber;
    private Integer dailySeq;
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
    private String customerTableTag;
    private Instant requestedFulfillmentAt;
    private BigDecimal deliveryFee;
    private BigDecimal totalRawCost;
    private BigDecimal totalAmount;
    private String paymentMethod;
    private String paymentStatus;
    private Instant paymentRequestedAt;
    private String paymentQr;
    private BigDecimal splitCashAmount;
    private BigDecimal discountAmount;
    private String voucherCode;
    private UUID customerId;
    private String notes;
    private String staffName;
    private String sourceToken;
    private String cancelReason;
    private Boolean customerCancelled;
    private String customerCancelNote;
    private Boolean customerEditing;
    private Instant customerEditingSince;
    private Instant pickupScannedAt;
    private Boolean auditMaterialLater;
    private String materialAuditStatus;
    private String materialAuditNote;
    private Instant inventoryCheckedAt;
    private Instant materialDeductedAt;
    private Instant createdAt;
    private Instant confirmedAt;
    private Instant readyAt;
    private Instant completedAt;
    private List<ItemDto> items;
    private List<BillDto> bills = Collections.emptyList();

    private static BigDecimal nz(BigDecimal value) {
        return value != null ? value : BigDecimal.ZERO;
    }

    private static BigDecimal nonNegative(BigDecimal value) {
        BigDecimal safe = nz(value);
        return safe.compareTo(BigDecimal.ZERO) > 0 ? safe : BigDecimal.ZERO;
    }

    public static class ItemDto {
        private UUID id;
        private UUID modelId;
        private String modelName;
        private String imageUrl;
        private BigDecimal quantity;
        private BigDecimal unitPrice;
        private BigDecimal unitRawCost;
        private BigDecimal lineTotal;
        private String selectedOptions;
        private BigDecimal optionAddOn;
        private String itemNotes;
        private UUID parentItemId;
        private UUID billId;
        private Integer billNumber;
        private UUID sourceOrderId;
        private Integer sourceOrderNumber;
        private String sourceOrderCode;

        public static ItemDto from(ShopOrderItem item) {
            ItemDto dto = new ItemDto();
            dto.id = item.getId();
            dto.modelId = item.getModel() != null ? item.getModel().getId() : null;
            dto.modelName = item.getModelName();
            dto.imageUrl = item.getModel() != null ? item.getModel().getImageUrl() : null;
            dto.quantity = item.getQuantity();
            dto.unitPrice = item.getUnitPrice();
            dto.unitRawCost = item.getUnitRawCost();
            dto.lineTotal = item.getLineTotal();
            dto.selectedOptions = item.getSelectedOptions();
            dto.optionAddOn = item.getOptionAddOn();
            dto.itemNotes = item.getItemNotes();
            dto.parentItemId = item.getParentItem() != null ? item.getParentItem().getId() : null;
            if (item.getOrder() != null) {
                dto.sourceOrderId = item.getOrder().getId();
                dto.sourceOrderNumber = item.getOrder().getOrderNumber();
                dto.sourceOrderCode = item.getOrder().getOrderCode();
            }
            return dto;
        }

        public UUID getId() { return id; }
        public UUID getModelId() { return modelId; }
        public String getModelName() { return modelName; }
        public String getImageUrl() { return imageUrl; }
        public BigDecimal getQuantity() { return quantity; }
        public BigDecimal getUnitPrice() { return unitPrice; }
        public BigDecimal getUnitRawCost() { return unitRawCost; }
        public BigDecimal getLineTotal() { return lineTotal; }
        public String getSelectedOptions() { return selectedOptions; }
        public BigDecimal getOptionAddOn() { return optionAddOn; }
        public String getItemNotes() { return itemNotes; }
        public UUID getParentItemId() { return parentItemId; }
        public UUID getBillId() { return billId; }
        public Integer getBillNumber() { return billNumber; }
        public UUID getSourceOrderId() { return sourceOrderId; }
        public Integer getSourceOrderNumber() { return sourceOrderNumber; }
        public String getSourceOrderCode() { return sourceOrderCode; }
    }

    public static class OrderLinkDto {
        private UUID orderId;
        private Integer orderNumber;
        private String orderCode;
        private int itemCount;
        private BigDecimal totalAmount = BigDecimal.ZERO;

        private static List<OrderLinkDto> fromItems(List<ShopOrderItem> items) {
            if (items == null || items.isEmpty()) return Collections.emptyList();
            Map<UUID, OrderLinkDto> byOrder = new LinkedHashMap<>();
            for (ShopOrderItem item : items) {
                if (item == null || item.getOrder() == null || item.getOrder().getId() == null) continue;
                UUID orderId = item.getOrder().getId();
                OrderLinkDto link = byOrder.computeIfAbsent(orderId, ignored -> {
                    OrderLinkDto dto = new OrderLinkDto();
                    dto.orderId = orderId;
                    dto.orderNumber = item.getOrder().getOrderNumber();
                    dto.orderCode = item.getOrder().getOrderCode();
                    return dto;
                });
                if (item.getParentItem() == null) link.itemCount++;
                link.totalAmount = link.totalAmount.add(nz(item.getLineTotal()));
            }
            return List.copyOf(byOrder.values());
        }

        public UUID getOrderId() { return orderId; }
        public Integer getOrderNumber() { return orderNumber; }
        public String getOrderCode() { return orderCode; }
        public int getItemCount() { return itemCount; }
        public BigDecimal getTotalAmount() { return totalAmount; }
    }

    public static class BillDto {
        private UUID id;
        private Integer billNumber;
        private String status;
        private UUID orderId;
        private Integer orderNumber;
        private String orderCode;
        private UUID splitFromBillId;
        private UUID mergedIntoBillId;
        private UUID mergeBatchId;
        private BigDecimal totalAmount;
        private BigDecimal totalRawCost;
        private BigDecimal discountAmount;
        private String voucherCode;
        private BigDecimal netAmount;
        private BigDecimal incomeAmount;
        private Instant createdAt;
        private Instant mergedAt;
        private List<UUID> itemIds;
        private List<OrderLinkDto> linkedOrders;

        public static BillDto from(ShopBill bill, List<ShopOrderItem> items) {
            BillDto dto = new BillDto();
            dto.id = bill.getId();
            dto.billNumber = bill.getBillNumber();
            dto.status = bill.getStatus();
            if (bill.getOrder() != null) {
                dto.orderId = bill.getOrder().getId();
                dto.orderNumber = bill.getOrder().getOrderNumber();
                dto.orderCode = bill.getOrder().getOrderCode();
            }
            dto.splitFromBillId = bill.getSplitFromBill() != null ? bill.getSplitFromBill().getId() : null;
            dto.mergedIntoBillId = bill.getMergedIntoBill() != null ? bill.getMergedIntoBill().getId() : null;
            dto.mergeBatchId = bill.getMergeBatchId();
            dto.totalAmount = bill.getTotalAmount();
            dto.totalRawCost = bill.getTotalRawCost();
            dto.discountAmount = nz(bill.getDiscountAmount());
            dto.voucherCode = bill.getVoucherCode();
            dto.netAmount = nonNegative(nz(dto.totalAmount).subtract(dto.discountAmount));
            dto.incomeAmount = dto.netAmount.subtract(nz(dto.totalRawCost));
            dto.createdAt = bill.getCreatedAt();
            dto.mergedAt = bill.getMergedAt();
            dto.itemIds = items == null ? Collections.emptyList() : items.stream().map(ShopOrderItem::getId).toList();
            dto.linkedOrders = OrderLinkDto.fromItems(items);
            return dto;
        }

        public UUID getId() { return id; }
        public Integer getBillNumber() { return billNumber; }
        public String getStatus() { return status; }
        public UUID getOrderId() { return orderId; }
        public Integer getOrderNumber() { return orderNumber; }
        public String getOrderCode() { return orderCode; }
        public UUID getSplitFromBillId() { return splitFromBillId; }
        public UUID getMergedIntoBillId() { return mergedIntoBillId; }
        public UUID getMergeBatchId() { return mergeBatchId; }
        public BigDecimal getTotalAmount() { return totalAmount; }
        public BigDecimal getTotalRawCost() { return totalRawCost; }
        public BigDecimal getDiscountAmount() { return discountAmount; }
        public String getVoucherCode() { return voucherCode; }
        public BigDecimal getNetAmount() { return netAmount; }
        public BigDecimal getIncomeAmount() { return incomeAmount; }
        public Instant getCreatedAt() { return createdAt; }
        public Instant getMergedAt() { return mergedAt; }
        public List<UUID> getItemIds() { return itemIds; }
        public List<OrderLinkDto> getLinkedOrders() { return linkedOrders; }
    }
    public static ShopOrderResponseDto from(ShopOrder order, List<ShopOrderItem> items) {
        ShopOrderResponseDto dto = new ShopOrderResponseDto();
        dto.id = order.getId();
        dto.orderCode = order.getOrderCode();
        dto.orderNumber = order.getOrderNumber();
        dto.dailySeq = order.getDailySeq();
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
        dto.customerTableTag = order.getCustomerTableTag();
        dto.requestedFulfillmentAt = order.getRequestedFulfillmentAt();
        dto.deliveryFee = order.getDeliveryFee();
        dto.totalRawCost = order.getTotalRawCost();
        dto.totalAmount = order.getTotalAmount();
        dto.paymentMethod = order.getPaymentMethod();
        dto.paymentStatus = order.getPaymentStatus();
        dto.paymentRequestedAt = order.getPaymentRequestedAt();
        dto.paymentQr = order.getPaymentQr();
        dto.splitCashAmount = order.getSplitCashAmount();
        dto.discountAmount = order.getDiscountAmount();
        dto.voucherCode = order.getVoucherCode();
        dto.customerId = order.getCustomerId();
        dto.notes = order.getNotes();
        dto.staffName = order.getStaffName();
        dto.sourceToken = order.getSourceToken();
        dto.cancelReason = order.getCancelReason();
        dto.customerCancelled = Boolean.TRUE.equals(order.getCustomerCancelled());
        dto.customerCancelNote = order.getCustomerCancelNote();
        dto.customerEditing = Boolean.TRUE.equals(order.getCustomerEditing());
        dto.customerEditingSince = order.getCustomerEditingSince();
        dto.pickupScannedAt = order.getPickupScannedAt();
        dto.auditMaterialLater = order.getAuditMaterialLater();
        dto.materialAuditStatus = order.getMaterialAuditStatus();
        dto.materialAuditNote = order.getMaterialAuditNote();
        dto.inventoryCheckedAt = order.getInventoryCheckedAt();
        dto.materialDeductedAt = order.getMaterialDeductedAt();
        dto.createdAt = order.getCreatedAt();
        dto.confirmedAt = order.getConfirmedAt();
        dto.readyAt = order.getReadyAt();
        dto.completedAt = order.getCompletedAt();
        dto.items = items.stream().map(ItemDto::from).toList();
        return dto;
    }

    public static ShopOrderResponseDto from(ShopOrder order, List<ShopOrderItem> items,
                                            List<ShopBill> bills,
                                            Map<UUID, ShopBill> itemBillMap,
                                            Map<UUID, List<ShopOrderItem>> billItemsMap) {
        ShopOrderResponseDto dto = from(order, items);
        if (itemBillMap != null) {
            dto.items.forEach(item -> {
                ShopBill bill = itemBillMap.get(item.getId());
                if (bill != null) {
                    item.billId = bill.getId();
                    item.billNumber = bill.getBillNumber();
                }
            });
        }
        dto.bills = bills == null ? Collections.emptyList() : bills.stream()
            .map(b -> BillDto.from(b, billItemsMap != null ? billItemsMap.getOrDefault(b.getId(), Collections.emptyList()) : Collections.emptyList()))
            .toList();
        return dto;
    }

    public UUID getId() { return id; }
    public String getOrderCode() { return orderCode; }
    public Integer getOrderNumber() { return orderNumber; }
    public Integer getDailySeq() { return dailySeq; }
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
    public String getCustomerTableTag() { return customerTableTag; }
    public Instant getRequestedFulfillmentAt() { return requestedFulfillmentAt; }
    public BigDecimal getDeliveryFee() { return deliveryFee; }
    public BigDecimal getTotalRawCost() { return totalRawCost; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getPaymentStatus() { return paymentStatus; }
    public Instant getPaymentRequestedAt() { return paymentRequestedAt; }
    public String getPaymentQr() { return paymentQr; }
    public BigDecimal getSplitCashAmount() { return splitCashAmount; }
    public BigDecimal getDiscountAmount() { return discountAmount; }
    public String getVoucherCode() { return voucherCode; }
    public UUID getCustomerId() { return customerId; }
    public String getNotes() { return notes; }
    public String getStaffName() { return staffName; }
    public String getSourceToken() { return sourceToken; }
    public String getCancelReason() { return cancelReason; }
    public Boolean getCustomerCancelled() { return customerCancelled; }
    public String getCustomerCancelNote() { return customerCancelNote; }
    public Boolean getCustomerEditing() { return customerEditing; }
    public Instant getCustomerEditingSince() { return customerEditingSince; }
    public Instant getPickupScannedAt() { return pickupScannedAt; }
    public Boolean getAuditMaterialLater() { return auditMaterialLater; }
    public String getMaterialAuditStatus() { return materialAuditStatus; }
    public String getMaterialAuditNote() { return materialAuditNote; }
    public Instant getInventoryCheckedAt() { return inventoryCheckedAt; }
    public Instant getMaterialDeductedAt() { return materialDeductedAt; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getConfirmedAt() { return confirmedAt; }
    public Instant getReadyAt() { return readyAt; }
    public Instant getCompletedAt() { return completedAt; }
    public List<ItemDto> getItems() { return items; }
    public List<BillDto> getBills() { return bills; }
}
