package com.demo.security;

public record LoginAuthResponse(
        boolean authenticated,
        boolean mfaRequired,
        String mfaMethod,
        AuthUserView user,
        String message,
        String maskedEmail,
        Long expiresInSeconds
) {}
