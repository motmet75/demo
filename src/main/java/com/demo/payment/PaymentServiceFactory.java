package com.demo.payment;

import com.demo.payment.factory.CreditCardFactory;
import com.demo.payment.factory.PayPalFactory;
import com.demo.payment.factory.PaymentAbstractFactory;
import com.demo.payment.factory.StripeFactory;

/**
 * Simple factory that delegates to provider-specific abstract factories.
 */
public final class PaymentServiceFactory {

    private PaymentServiceFactory() {}

    public static PaymentService create(String type, boolean enabled, String merchantId, int timeoutMillis) {
        if (!enabled) {
            return new com.demo.payment.impl.DisabledPaymentService();
        }
        if (type == null) throw new IllegalArgumentException("payment type must not be null");
        PaymentAbstractFactory factory;
        switch (type.toLowerCase()) {
            case "paypal":
                factory = new PayPalFactory();
                break;
            case "creditcard":
            case "card":
                factory = new CreditCardFactory();
                break;
            case "stripe":
                factory = new StripeFactory();
                break;
            default:
                throw new IllegalArgumentException("Unsupported payment type: " + type);
        }
        return factory.createPaymentService(merchantId, timeoutMillis);
    }
}