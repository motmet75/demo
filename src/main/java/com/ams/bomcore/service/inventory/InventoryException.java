package com.ams.bomcore.service.inventory;

/**
 * Business exception for inventory operations.
 */
public class InventoryException extends RuntimeException {
    public InventoryException(String message) { super(message); }
    public InventoryException(String message, Throwable cause) { super(message, cause); }
}
