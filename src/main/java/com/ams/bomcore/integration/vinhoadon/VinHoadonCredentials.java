package com.ams.bomcore.integration.vinhoadon;

/** Credentials issued by VIN-HOADON for one seller tax identity. */
public record VinHoadonCredentials(String taxCode, String username, String password) {

    public VinHoadonCredentials {
        taxCode = required(taxCode, "taxCode");
        username = required(username, "username");
        password = required(password, "password");
    }

    /** A non-secret identity suitable for isolating cached tokens. */
    String cacheKey() {
        return taxCode + "\u0000" + username;
    }

    private static String required(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("VIN-HOADON " + name + " is required");
        }
        return value.trim();
    }
}
