package com.anhmedia.portalweb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Map;
import java.util.Optional;

/**
 * Private read-only data bridge to the Demo API (8081). The public-facing
 * portal-web JAR does not open Portal tenant databases or read DB passwords.
 */
@Component
public class PublicContentBridge {
    private static final Logger log = LoggerFactory.getLogger(PublicContentBridge.class);
    private static final ParameterizedTypeReference<Map<String,Object>> SNAPSHOT =
            new ParameterizedTypeReference<>() {};
    private final RestClient client;
    private final String secret;

    public PublicContentBridge(
            @Value("${portal.web.content-bridge-url:http://127.0.0.1:8081/sapi/internal/portal-public}") String baseUrl,
            @Value("${portal.web.content-bridge-token:}") String secret) {
        // Fixed local backend URL. Never let a browser-supplied URL be proxied.
        if (!baseUrl.startsWith("http://127.0.0.1:8081/")
                && !baseUrl.startsWith("http://localhost:8081/")) {
            throw new IllegalArgumentException("Portal public content backend must be local port 8081");
        }
        this.client = RestClient.builder().baseUrl(baseUrl).build();
        this.secret = secret == null ? "" : secret.trim();
    }

    public boolean enabled() {
        return secret.length() >= 32;
    }

    public Optional<Map<String,Object>> homepage(ThemeRegistry.Theme theme, String lang) {
        if (!enabled()) return Optional.empty();
        try {
            Map<String,Object> payload = client.get()
                    .uri("/{tenantId}?lang={lang}", theme.tenant(), lang)
                    .header("X-Portal-Bridge-Token", secret)
                    .retrieve().body(SNAPSHOT);
            if (payload == null || !theme.tenant().equals(payload.get("tenantId"))) {
                throw new IllegalStateException("Tenant ID mismatch in public content snapshot");
            }
            return Optional.of(payload);
        } catch (RuntimeException ex) {
            // Do not log request token or database config.
            log.error("Portal content bridge failed for tenant={} status={}",
                    theme.tenant(), ex.getClass().getSimpleName());
            throw new IllegalStateException("Public content is unavailable for tenant " + theme.tenant(), ex);
        }
    }
}
