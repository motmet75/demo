package com.anhmedia.portalweb.legacy.entity;

import com.anhmedia.portalweb.legacy.Utilities;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Port of legacy com.vaadin.example.cart.Cart as far as public pages read it
 * (cart.currency, cart.formatedPrice, cart.items, cart.totalItems).
 * Portal Web never adds items: the cart itself still lives on Portal 8080,
 * so these pages show the same empty cart a new 8080 session shows.
 */
public class Cart {
    private List<Object> items = new ArrayList<>();
    private int totalItems;
    private String currency = "";
    private String email = "";
    private String note = "";
    private String tenantId;
    private String language = "vi";
    private BigDecimal totalPrice = BigDecimal.ZERO;
    private String formatedPrice = "0";

    public Cart(String tenantID, String langString) {
        setLanguage(langString);
        setTenantId(tenantID);
        currency = Utilities.getConfigValueByLanguage("currencyDisplay", language);
    }

    public List<Object> getItems() { return items; }
    public int getTotalItems() { return totalItems; }
    public BigDecimal getTotalPrice() { return totalPrice; }
    public String getCurrency() { return currency; }
    public String getNote() { return note; }
    public String getFormatedPrice() { return formatedPrice; }
    public String getTenantId() { return tenantId; }
    public String getLanguage() { return language; }
    public String getEmail() { return email; }

    public void setTenantId(String tenantId) {
        currency = Utilities.getConfigValueByLanguage("currencyDisplay", language);
        formatedPrice = Utilities.doubleToStringCurrency(totalPrice, tenantId, language);
        this.tenantId = tenantId;
    }

    public void setLanguage(String language) { this.language = language; }
}
