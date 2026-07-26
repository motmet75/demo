package com.demo.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.core.env.Environment;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import com.ams.bomcore.domain.user.User;

@Service
public class PasswordChangeOtpService {
    private static final Logger log = LoggerFactory.getLogger(PasswordChangeOtpService.class);
    private static final Duration OTP_TTL = Duration.ofMinutes(10);
    private static final Duration RESEND_DELAY = Duration.ofSeconds(60);
    private static final int MAX_ATTEMPTS = 5;

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final SecureRandom secureRandom = new SecureRandom();
    private final Map<Integer, OtpChallenge> challenges = new ConcurrentHashMap<>();
    private final String from;

    public PasswordChangeOtpService(ObjectProvider<JavaMailSender> mailSenderProvider, Environment environment) {
        this.mailSenderProvider = mailSenderProvider;
        this.from = environment.getProperty("app.mail.from", "services@anhmedia.vn").trim();
    }

    public synchronized OtpRequestResult request(User user) {
        if (user == null || user.getId() == null) throw new OtpException(HttpStatus.UNAUTHORIZED, "Not authenticated");
        String email = StringUtils.hasText(user.getEmail()) ? user.getEmail().trim() : "";
        if (!StringUtils.hasText(email)) throw new OtpException(HttpStatus.BAD_REQUEST, "This account does not have an email address");

        Instant now = Instant.now();
        OtpChallenge current = challenges.get(user.getId());
        if (current != null && now.isBefore(current.resendAvailableAt())) {
            long seconds = Math.max(1, Duration.between(now, current.resendAvailableAt()).toSeconds());
            throw new OtpException(HttpStatus.TOO_MANY_REQUESTS, "Please wait " + seconds + " seconds before requesting another OTP");
        }
        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) throw new OtpException(HttpStatus.SERVICE_UNAVAILABLE, "Email service is not configured");

        String otp = String.format("%06d", secureRandom.nextInt(1_000_000));
        String salt = Long.toUnsignedString(secureRandom.nextLong(), 36);
        challenges.put(user.getId(), new OtpChallenge(hash(salt, otp), salt, now.plus(OTP_TTL), now.plus(RESEND_DELAY), MAX_ATTEMPTS));

        SimpleMailMessage message = new SimpleMailMessage();
        if (StringUtils.hasText(from)) message.setFrom(from);
        message.setTo(email);
        message.setSubject("BOM - Mã OTP đổi mật khẩu");
        message.setText("Mã OTP để đổi mật khẩu BOM của bạn là: " + otp
                + "\n\nMã có hiệu lực trong 10 phút và chỉ sử dụng được một lần."
                + "\nNếu bạn không yêu cầu đổi mật khẩu, vui lòng bỏ qua email này."
                + "\n\nYour BOM password-change OTP is: " + otp
                + "\nIt expires in 10 minutes and can only be used once.");
        try {
            mailSender.send(message);
        } catch (MailException ex) {
            challenges.remove(user.getId());
            Throwable cause = ex.getMostSpecificCause();
            log.warn("Could not send password OTP email via Amazon SES: {}",
                    cause != null ? cause.getMessage() : ex.getMessage());
            throw new OtpException(HttpStatus.SERVICE_UNAVAILABLE, "Could not send the OTP email");
        }
        return new OtpRequestResult(maskEmail(email), OTP_TTL.toSeconds());
    }

    public synchronized void verifyAndConsume(Integer userId, String otp) {
        if (userId == null || !StringUtils.hasText(otp)) throw new OtpException(HttpStatus.BAD_REQUEST, "OTP is required");
        OtpChallenge challenge = challenges.get(userId);
        if (challenge == null || Instant.now().isAfter(challenge.expiresAt())) {
            challenges.remove(userId);
            throw new OtpException(HttpStatus.BAD_REQUEST, "OTP is invalid or has expired");
        }
        boolean matches = MessageDigest.isEqual(challenge.otpHash().getBytes(StandardCharsets.US_ASCII), hash(challenge.salt(), otp.trim()).getBytes(StandardCharsets.US_ASCII));
        if (!matches) {
            int left = challenge.attemptsLeft() - 1;
            if (left <= 0) {
                challenges.remove(userId);
                throw new OtpException(HttpStatus.TOO_MANY_REQUESTS, "Too many incorrect attempts. Request a new OTP");
            }
            challenges.put(userId, challenge.withAttemptsLeft(left));
            throw new OtpException(HttpStatus.BAD_REQUEST, "OTP is incorrect. " + left + " attempt(s) remaining");
        }
        challenges.remove(userId);
    }

    private String hash(String salt, String otp) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((salt + ":" + otp).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is unavailable", ex);
        }
    }

    private String maskEmail(String email) {
        int at = email.indexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email.substring(at) : "");
        return email.substring(0, 1) + "***" + email.substring(at - 1);
    }

    public record OtpRequestResult(String maskedEmail, long expiresInSeconds) {}
    private record OtpChallenge(String otpHash, String salt, Instant expiresAt, Instant resendAvailableAt, int attemptsLeft) {
        private OtpChallenge withAttemptsLeft(int value) { return new OtpChallenge(otpHash, salt, expiresAt, resendAvailableAt, value); }
    }
    public static class OtpException extends RuntimeException {
        private final HttpStatus status;
        public OtpException(HttpStatus status, String message) { super(message); this.status = status; }
        public HttpStatus status() { return status; }
    }
}