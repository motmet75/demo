package com.ams.bomcore.integration.vinhoadon;

import java.net.URI;
import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Non-secret, process-wide connection settings for the VIN-HOADON gateway.
 *
 * <p>Credentials are deliberately not kept here because this application is
 * multi-tenant. They are supplied per call by a tenant-aware credential
 * provider when the business integration is wired.</p>
 */
@Component
public class VinHoadonProperties {

    private final boolean enabled;
    private final URI baseUrl;
    private final Duration connectTimeout;
    private final Duration requestTimeout;

    public VinHoadonProperties(
            @Value("${vin-hoadon.enabled:false}") boolean enabled,
            @Value("${vin-hoadon.base-url:https://demows.vin-hoadon.com}") String baseUrl,
            @Value("${vin-hoadon.connect-timeout-seconds:10}") long connectTimeoutSeconds,
            @Value("${vin-hoadon.request-timeout-seconds:30}") long requestTimeoutSeconds) {
        this.enabled = enabled;
        this.baseUrl = normalizeBaseUrl(baseUrl);
        this.connectTimeout = positiveDuration(connectTimeoutSeconds, "connect timeout");
        this.requestTimeout = positiveDuration(requestTimeoutSeconds, "request timeout");
    }

    public boolean isEnabled() {
        return enabled;
    }

    public URI getBaseUrl() {
        return baseUrl;
    }

    public Duration getConnectTimeout() {
        return connectTimeout;
    }

    public Duration getRequestTimeout() {
        return requestTimeout;
    }

    private static URI normalizeBaseUrl(String value) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("VIN-HOADON base URL is required");
        }
        String normalized = value.trim().replaceAll("/+$", "");
        URI uri = URI.create(normalized);
        if (uri.getScheme() == null || uri.getHost() == null) {
            throw new IllegalArgumentException("VIN-HOADON base URL must be an absolute HTTP(S) URL");
        }
        if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IllegalArgumentException("VIN-HOADON base URL must use HTTP or HTTPS");
        }
        return uri;
    }

    private static Duration positiveDuration(long seconds, String label) {
        if (seconds <= 0) {
            throw new IllegalArgumentException("VIN-HOADON " + label + " must be positive");
        }
        return Duration.ofSeconds(seconds);
    }
}
