package com.ams.bomcore.service.order.exception;

import java.util.UUID;

/**
 * Thrown when no active BOM is found for a model during BOM explosion.
 */
public class BomNotFoundException extends RuntimeException {

    public BomNotFoundException(UUID modelId) {
        super("No active BOM found for model: " + modelId);
    }

    public BomNotFoundException(String message) {
        super(message);
    }
}
