package com.ams.bomcore.integration.vinhoadon;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Optional outbound VIN-HOADON relay through a trusted Vietnam Chrome extension.
 * Does not persist invoice payloads, VIN passwords or VIN bearer tokens.
 * A job is leased exactly once, never automatically retried after dispatch.
 */
@Service
public class VinHoadonRelayService {
    public record PairCode(String code, long expiresAt) {}
    public record Tokens(String accessToken, String workerToken, long expiresAt) {}
    public record Job(String id, String path, JsonNode payload, String bearerToken) {}
    public record Result(String id, int status, String body, String error) {}
    public record Reply(int status, String body) {}
    public record Status(boolean active, long lastPollAt, int pendingJobs) {}

    private static final Duration ACCESS_LIFE = Duration.ofMinutes(20);
    private static final Duration WORKER_LIFE = Duration.ofDays(45);
    private static final SecureRandom RNG = new SecureRandom();
    private final boolean enabled;
    private final byte[] secret;
    private final int timeoutSeconds;
    private final LinkedBlockingQueue<Pending> queue = new LinkedBlockingQueue<>();
    private final Map<String, Pending> pending = new ConcurrentHashMap<>();
    private final AtomicLong lastPollAt = new AtomicLong(0);
    private Pairing pairing;

    private static final class Pairing {
        final String code;
        final long expiresAt;
        final AtomicInteger attempts = new AtomicInteger();
        Pairing(String code, long expiresAt) {
            this.code = code;
            this.expiresAt = expiresAt;
        }
    }

    private static final class Pending {
        final Job job;
        final CompletableFuture<Reply> completed = new CompletableFuture<>();
        volatile String assignedTo;
        Pending(Job job) { this.job = job; }
    }

    public VinHoadonRelayService(
            @Value("${vin-hoadon.relay.enabled:false}") boolean enabled,
            @Value("${vin-hoadon.relay.secret:}") String signingSecret,
            @Value("${vin-hoadon.relay.timeout-seconds:120}") int timeoutSeconds,
            VinHoadonProperties vinProperties) {
        this.enabled = enabled;
        this.secret = (signingSecret == null ? "" : signingSecret).getBytes(StandardCharsets.UTF_8);
        this.timeoutSeconds = timeoutSeconds;
        if (enabled) {
            if (secret.length < 32) throw new IllegalStateException("VIN_HOADON_RELAY_SECRET must contain at least 32 bytes");
            if (timeoutSeconds < 30 || timeoutSeconds > 300) throw new IllegalStateException("VIN_HOADON_RELAY_TIMEOUT_SECONDS must be 30-300");
            if (!"https".equalsIgnoreCase(vinProperties.getBaseUrl().getScheme())
                    || !"ws.vin-hoadon.com".equalsIgnoreCase(vinProperties.getBaseUrl().getHost())) {
                throw new IllegalStateException("VIN-HOADON relay only supports https://ws.vin-hoadon.com");
            }
        }
    }

    public boolean isEnabled() { return enabled; }

    public synchronized PairCode generatePairCode() {
        requireEnabled();
        String code = String.format(java.util.Locale.ROOT, "%08d", RNG.nextInt(100_000_000));
        pairing = new Pairing(code, Instant.now().plusSeconds(300).getEpochSecond());
        return new PairCode(code, pairing.expiresAt);
    }

    public synchronized Tokens pair(String code, String agentId) {
        requireEnabled();
        validateAgentId(agentId);
        Pairing p = pairing;
        if (p == null || Instant.now().getEpochSecond() > p.expiresAt || p.attempts.incrementAndGet() > 5) {
            pairing = null;
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Pair code expired or too many attempts");
        }
        if (code == null || !MessageDigest.isEqual(code.getBytes(StandardCharsets.UTF_8),
                p.code.getBytes(StandardCharsets.UTF_8))) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid pair code");
        }
        pairing = null; // One-time code.
        return issueTokens(agentId);
    }

    public Tokens renew(String authorization) {
        requireEnabled();
        String agentId = verify(authorization, "worker");
        return issueTokens(agentId);
    }

    public Job take(String authorization) {
        requireEnabled();
        String agentId = verify(authorization, "access");
        lastPollAt.set(System.currentTimeMillis());
        Pending p;
        while ((p = queue.poll()) != null) {
            if (!pending.containsKey(p.job.id())) continue;
            p.assignedTo = agentId;
            return p.job;
        }
        return null;
    }

    public void finish(String authorization, Result result) {
        requireEnabled();
        String agentId = verify(authorization, "access");
        if (result == null || result.id() == null) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Job ID required");
        Pending p = pending.get(result.id());
        if (p == null || !agentId.equals(p.assignedTo)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Unknown or unassigned job");
        }
        String error = result.error();
        if (error != null && !error.isBlank()) {
            p.completed.completeExceptionally(new IOException("Chrome relay: " + error.substring(0, Math.min(200, error.length()))));
        } else {
            if (result.status() < 100 || result.status() > 599 || result.body() == null || result.body().length() > 2_000_000) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid relay response");
            }
            p.completed.complete(new Reply(result.status(), result.body()));
        }
    }

    public Status status(String authorization) {
        verify(authorization, "access");
        return new Status(active(), lastPollAt.get(), pending.size());
    }

    public boolean active() {
        return enabled && System.currentTimeMillis() - lastPollAt.get() < 90_000L;
    }

    public Reply forward(String path, JsonNode payload, String bearerToken) {
        requireEnabled();
        if (path == null || !path.matches("^/api/services/hddtws/[A-Za-z0-9_/-]+$")) {
            throw new IllegalArgumentException("Unsupported VIN-HOADON relay path");
        }
        if (!active()) {
            throw new VinHoadonApiException("VIN-HOADON relay offline: open Chrome in Vietnam and enable the extension",
                    new IOException("No agent polling"));
        }
        if (pending.size() >= 100) throw new IllegalStateException("VIN-HOADON relay queue is full");
        String id = UUID.randomUUID().toString();
        Pending p = new Pending(new Job(id, path, payload.deepCopy(), bearerToken));
        pending.put(id, p);
        queue.add(p);
        try {
            return p.completed.get(timeoutSeconds, TimeUnit.SECONDS);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new VinHoadonApiException("VIN-HOADON relay interrupted; outcome uncertain", ex);
        } catch (java.util.concurrent.TimeoutException ex) {
            throw new VinHoadonApiException("VIN-HOADON relay timed out; verify invoice status before retrying", ex);
        } catch (java.util.concurrent.ExecutionException ex) {
            throw new VinHoadonApiException("VIN-HOADON relay transport error: "
                    + ex.getCause().getClass().getSimpleName(), ex.getCause());
        } finally {
            pending.remove(id);
            queue.remove(p);
        }
    }

    private synchronized Tokens issueTokens(String agentId) {
        long expires = Instant.now().plus(ACCESS_LIFE).getEpochSecond();
        return new Tokens(sign("access", agentId, expires),
                sign("worker", agentId, Instant.now().plus(WORKER_LIFE).getEpochSecond()), expires);
    }

    private String sign(String kind, String agentId, long expiry) {
        String body = kind + "|" + agentId + "|" + expiry + "|" + UUID.randomUUID();
        String encoded = Base64.getUrlEncoder().withoutPadding().encodeToString(body.getBytes(StandardCharsets.UTF_8));
        return encoded + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(mac(encoded));
    }

    private String verify(String authorization, String kind) {
        requireEnabled();
        try {
            if (authorization == null || !authorization.startsWith("Bearer ")) throw new IllegalArgumentException();
            String[] parts = authorization.substring(7).split("\\.", -1);
            if (parts.length != 2) throw new IllegalArgumentException();
            byte[] signature = Base64.getUrlDecoder().decode(parts[1]);
            if (!MessageDigest.isEqual(signature, mac(parts[0]))) throw new IllegalArgumentException();
            String[] body = new String(Base64.getUrlDecoder().decode(parts[0]), StandardCharsets.UTF_8).split("\\|", -1);
            if (body.length != 4 || !kind.equals(body[0]) || Instant.now().getEpochSecond() >= Long.parseLong(body[2])) {
                throw new IllegalArgumentException();
            }
            validateAgentId(body[1]);
            return body[1];
        } catch (Exception exception) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Relay token invalid or expired");
        }
    }

    private byte[] mac(String message) {
        try {
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(secret, "HmacSHA256"));
            return hmac.doFinal(message.getBytes(StandardCharsets.UTF_8));
        } catch (Exception ex) {
            throw new IllegalStateException("Relay signing failed", ex);
        }
    }

    private static void validateAgentId(String agentId) {
        try { UUID.fromString(agentId); }
        catch (Exception exception) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid agent ID"); }
    }

    private void requireEnabled() {
        if (!enabled) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "VIN-HOADON relay is disabled");
    }
}
