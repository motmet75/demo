package com.demo.payment.factory;

import com.demo.payment.PaymentService;
import com.demo.payment.gateway.BasicGatewayClient;
import com.demo.payment.gateway.PaymentGatewayClient;
import com.demo.payment.impl.PayPalPaymentService;
import com.demo.payment.validator.BasicPaymentValidator;
import com.demo.payment.validator.PaymentValidator;

public class PayPalFactory implements PaymentAbstractFactory {

    @Override
    public PaymentService createPaymentService(String merchantId, int timeoutMillis) {
        // In a real app, pass clients/validators into the service; keep simple here
        return new PayPalPaymentService(merchantId, timeoutMillis);
    }

    @Override
    public PaymentGatewayClient createGatewayClient(String merchantId, int timeoutMillis) {
        return new BasicGatewayClient("paypal", merchantId, timeoutMillis);
    }

    @Override
    public PaymentValidator createValidator() {
        return new BasicPaymentValidator();
    }
}
