package com.demo.payment.gateway;

public interface PaymentGatewayClient {
    String sendPayment(long amountMinor, String currency);
}
