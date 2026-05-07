package com.demo.payment.impl;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.demo.payment.PaymentService;
import com.demo.payment.PaymentServiceFactory;


@Configuration
@ConfigurationProperties(prefix = "payment")
public class PaymentConfig {

    // type of payment provider (paypal|creditcard)
    private String type = "paypal";

    // create payment service based on type
    @Bean
    public PaymentService paymentService() {
        return PaymentServiceFactory.create(type, enabled, merchantId, timeoutMillis);
    }

    private String merchantId;
    private boolean enabled = true;
    private int timeoutMillis = 30000;
    private List<String> currencies;

    // Getters and setters
    public String getMerchantId() {
        return merchantId;
    }

    public void setMerchantId(String merchantId) {
        this.merchantId = merchantId;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getTimeoutMillis() {
        return timeoutMillis;
    }

    public void setTimeoutMillis(int timeoutMillis) {
        this.timeoutMillis = timeoutMillis;
    }

    public List<String> getCurrencies() {
        return currencies;
    }

    public void setCurrencies(List<String> currencies) {
        this.currencies = currencies;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    @Override
    public String toString() {
        return "PaymentConfig [type=" + type + ", merchantId=" + merchantId + ", enabled=" + enabled
                + ", timeoutMillis=" + timeoutMillis + ", currencies=" + currencies + "]";
    }
}