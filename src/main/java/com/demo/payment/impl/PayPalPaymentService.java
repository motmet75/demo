package com.demo.payment.impl;

import com.demo.payment.PaymentService;

public class PayPalPaymentService implements PaymentService {

    private final String merchantId;
    private final int timeoutMillis;

    public PayPalPaymentService(String merchantId, int timeoutMillis) {
        this.merchantId = merchantId;
        this.timeoutMillis = timeoutMillis;
    }

    @Override
    public String processPayment(long amountMinor, String currency) {
        // Simulated processing. In real life, call PayPal SDK here.
        return "paypal-tx-" + System.currentTimeMillis();
    }

    @Override
    public boolean supportsCurrency(String currency) {
        // Simple example: PayPal supports common currencies
        return "USD".equalsIgnoreCase(currency) || "EUR".equalsIgnoreCase(currency) || "VND".equalsIgnoreCase(currency);
    }
}