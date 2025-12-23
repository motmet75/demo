package com.demo.payment.factory;

import com.demo.payment.PaymentService;
import com.demo.payment.gateway.BasicGatewayClient;
import com.demo.payment.gateway.PaymentGatewayClient;
import com.demo.payment.impl.CreditCardPaymentService;
import com.demo.payment.validator.BasicPaymentValidator;
import com.demo.payment.validator.PaymentValidator;

public class CreditCardFactory implements PaymentAbstractFactory {

    @Override
    public PaymentService createPaymentService(String merchantId, int timeoutMillis) {
        return new CreditCardPaymentService(merchantId, timeoutMillis);
    }

    @Override
    public PaymentGatewayClient createGatewayClient(String merchantId, int timeoutMillis) {
        return new BasicGatewayClient("creditcard", merchantId, timeoutMillis);
    }

    @Override
    public PaymentValidator createValidator() {
        return new BasicPaymentValidator();
    }
}
