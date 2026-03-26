package com.demo.security;

public record AuthResponse(
        boolean authenticated,
        AuthUserView user,
        String message
) {
}
