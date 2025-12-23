package com.demo.payment;

/**
 * Payment strategy interface used by the application to process payments.
 */
public interface PaymentService {
    String processPayment(long amountMinor, String currency);
    default boolean supportsCurrency(String currency) { return true; }
    default String authorize(long amountMinor, String currency) { throw new UnsupportedOperationException("authorize not supported"); }
    default String capture(String authorizationId) { throw new UnsupportedOperationException("capture not supported"); }
    default boolean refund(String transactionId, long amountMinor) { throw new UnsupportedOperationException("refund not supported"); }
    default String getProviderName() { return "generic"; }
    default void pay(double amount) { long amountMinor = Math.round(amount * 100d); String defaultCurrency = "USD"; String txId = processPayment(amountMinor, defaultCurrency); System.out.println("Payment of " + amount + " " + defaultCurrency + " processed by " + getProviderName() + ", tx=" + txId); }
}
