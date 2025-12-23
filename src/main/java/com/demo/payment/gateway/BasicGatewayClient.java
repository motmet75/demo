package com.demo.payment.gateway;

public class BasicGatewayClient implements PaymentGatewayClient {

    private final String provider;
    private final String merchantId;
    private final int timeoutMillis;

    public BasicGatewayClient(String provider, String merchantId, int timeoutMillis) {
        this.provider = provider;
        this.merchantId = merchantId;
        this.timeoutMillis = timeoutMillis;
    }

    @Override
    public String sendPayment(long amountMinor, String currency) {
        // Simulated network call to provider
        return provider + "-gateway-tx-" + System.currentTimeMillis();
    }
}
