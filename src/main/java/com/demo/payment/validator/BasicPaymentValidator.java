package com.demo.payment.validator;

import com.demo.demo.PaymentRequest;

public class BasicPaymentValidator implements PaymentValidator {

    @Override
    public boolean validate(PaymentRequest request) {
        if (request == null) return false;
        if (request.getAmount() <= 0) return false;
        if (request.getCurrency() == null || request.getCurrency().isBlank()) return false;
        return true;
    }
}
