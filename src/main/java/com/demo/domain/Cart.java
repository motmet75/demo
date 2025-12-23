package com.demo.domain;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Simple shopping cart that holds CartItem entries.
 */
public class Cart {
    private final List<CartItem> items = new ArrayList<>();

    public Cart() {}

    public void addItem(CartItem item) {
        if (item == null) return;
        // Merge quantities for same product
        Optional<CartItem> existing = items.stream().filter(i -> i.getProductId().equals(item.getProductId())).findFirst();
        if (existing.isPresent()) {
            CartItem e = existing.get();
            e.setQuantity(e.getQuantity() + item.getQuantity());
            // keep other fields unchanged
        } else {
            items.add(item);
        }
    }

    public void removeItem(String productId) {
        items.removeIf(i -> i.getProductId().equals(productId));
    }

    public List<CartItem> getItems() {
        return Collections.unmodifiableList(items);
    }

    public long getTotalMinor() {
        return items.stream().mapToLong(CartItem::getLineTotalMinor).sum();
    }

    public double getTotalMajor() {
        return getTotalMinor() / 100.0d;
    }

    public boolean isEmpty() {
        return items.isEmpty();
    }
}
