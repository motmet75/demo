package com.demo.demo;

import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

import com.demo.payment.PaymentService;
import com.demo.payment.impl.CreditCardPaymentService;
import com.demo.payment.impl.DisabledPaymentService;
import com.demo.payment.impl.PayPalPaymentService;
import com.demo.payment.impl.PaymentConfig;

public class PaymentConfigFactoryUnitTest {

    @Test
    void returnsCreditCardPaymentServiceWhenTypeIsCreditCard() {
        PaymentConfig cfg = new PaymentConfig();
        cfg.setType("creditcard");
        cfg.setEnabled(true);
        cfg.setMerchantId("m123");
        cfg.setTimeoutMillis(1000);

        PaymentService svc = cfg.paymentService();
        assertInstanceOf(CreditCardPaymentService.class, svc);
    }

    @Test
    void returnsPayPalPaymentServiceWhenTypeIsPayPal() {
        PaymentConfig cfg = new PaymentConfig();
        cfg.setType("paypal");
        cfg.setEnabled(true);
        cfg.setMerchantId("m-paypal");
        cfg.setTimeoutMillis(2000);

        PaymentService svc = cfg.paymentService();
        assertInstanceOf(PayPalPaymentService.class, svc);
    }

    @Test
    void returnsDisabledPaymentServiceWhenDisabled() {
        PaymentConfig cfg = new PaymentConfig();
        cfg.setType("paypal");
        cfg.setEnabled(false);

        PaymentService svc = cfg.paymentService();
        assertInstanceOf(DisabledPaymentService.class, svc);
    }

    @Test
    void throwsOnUnsupportedType() {
        PaymentConfig cfg = new PaymentConfig();
        cfg.setType("unknown-type");
        cfg.setEnabled(true);

        assertThrows(IllegalArgumentException.class, () -> cfg.paymentService());
    }
}