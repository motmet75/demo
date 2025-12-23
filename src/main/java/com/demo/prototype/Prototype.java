package com.demo.prototype;

/**
 * Prototype interface for the Prototype design pattern.
 *
 * Implementations should return a copy of themselves from {@code clone()}.
 */
public interface Prototype {

    /**
     * Create and return a copy of this object.
     * @return a clone of this object
     */
    Prototype clone();
}