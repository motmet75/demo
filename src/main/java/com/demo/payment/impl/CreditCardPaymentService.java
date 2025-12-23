package com.demo.payment.impl;

import com.demo.payment.PaymentService;
import org.springframework.stereotype.Service;

@Service
public class CreditCardPaymentService implements PaymentService {

    private final String merchantId;
    private final int timeoutMillis;

    // No-arg constructor for Spring component scanning (will use defaults)
    public CreditCardPaymentService() {
        this.merchantId = "";
        this.timeoutMillis = 30000;
    }

    public CreditCardPaymentService(String merchantId, int timeoutMillis) {
        this.merchantId = merchantId;
        this.timeoutMillis = timeoutMillis;
    }

    @Override
    public String processPayment(long amountMinor, String currency) {
        // Simulated processing. In real life, call a credit-card processor SDK here.
        return "cc-tx-" + System.currentTimeMillis();
    }

    @Override
    public boolean supportsCurrency(String currency) {
        // Example: support common currencies
        return "USD".equalsIgnoreCase(currency) || "EUR".equalsIgnoreCase(currency) || "VND".equalsIgnoreCase(currency);
    }

    @Override
    public String getProviderName() {
        return "creditcard";
    }
}