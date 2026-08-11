package com.demo.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.concurrent.ConcurrentHashMap;
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
    private final ConcurrentHashMap<String, AttemptWindow> attempts = new ConcurrentHashMap<>();
    private static final int MAX_ATTEMPTS = 6;
    private static final long ATTEMPT_WINDOW_SECONDS = 600;

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
        String raw;
        do {
            raw = String.format("%06d", random.nextInt(1_000_000));
        } while (tokens.findByTokenHash(hash(raw)).isPresent());
        Instant now = Instant.now();
        QuickLoginToken token = new QuickLoginToken();
        token.setId(UUID.randomUUID());
        token.setTokenHash(hash(raw));
        token.setUserId(user.getId());
        token.setSessionHours(hours);
        token.setCreatedAt(now);
        // The short PIN is exposed only for five minutes. The authenticated
        // session created from it still lasts the selected number of hours.
        token.setExpiresAt(now.plus(5, ChronoUnit.MINUTES));
        tokens.save(token);
        return new IssuedToken(raw, hours, token.getExpiresAt());
    }

    @Transactional
    public User redeem(String raw, HttpServletRequest request, HttpServletResponse response) {
        String client = clientIp(request);
        checkAttemptLimit(client);
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
        attempts.remove(client);
        return user;
    }

    private void checkAttemptLimit(String client) {
        Instant now = Instant.now();
        AttemptWindow window = attempts.compute(client, (key, current) -> {
            if (current == null || now.isAfter(current.started.plusSeconds(ATTEMPT_WINDOW_SECONDS))) {
                return new AttemptWindow(now, 1);
            }
            current.count++;
            return current;
        });
        if (window.count > MAX_ATTEMPTS) {
            throw new QuickLoginException(HttpStatus.TOO_MANY_REQUESTS,
                    "Too many quick login attempts. Please wait 10 minutes");
        }
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) return forwarded.split(",")[0].trim();
        return request.getRemoteAddr();
    }

    private static final class AttemptWindow {
        private final Instant started;
        private int count;
        private AttemptWindow(Instant started, int count) { this.started = started; this.count = count; }
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
