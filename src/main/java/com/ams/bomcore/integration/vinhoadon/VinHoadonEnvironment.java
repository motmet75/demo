package com.ams.bomcore.integration.vinhoadon;

import java.net.URI;
import java.util.Locale;

/** The two official VIN-HOADON API environments supported by the application. */
public enum VinHoadonEnvironment {
    PRODUCTION("https://ws.vin-hoadon.com"),
    DEMO("https://demows.vin-hoadon.com");

    private final URI baseUrl;

    VinHoadonEnvironment(String baseUrl) {
        this.baseUrl = URI.create(baseUrl);
    }

    public URI baseUrl() {
        return baseUrl;
    }

    public static VinHoadonEnvironment from(String value) {
        if (value == null || value.isBlank()) return PRODUCTION;
        try {
            return valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("VIN-HOADON environment must be PRODUCTION or DEMO");
        }
    }
}
