package com.demo.payment.impl;

/**
 * Payment strategy interface used by the application to process payments.
 *
 * Implementations should at minimum implement {@link #processPayment(long, String)}.
 * Additional operations common to payment providers are provided as default methods
 * so existing implementations remain compatible.
 */
public interface PaymentService {
    /**
     * Process a payment for the given amount (in minor units) and currency.
     * Returns a provider-specific transaction id or throws an exception on failure.
     */
    String processPayment(long amountMinor, String currency);

    /**
     * Returns true if the provider supports the given currency.
     */
    default boolean supportsCurrency(String currency) {
        return true;
    }

    /**
     * Optionally authorize a payment (without capture). Returns an authorization id.
     * Default implementation throws UnsupportedOperationException to indicate it's optional.
     */
    default String authorize(long amountMinor, String currency) {
        throw new UnsupportedOperationException("authorize not supported by this provider");
    }

    /**
     * Optionally capture a previously authorized payment. Returns a transaction id.
     */
    default String capture(String authorizationId) {
        throw new UnsupportedOperationException("capture not supported by this provider");
    }

    /**
     * Optionally refund a transaction. Returns true when refund succeeded.
     */
    default boolean refund(String transactionId, long amountMinor) {
        throw new UnsupportedOperationException("refund not supported by this provider");
    }

    /**
     * Human-readable provider name for logging/telemetry.
     */
    default String getProviderName() {
        return "generic";
    }

    /**
     * Convenience helper that accepts an amount as a decimal (e.g. 12.34) and
     * performs a payment using a default currency (USD). Implementations can
     * override this method if they need different behavior.
     *
     * This default converts to minor units (cents) with rounding, calls
     * {@link #processPayment(long, String)} and logs the resulting transaction id.
     */
    default void pay(double amount) {
        // Convert dollars to cents (minor units). Uses rounding to nearest cent.
        long amountMinor = Math.round(amount * 100d);
        // Use a sensible default currency; callers should prefer processPayment when
        // they need a specific currency.
        String defaultCurrency = "USD";
        String txId = processPayment(amountMinor, defaultCurrency);
        // Lightweight console output for quick debug; production code should use a logger.
        System.out.println("Payment of " + amount + " " + defaultCurrency + " processed by "
                + getProviderName() + ", tx=" + txId);
    }
}