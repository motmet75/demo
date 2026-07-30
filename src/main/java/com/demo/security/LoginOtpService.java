package com.demo.security;

import java.io.Serializable;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.ams.bomcore.domain.user.User;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;

@Service
public class LoginOtpService {
    private static final String PENDING_KEY = "LOGIN_EMAIL_OTP_PENDING";
    private static final String DEVICE_COOKIE = "AMS_TRUSTED_DEVICE";
    private static final Duration OTP_TTL = Duration.ofMinutes(10);
    private static final Duration RESEND_DELAY = Duration.ofSeconds(60);
    private static final Duration TRUST_TTL = Duration.ofDays(30);
    private static final int MAX_ATTEMPTS = 5;

    private final TrustedLoginDeviceRepository devices;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final SecureRandom random = new SecureRandom();
    private final String from;

    public LoginOtpService(TrustedLoginDeviceRepository devices,
            ObjectProvider<JavaMailSender> mailSenderProvider, Environment environment) {
        this.devices = devices;
        this.mailSenderProvider = mailSenderProvider;
        this.from = environment.getProperty("app.mail.from", "services@anhmedia.vn").trim();
    }

    public LoginResult continueOrChallenge(Authentication authentication, User user,
            HttpServletRequest request) {
        String deviceId = deviceId(request);
        if (!deviceId.isBlank()) {
            String fingerprint = fingerprint(user.getId(), deviceId);
            var trusted = devices.findByUserIdAndFingerprintAndExpiresAtAfter(
                    user.getId(), fingerprint, Instant.now());
            if (trusted.isPresent()) {
                TrustedLoginDevice device = trusted.get();
                device.setLastIp(clientIp(request));
                device.setUserAgent(userAgent(request));
                device.setLastUsedAt(Instant.now());
                devices.save(device);
                persist(authentication, request);
                return new LoginResult(false, null, 0);
            }
        }
        return start(authentication, user, request, deviceId);
    }

    public LoginResult resend(HttpServletRequest request) {
        PendingLogin pending = requiredPending(request);
        Instant now = Instant.now();
        if (now.isBefore(pending.resendAvailableAt)) {
            long wait = Math.max(1, Duration.between(now, pending.resendAvailableAt).toSeconds());
            throw new LoginOtpException(HttpStatus.TOO_MANY_REQUESTS,
                    "Please wait " + wait + " seconds before requesting another code");
        }
        issueCode(pending, request.getSession(true));
        return new LoginResult(true, maskEmail(pending.email), OTP_TTL.toSeconds());
    }

    public Authentication verify(String otp, HttpServletRequest request, HttpServletResponse response) {
        PendingLogin pending = requiredPending(request);
        if (Instant.now().isAfter(pending.expiresAt)) {
            clear(request);
            throw new LoginOtpException(HttpStatus.BAD_REQUEST, "The login code expired. Please sign in again");
        }
        if (!StringUtils.hasText(otp) || !constantEquals(pending.codeHash, hash(pending.salt, otp.trim()))) {
            pending.attempts++;
            if (pending.attempts >= MAX_ATTEMPTS) {
                clear(request);
                throw new LoginOtpException(HttpStatus.TOO_MANY_REQUESTS,
                        "Too many incorrect attempts. Please sign in again");
            }
            throw new LoginOtpException(HttpStatus.BAD_REQUEST,
                    "OTP is incorrect. " + (MAX_ATTEMPTS - pending.attempts) + " attempt(s) remaining");
        }
        persist(pending.authentication, request);
        remember(pending, request, response);
        clear(request);
        return pending.authentication;
    }

    public void clear(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) session.removeAttribute(PENDING_KEY);
    }

    private LoginResult start(Authentication auth, User user, HttpServletRequest request, String existingId) {
        if (!StringUtils.hasText(user.getEmail())) {
            throw new LoginOtpException(HttpStatus.BAD_REQUEST,
                    "This account does not have an email address for login verification");
        }
        String id = existingId.isBlank() ? randomHex(24) : existingId;
        PendingLogin pending = new PendingLogin(auth, user.getId(), user.getEmail().trim(), id,
                fingerprint(user.getId(), id), clientIp(request), userAgent(request));
        issueCode(pending, request.getSession(true));
        request.getSession(true).removeAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY);
        SecurityContextHolder.clearContext();
        return new LoginResult(true, maskEmail(pending.email), OTP_TTL.toSeconds());
    }

    private void issueCode(PendingLogin pending, HttpSession session) {
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) throw new LoginOtpException(HttpStatus.SERVICE_UNAVAILABLE,
                "Email service is not configured");
        String otp = String.format("%06d", random.nextInt(1_000_000));
        pending.salt = randomHex(16);
        pending.codeHash = hash(pending.salt, otp);
        pending.expiresAt = Instant.now().plus(OTP_TTL);
        pending.resendAvailableAt = Instant.now().plus(RESEND_DELAY);
        pending.attempts = 0;
        SimpleMailMessage message = new SimpleMailMessage();
        if (StringUtils.hasText(from)) message.setFrom(from);
        message.setTo(pending.email);
        message.setSubject("BOM - Login verification code");
        message.setText("Your BOM login verification code is: " + otp
                + "\n\nIt expires in 10 minutes and can only be used once."
                + "\nDevice: " + pending.userAgent + "\nIP: " + pending.ip
                + "\n\nIf this was not you, do not share this code.");
        try {
            sender.send(message);
            session.setAttribute(PENDING_KEY, pending);
        } catch (MailException ex) {
            session.removeAttribute(PENDING_KEY);
            throw new LoginOtpException(HttpStatus.SERVICE_UNAVAILABLE, "Could not send the login OTP email");
        }
    }

    private void remember(PendingLogin pending, HttpServletRequest request, HttpServletResponse response) {
        TrustedLoginDevice device = devices.findByUserIdAndFingerprint(
                pending.userId, pending.fingerprint).orElseGet(TrustedLoginDevice::new);
        device.setUserId(pending.userId);
        device.setFingerprint(pending.fingerprint);
        device.setLastIp(pending.ip);
        device.setUserAgent(pending.userAgent);
        device.setLastUsedAt(Instant.now());
        device.setExpiresAt(Instant.now().plus(TRUST_TTL));
        devices.save(device);
        Cookie cookie = new Cookie(DEVICE_COOKIE, pending.deviceId);
        cookie.setHttpOnly(true);
        cookie.setSecure(request.isSecure() || "https".equalsIgnoreCase(request.getHeader("X-Forwarded-Proto")));
        cookie.setPath("/");
        cookie.setMaxAge((int) TRUST_TTL.toSeconds());
        cookie.setAttribute("SameSite", "Lax");
        response.addCookie(cookie);
    }

    private void persist(Authentication authentication, HttpServletRequest request) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        request.getSession(true).setAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, context);
    }

    private PendingLogin requiredPending(HttpServletRequest request) {
        Object value = request.getSession(true).getAttribute(PENDING_KEY);
        if (value instanceof PendingLogin pending) return pending;
        throw new LoginOtpException(HttpStatus.BAD_REQUEST,
                "No pending login verification. Please sign in again");
    }

    private String deviceId(HttpServletRequest request) {
        if (request.getCookies() == null) return "";
        for (Cookie cookie : request.getCookies()) {
            if (DEVICE_COOKIE.equals(cookie.getName())
                    && cookie.getValue() != null
                    && cookie.getValue().matches("[A-Za-z0-9_-]{16,96}")) return cookie.getValue();
        }
        return "";
    }

    private String clientIp(HttpServletRequest request) {
        String value = request.getHeader("X-Forwarded-For");
        if (!StringUtils.hasText(value)) value = request.getHeader("X-Real-IP");
        if (!StringUtils.hasText(value)) return request.getRemoteAddr();
        int comma = value.indexOf(',');
        return (comma < 0 ? value : value.substring(0, comma)).trim();
    }

    private String userAgent(HttpServletRequest request) {
        String value = request.getHeader("User-Agent");
        if (!StringUtils.hasText(value)) return "unknown";
        return value.length() <= 220 ? value : value.substring(0, 220);
    }

    private String fingerprint(Integer userId, String deviceId) {
        return sha256(userId + "|" + deviceId);
    }
    private String hash(String salt, String otp) { return sha256(salt + ":" + otp); }
    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
    private boolean constantEquals(String a, String b) {
        return MessageDigest.isEqual(a.getBytes(StandardCharsets.US_ASCII), b.getBytes(StandardCharsets.US_ASCII));
    }
    private String randomHex(int bytes) {
        byte[] value = new byte[bytes];
        random.nextBytes(value);
        return HexFormat.of().formatHex(value);
    }
    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email.substring(at) : "");
        return email.substring(0, 1) + "***" + email.substring(at);
    }

    public record LoginResult(boolean mfaRequired, String maskedEmail, long expiresInSeconds) {}
    private static class PendingLogin implements Serializable {
        private static final long serialVersionUID = 1L;
        final Authentication authentication;
        final Integer userId;
        final String email;
        final String deviceId;
        final String fingerprint;
        final String ip;
        final String userAgent;
        String codeHash;
        String salt;
        Instant expiresAt;
        Instant resendAvailableAt;
        int attempts;
        PendingLogin(Authentication authentication, Integer userId, String email, String deviceId,
                String fingerprint, String ip, String userAgent) {
            this.authentication = authentication;
            this.userId = userId;
            this.email = email;
            this.deviceId = deviceId;
            this.fingerprint = fingerprint;
            this.ip = ip;
            this.userAgent = userAgent;
        }
    }
    public static class LoginOtpException extends RuntimeException {
        private final HttpStatus status;
        LoginOtpException(HttpStatus status, String message) { super(message); this.status = status; }
        public HttpStatus status() { return status; }
    }
}
