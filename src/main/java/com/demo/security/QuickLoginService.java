package com.demo.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Set;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.UserRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.Cookie;

@Service
public class QuickLoginService {
    private static final Set<Integer> ALLOWED_HOURS = Set.of(6, 8, 12, 24);
    private final QuickLoginTokenRepository tokens;
    private final UserRepository users;
    private final AppUserDetailsService userDetailsService;
    private final SecureRandom random = new SecureRandom();

    public QuickLoginService(QuickLoginTokenRepository tokens, UserRepository users,
                             AppUserDetailsService userDetailsService) {
        this.tokens = tokens;
        this.users = users;
        this.userDetailsService = userDetailsService;
    }

    @Transactional
    public IssuedToken issue(User user, Integer requestedHours) {
        int hours = requestedHours != null ? requestedHours : 12;
        if (!ALLOWED_HOURS.contains(hours)) throw new QuickLoginException(HttpStatus.BAD_REQUEST, "Hours must be 6, 8, 12 or 24");
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        Instant now = Instant.now();
        QuickLoginToken token = new QuickLoginToken();
        token.setId(UUID.randomUUID());
        token.setTokenHash(hash(raw));
        token.setUserId(user.getId());
        token.setSessionHours(hours);
        token.setCreatedAt(now);
        token.setExpiresAt(now.plus(hours, ChronoUnit.HOURS));
        tokens.save(token);
        return new IssuedToken(raw, hours, token.getExpiresAt());
    }

    @Transactional
    public User redeem(String raw, HttpServletRequest request, HttpServletResponse response) {
        QuickLoginToken token = tokens.findByTokenHash(hash(raw == null ? "" : raw.trim()))
                .orElseThrow(() -> new QuickLoginException(HttpStatus.UNAUTHORIZED, "Quick login token is invalid"));
        Instant now = Instant.now();
        if (token.getUsedAt() != null || !now.isBefore(token.getExpiresAt())) {
            throw new QuickLoginException(HttpStatus.UNAUTHORIZED, "Quick login token was used or expired");
        }
        User dbUser = users.findById(token.getUserId())
                .orElseThrow(() -> new QuickLoginException(HttpStatus.UNAUTHORIZED, "User no longer exists"));
        if (!dbUser.isEnabled()) throw new QuickLoginException(HttpStatus.UNAUTHORIZED, "Account is disabled");
        User user = (User) userDetailsService.loadUserByUsername(dbUser.getUsername());
        var authentication = UsernamePasswordAuthenticationToken.authenticated(user, null, user.getAuthorities());
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        var session = request.getSession(true);
        session.setMaxInactiveInterval(token.getSessionHours() * 3600);
        session.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
        Cookie sessionCookie = new Cookie("JSESSIONID", session.getId());
        sessionCookie.setHttpOnly(true);
        sessionCookie.setSecure(request.isSecure()
                || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto")));
        sessionCookie.setPath("/");
        sessionCookie.setMaxAge(token.getSessionHours() * 3600);
        sessionCookie.setAttribute("SameSite", "Lax");
        response.addCookie(sessionCookie);
        token.setUsedAt(now);
        tokens.save(token);
        return user;
    }

    private static String hash(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public record IssuedToken(String token, int sessionHours, Instant expiresAt) {}
    public static class QuickLoginException extends RuntimeException {
        private final HttpStatus status;
        public QuickLoginException(HttpStatus status, String message) { super(message); this.status = status; }
        public HttpStatus status() { return status; }
    }
}
