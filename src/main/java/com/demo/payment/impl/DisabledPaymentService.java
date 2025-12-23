package com.demo.payment.impl;

import com.demo.payment.PaymentService;

public class DisabledPaymentService implements PaymentService {

    @Override
    public String processPayment(long amountMinor, String currency) {
        throw new UnsupportedOperationException("Payments are disabled");
    }

    @Override
    public boolean supportsCurrency(String currency) {
        return false;
    }
}