package com.demo.domain;

/**
 * Domain-level payment request, referencing an order (or ad-hoc amounts).
 *
 * Immutable value object constructed via the {@link Builder}.
 */
public final class PaymentRequest {
    private final String orderId; // optional - if present, indicates payment for that order
    private final double amount;  // major units (e.g., dollars)
    private final String currency;
    private final String paymentMethod; // e.g., "paypal", "creditcard"

    private PaymentRequest(Builder b) {
        this.orderId = b.orderId;
        this.amount = b.amount;
        this.currency = b.currency;
        this.paymentMethod = b.paymentMethod;
    }

    public String getOrderId() {
        return orderId;
    }

    public double getAmount() {
        return amount;
    }

    public String getCurrency() {
        return currency;
    }

    public String getPaymentMethod() {
        return paymentMethod;
    }

    @Override
    public String toString() {
        return "PaymentRequest[orderId=" + orderId + ", amount=" + amount + ", currency=" + currency + ", paymentMethod=" + paymentMethod + "]";
    }

    /**
     * Builder for {@link PaymentRequest}.
     * Required fields are: amount (>0), currency (non-empty) and paymentMethod (non-empty).
     */
    public static class Builder {
        private String orderId;
        private Double amount;
        private String currency;
        private String paymentMethod;

        public Builder() {}

        /** Optional order id. */
        public Builder orderId(String orderId) {
            this.orderId = orderId;
            return this;
        }

        /** Required amount in major units (e.g., dollars). Must be > 0. */
        public Builder amount(double amount) {
            this.amount = amount;
            return this;
        }

        /** Required currency (e.g., "USD"). */
        public Builder currency(String currency) {
            this.currency = currency;
            return this;
        }

        /** Required payment method (e.g., "paypal"). */
        public Builder paymentMethod(String paymentMethod) {
            this.paymentMethod = paymentMethod;
            return this;
        }

        public PaymentRequest build() {
            if (amount == null) {
                throw new IllegalStateException("amount is required");
            }
            if (amount <= 0d) {
                throw new IllegalStateException("amount must be > 0");
            }
            if (currency == null || currency.isBlank()) {
                throw new IllegalStateException("currency is required");
            }
            if (paymentMethod == null || paymentMethod.isBlank()) {
                throw new IllegalStateException("paymentMethod is required");
            }
            return new PaymentRequest(this);
        }
    }
}