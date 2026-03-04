package com.ams.bomcore.service.order.exception;

import java.util.UUID;

/**
 * Thrown when an order is not found for the given id and tenant/company scope.
 */
public class OrderNotFoundException extends RuntimeException {

    public OrderNotFoundException(UUID id) {
        super("Order not found: " + id);
    }

    public OrderNotFoundException(String message) {
        super(message);
    }
}
