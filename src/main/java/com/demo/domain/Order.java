package com.demo.domain;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Represents an Order created from a Cart.
 */
public class Order {

    public enum Status { PENDING, PAID, FAILED, CANCELLED }

    private final String id;
    private final List<CartItem> items = new ArrayList<>();
    private final long totalMinor;
    private final String currency;
    private final Instant createdAt;
    private Status status;

    public Order(String id, List<CartItem> items, long totalMinor, String currency, Instant createdAt, Status status) {
        this.id = id;
        if (items != null) {
			this.items.addAll(items);
		}
        this.totalMinor = totalMinor;
        this.currency = currency;
        this.createdAt = createdAt;
        this.status = status;
    }

    public static Order fromCart(Cart cart, String currency) {
        String id = UUID.randomUUID().toString();
        List<CartItem> items = new ArrayList<>(cart.getItems());
        long total = cart.getTotalMinor();
        return new Order(id, items, total, currency == null ? "USD" : currency, Instant.now(), Status.PENDING);
    }

    public String getId() {
        return id;
    }

    public List<CartItem> getItems() {
        return new ArrayList<>(items);
    }

    public long getTotalMinor() {
        return totalMinor;
    }

    public double getTotalMajor() {
        return totalMinor / 100.0d;
    }

    public String getCurrency() {
        return currency;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Status getStatus() {
        return status;
    }

    public void setStatus(Status status) {
        this.status = status;
    }
}
