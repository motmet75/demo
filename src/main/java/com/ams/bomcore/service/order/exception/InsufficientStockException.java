package com.ams.bomcore.service.order.exception;

/**
 * Thrown when available stock is insufficient to fulfill an order line.
 */
public class InsufficientStockException extends RuntimeException {

    public InsufficientStockException(String message) {
        super(message);
    }

    public InsufficientStockException(String materialCode, double required, double available) {
        super(String.format("Insufficient stock for material '%s': required=%.4f, available=%.4f",
                materialCode, required, available));
    }
}
