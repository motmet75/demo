package com.ams.bomcore.service.order.exception;

/**
 * Thrown when an invalid status transition is attempted on an order.
 */
public class InvalidOrderStatusException extends RuntimeException {

    public InvalidOrderStatusException(String currentStatus, String targetStatus) {
        super(String.format("Cannot transition order from '%s' to '%s'", currentStatus, targetStatus));
    }

    public InvalidOrderStatusException(String message) {
        super(message);
    }
}
