package com.ams.bomcore.integration.vinhoadon;

/** Credentials issued by VIN-HOADON for one seller tax identity and environment. */
public record VinHoadonCredentials(String taxCode, String username, String password,
                                   VinHoadonEnvironment environment) {

    /** Compatibility constructor for low-level callers that use the configured fallback endpoint. */
    public VinHoadonCredentials(String taxCode, String username, String password) {
        this(taxCode, username, password, null);
    }

    public VinHoadonCredentials {
        taxCode = required(taxCode, "taxCode");
        username = required(username, "username");
        password = required(password, "password");
    }

    /** A non-secret identity suitable for isolating cached tokens. */
    String cacheKey() {
        return (environment == null ? "DEFAULT" : environment.name()) + "\u0000" + taxCode + "\u0000" + username;
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("VIN-HOADON " + name + " is required");
        }
        return value.trim();
    }
}
