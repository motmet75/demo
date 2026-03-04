package com.ams.bomcore.service.order.exception;

/**
 * Thrown when a material quota would be exceeded by the planned consumption.
 */
public class QuotaExceededException extends RuntimeException {

    public QuotaExceededException(String message) {
        super(message);
    }

    public QuotaExceededException(String materialCode, double requested, double remaining) {
        super(String.format("Quota exceeded for material '%s': requested=%.4f, remaining=%.4f",
                materialCode, requested, remaining));
    }
}
