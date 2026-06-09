package com.ams.bomcore.domain.shop;

import com.ams.bomcore.domain.model.Model;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.util.UUID;

@Entity
@Table(name = "shop_order_item")
public class ShopOrderItem {

    @Id
    @Column(name = "id", nullable = false)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private ShopOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "model_id", nullable = false)
    private Model model;

    @Column(name = "model_name", columnDefinition = "TEXT")
    private String modelName;

    @Column(name = "quantity", nullable = false, columnDefinition = "numeric")
    private BigDecimal quantity;

    @Column(name = "unit_price", columnDefinition = "numeric")
    private BigDecimal unitPrice;

    @Column(name = "unit_raw_cost", columnDefinition = "numeric")
    private BigDecimal unitRawCost;

    @Column(name = "line_total", columnDefinition = "numeric")
    private BigDecimal lineTotal;

    /** JSON object of selected option groups, e.g. {"Sugar":"70%","Ice":"Less"} */
    @Column(name = "selected_options", columnDefinition = "TEXT")
    private String selectedOptions;

    /** Sum of option choice prices per unit (from groups where isFree=false) */
    @Column(name = "option_add_on", columnDefinition = "numeric")
    private BigDecimal optionAddOn = BigDecimal.ZERO;

    @Column(name = "item_notes", columnDefinition = "TEXT")
    private String itemNotes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_item_id")
    private ShopOrderItem parentItem;

    public ShopOrderItem() {}

    @PrePersist
    private void prePersist() {
        if (id == null) id = UUID.randomUUID();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public ShopOrder getOrder() { return order; }
    public void setOrder(ShopOrder order) { this.order = order; }
    public Model getModel() { return model; }
    public void setModel(Model model) { this.model = model; }
    public String getModelName() { return modelName; }
    public void setModelName(String modelName) { this.modelName = modelName; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
    public BigDecimal getUnitRawCost() { return unitRawCost; }
    public void setUnitRawCost(BigDecimal unitRawCost) { this.unitRawCost = unitRawCost; }
    public BigDecimal getLineTotal() { return lineTotal; }
    public void setLineTotal(BigDecimal lineTotal) { this.lineTotal = lineTotal; }
    public String getSelectedOptions() { return selectedOptions; }
    public void setSelectedOptions(String selectedOptions) { this.selectedOptions = selectedOptions; }
    public BigDecimal getOptionAddOn() { return optionAddOn; }
    public void setOptionAddOn(BigDecimal optionAddOn) { this.optionAddOn = optionAddOn; }
    public String getItemNotes() { return itemNotes; }
    public void setItemNotes(String itemNotes) { this.itemNotes = itemNotes; }
    public ShopOrderItem getParentItem() { return parentItem; }
    public void setParentItem(ShopOrderItem parentItem) { this.parentItem = parentItem; }
}
