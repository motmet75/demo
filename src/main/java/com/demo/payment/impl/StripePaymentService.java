package com.demo.payment.impl;

import com.demo.payment.PaymentService;

public class StripePaymentService implements PaymentService {

    private final String merchantId;
    private final int timeoutMillis;

    public StripePaymentService(String merchantId, int timeoutMillis) {
        this.merchantId = merchantId;
        this.timeoutMillis = timeoutMillis;
    }

    @Override
    public String processPayment(long amountMinor, String currency) {
        // Simulated processing. In real life, call Stripe SDK here.
        return "stripe-tx-" + System.currentTimeMillis();
    }

    @Override
    public boolean supportsCurrency(String currency) {
        // Simple example: Stripe supports many currencies
        return true;
    }
}