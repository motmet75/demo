package com.demo.payment.factory;

import com.demo.payment.PaymentService;
import com.demo.payment.gateway.BasicGatewayClient;
import com.demo.payment.gateway.PaymentGatewayClient;
import com.demo.payment.impl.StripePaymentService;
import com.demo.payment.validator.BasicPaymentValidator;
import com.demo.payment.validator.PaymentValidator;

public class StripeFactory implements PaymentAbstractFactory {

    @Override
    public PaymentService createPaymentService(String merchantId, int timeoutMillis) {
        return new StripePaymentService(merchantId, timeoutMillis);
    }

    @Override
    public PaymentGatewayClient createGatewayClient(String merchantId, int timeoutMillis) {
        return new BasicGatewayClient("stripe", merchantId, timeoutMillis);
    }

    @Override
    public PaymentValidator createValidator() {
        return new BasicPaymentValidator();
    }
}
