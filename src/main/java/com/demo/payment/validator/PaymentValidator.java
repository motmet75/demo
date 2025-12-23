package com.demo.payment.validator;

import com.demo.demo.PaymentRequest;

public interface PaymentValidator {
    boolean validate(PaymentRequest request);
}
