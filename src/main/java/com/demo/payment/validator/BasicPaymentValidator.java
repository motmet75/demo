package com.demo.payment.validator;

import com.demo.demo.PaymentRequest;

public class BasicPaymentValidator implements PaymentValidator {

    @Override
    public boolean validate(PaymentRequest request) {
        if ((request == null) || (request.getAmount() <= 0) || request.getCurrency() == null || request.getCurrency().isBlank()) {
			return false;
		}
        return true;
    }
}
