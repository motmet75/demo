package com.demo.payment.factory;

import com.demo.payment.PaymentService;
import com.demo.payment.gateway.PaymentGatewayClient;
import com.demo.payment.validator.PaymentValidator;

/**
 * Abstract Factory for payment-related components that belong together for a provider.
 * A factory produces a PaymentService plus related products (gateway client, validator).
 */
public interface PaymentAbstractFactory {

    PaymentService createPaymentService(String merchantId, int timeoutMillis);

    PaymentGatewayClient createGatewayClient(String merchantId, int timeoutMillis);

    PaymentValidator createValidator();
}
