package com.demo.domain;

/**
 * Represents a single line item in a shopping cart or order.
 */
public class CartItem {
    private String productId;
    private String name;
    // price in minor units (e.g., cents)
    private long unitPriceMinor;
    private int quantity;

    public CartItem() {}

    public CartItem(String productId, String name, long unitPriceMinor, int quantity) {
        this.productId = productId;
        this.name = name;
        this.unitPriceMinor = unitPriceMinor;
        this.quantity = quantity;
    }

    public String getProductId() {
        return productId;
    }

    public void setProductId(String productId) {
        this.productId = productId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public long getUnitPriceMinor() {
        return unitPriceMinor;
    }

    public void setUnitPriceMinor(long unitPriceMinor) {
        this.unitPriceMinor = unitPriceMinor;
    }

    public int getQuantity() {
        return quantity;
    }

    public void setQuantity(int quantity) {
        this.quantity = quantity;
    }

    public long getLineTotalMinor() {
        return unitPriceMinor * quantity;
    }
}
