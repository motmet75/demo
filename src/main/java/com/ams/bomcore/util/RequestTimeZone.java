package com.ams.bomcore.util;

import java.time.ZoneId;

public final class RequestTimeZone {
    private RequestTimeZone() {}

    public static ZoneId resolve(String headerValue) {
        if (headerValue != null && !headerValue.isBlank()) {
            try {
                return ZoneId.of(headerValue.trim());
            } catch (Exception ignored) {
                // Fall through to the JVM default zone.
            }
        }
        return ZoneId.systemDefault();
    }
}
