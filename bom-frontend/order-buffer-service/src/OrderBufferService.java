package com.anhmedia.orderbuffer;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.StringReader;
import java.io.StringWriter;
import java.net.ConnectException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpConnectTimeoutException;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Tiny store-and-forward gateway for POST /sapi/shop/public/orders.
 *
 * <p>When the main application is healthy the response is passed through unchanged. If the
 * connection cannot be established, the exact request is durably queued in Redis. A background
 * worker replays queued requests after the main application comes back. This service deliberately
 * does not write shop domain keys or the SQL database, so all validation remains in the main app.</p>
 */
public final class OrderBufferService {
    private static final String CREATE_PATH = "/sapi/shop/public/orders";
    private static final String PUBLIC_PATH_PREFIX = "/sapi/shop/public/";
    private static final String STAFF_DRAFTS_PATH = "/sapi/shop/staff/order-drafts";
    private static final String STATUS_PREFIX = "/sapi/order-buffer/";
    private static final String HEALTH_PATH = "/health";
    private static final String REDIS_KEY_PREFIX = "shop:order-buffer:item:";
    private static final String REDIS_QUEUE_KEY = "shop:order-buffer:queue";
    private static final String REDIS_PUBLIC_CACHE_PREFIX = "shop:order-buffer:public-cache:";

    private final Config config;
    private final Redis redis;
    private final HttpClient http;
    private final ScheduledExecutorService replayExecutor = Executors.newSingleThreadScheduledExecutor();
    private final AtomicBoolean replaying = new AtomicBoolean(false);

    private OrderBufferService(Config config) {
        this.config = config;
        this.redis = new Redis(config.redisHost(), config.redisPort(), config.redisTimeoutMs());
        this.http = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(config.upstreamConnectTimeoutMs()))
                .version(HttpClient.Version.HTTP_1_1)
                .build();
    }

    public static void main(String[] args) throws Exception {
        Config config = Config.fromEnvironment();
        OrderBufferService app = new OrderBufferService(config);
        app.start();
    }

    private void start() throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress(config.bindHost(), config.port()), 64);
        server.createContext(CREATE_PATH, this::handleCreate);
        server.createContext(PUBLIC_PATH_PREFIX, this::handleCachedPublicGet);
        server.createContext(STAFF_DRAFTS_PATH, this::handleStaffDrafts);
        server.createContext(STATUS_PREFIX, this::handleStatus);
        server.createContext(HEALTH_PATH, this::handleHealth);
        server.setExecutor(Executors.newFixedThreadPool(config.httpThreads()));
        server.start();
        replayExecutor.scheduleWithFixedDelay(this::replaySafely, 1, config.replayIntervalMs(), TimeUnit.MILLISECONDS);
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            server.stop(1);
            replayExecutor.shutdownNow();
        }, "order-buffer-shutdown"));
        System.out.printf(Locale.ROOT,
                "%s order-buffer listening on http://%s:%d, upstream=%s, redis=%s:%d%n",
                Instant.now(), config.bindHost(), config.port(), config.upstreamBase(),
                config.redisHost(), config.redisPort());
    }

    private void handleCreate(HttpExchange exchange) throws IOException {
        if (!CREATE_PATH.equals(exchange.getRequestURI().getPath())) {
            json(exchange, 404, "{\"error\":\"Not found\"}");
            return;
        }
        if (!"POST".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "POST");
            json(exchange, 405, "{\"error\":\"Method not allowed\"}");
            return;
        }

        byte[] body;
        try {
            body = readLimited(exchange.getRequestBody(), config.maxBodyBytes());
        } catch (BodyTooLargeException error) {
            json(exchange, 413, "{\"error\":\"Order payload is too large\"}");
            return;
        }
        if (body.length == 0) {
            json(exchange, 400, "{\"error\":\"Order payload is empty\"}");
            return;
        }

        BufferedRequest request = BufferedRequest.create(exchange, body);
        try {
            UpstreamResponse upstream = forward(request, config.normalRequestTimeoutMs());
            respond(exchange, upstream.status(), upstream.contentType(), upstream.body());
        } catch (ConnectException | HttpConnectTimeoutException error) {
            queueAndRespond(exchange, request, error);
        } catch (IOException error) {
            // A restart can close an already-open socket. Persist rather than lose the customer's order.
            queueAndRespond(exchange, request, error);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            json(exchange, 503, "{\"error\":\"Order receiver interrupted\"}");
        }
    }

    private void queueAndRespond(HttpExchange exchange, BufferedRequest request, Exception cause) throws IOException {
        try {
            redis.setEx(REDIS_KEY_PREFIX + request.id(), request.encode(), config.queueTtlSeconds());
            redis.rpush(REDIS_QUEUE_KEY, request.id());
            String statusUrl = STATUS_PREFIX + request.id();
            String body = "{\"queued\":true,\"queueId\":\"" + request.id()
                    + "\",\"state\":\"QUEUED\",\"statusUrl\":\"" + statusUrl
                    + "\",\"message\":\"Order saved safely while the main service restarts\"}";
            System.out.printf("%s queued order request %s (%s)%n", Instant.now(), request.id(), oneLine(cause));
            json(exchange, 202, body);
        } catch (RuntimeException redisError) {
            System.err.printf("%s cannot queue order: %s%n", Instant.now(), oneLine(redisError));
            json(exchange, 503, "{\"error\":\"Main service and durable order buffer are unavailable\"}");
        }
    }

    /**
     * Cache the public data needed to open the customer ordering screen. Healthy responses refresh
     * Redis; during a main-JAR restart the last successful copy is served without keeping it in this
     * service's heap. Dynamic order/status endpoints are deliberately excluded.
     */
    private void handleCachedPublicGet(HttpExchange exchange) throws IOException {
        String path = exchange.getRequestURI().getPath();
        if (!isCacheablePublicPath(path)) {
            json(exchange, 404, "{\"error\":\"Not found\"}");
            return;
        }
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "GET");
            json(exchange, 405, "{\"error\":\"Method not allowed\"}");
            return;
        }

        String target = exchange.getRequestURI().toString();
        // One snapshot per URL. Time-zone-specific keys leave a first customer unable to order
        // during a restart merely because another browser warmed the same shop in another zone.
        String cacheKey = REDIS_PUBLIC_CACHE_PREFIX + sha256(target);
        CachedResponse cached = cachedResponse(cacheKey);
        if (cached == null) {
            String timeZone = first(exchange.getRequestHeaders(), "X-Time-Zone", "");
            cached = cachedResponse(REDIS_PUBLIC_CACHE_PREFIX + sha256(target + "\n" + timeZone));
        }
        if (cached == null) {
            cached = cachedResponse(REDIS_PUBLIC_CACHE_PREFIX + sha256(target + "\n"));
        }
        try {
            UpstreamResponse upstream = forwardGet(exchange, Math.min(config.normalRequestTimeoutMs(), 2_500L));
            if (upstream.status() >= 200 && upstream.status() < 300) {
                CachedResponse fresh = new CachedResponse(
                        upstream.status(), upstream.contentType(), upstream.body(), Instant.now().toString());
                redis.setEx(cacheKey, fresh.encode(), config.publicCacheTtlSeconds());
                exchange.getResponseHeaders().set("X-Order-Buffer-Cache", "REFRESHED");
                respond(exchange, upstream.status(), upstream.contentType(), upstream.body());
                return;
            }
            if (upstream.status() >= 500 && cached != null) {
                respondCached(exchange, cached);
                return;
            }
            respond(exchange, upstream.status(), upstream.contentType(), upstream.body());
        } catch (ConnectException | HttpConnectTimeoutException error) {
            respondFromCacheOrUnavailable(exchange, cached);
        } catch (IOException error) {
            respondFromCacheOrUnavailable(exchange, cached);
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
            respondFromCacheOrUnavailable(exchange, cached);
        }
    }

    /** Read-only Redis fallback for the counter's temporary-order list during a main-JAR restart. */
    private void handleStaffDrafts(HttpExchange exchange) throws IOException {
        boolean readOnlyRequest = "GET".equalsIgnoreCase(exchange.getRequestMethod());
        try {
            long timeoutMs = readOnlyRequest
                    ? Math.min(config.normalRequestTimeoutMs(), 2_500L)
                    : config.normalRequestTimeoutMs();
            UpstreamResponse upstream = forwardExchange(exchange, timeoutMs);
            if (!readOnlyRequest || upstream.status() < 500) {
                respond(exchange, upstream.status(), upstream.contentType(), upstream.body());
                return;
            }
        } catch (ConnectException | HttpConnectTimeoutException ignored) {
            // A GET can fall through to Redis; writes require the main service.
        } catch (IOException ignored) {
            // A restart can close an already-open upstream connection.
        } catch (InterruptedException error) {
            Thread.currentThread().interrupt();
        }
        if (!readOnlyRequest) {
            json(exchange, 503, "{\"error\":\"Editing temporary orders requires the main service\"}");
            return;
        }
        respondStaffDraftsFromRedis(exchange);
    }

    private void respondStaffDraftsFromRedis(HttpExchange exchange) throws IOException {
        Headers headers = exchange.getRequestHeaders();
        if (!hasActiveRedisSession(headers)) {
            json(exchange, 401, "{\"authenticated\":false,\"message\":\"Not authenticated\"}");
            return;
        }
        String tenantId = first(headers, "X-Tenant-Id", "");
        String companyId = first(headers, "X-Company-Id", "");
        if (!isUuid(tenantId) || !isUuid(companyId)) {
            json(exchange, 400, "{\"error\":\"Tenant and company context are required\"}");
            return;
        }

        String pattern = "shop:order-draft:" + tenantId + ":" + companyId + ":*";
        LinkedHashSet<String> values = new LinkedHashSet<>();
        for (String key : redis.keys(pattern)) {
            String value = redis.get(key);
            if (value != null && value.stripLeading().startsWith("{")) values.add(value);
        }

        String path = exchange.getRequestURI().getPath();
        String tablePrefix = STAFF_DRAFTS_PATH + "/table/";
        if (path.startsWith(tablePrefix)) {
            String tableId = path.substring(tablePrefix.length());
            if (tableId.contains("/") || !isUuid(tableId)) {
                json(exchange, 404, "{\"error\":\"Not found\"}");
                return;
            }
            String draftId = queryParam(exchange.getRequestURI().getRawQuery(), "draftId");
            String tableNeedle = "\"tableId\":\"" + tableId + "\"";
            String draftNeedle = draftId.isBlank() ? "" : "\"draftId\":\"" + draftId + "\"";
            for (String value : values) {
                if (value.contains(tableNeedle) && (draftNeedle.isBlank() || value.contains(draftNeedle))) {
                    exchange.getResponseHeaders().set("X-Order-Buffer-Source", "REDIS");
                    json(exchange, 200, value);
                    return;
                }
            }
            exchange.sendResponseHeaders(204, -1);
            exchange.close();
            return;
        }

        StringBuilder body = new StringBuilder("[");
        for (String value : values) {
            if (body.length() > 1) body.append(',');
            body.append(value);
        }
        body.append(']');
        exchange.getResponseHeaders().set("X-Order-Buffer-Source", "REDIS");
        json(exchange, 200, body.toString());
    }

    private boolean hasActiveRedisSession(Headers headers) {
        String cookieHeader = first(headers, "Cookie", "");
        for (String cookie : cookieHeader.split(";")) {
            String[] pair = cookie.trim().split("=", 2);
            if (pair.length != 2 || !("SESSION".equals(pair[0]) || "JSESSIONID".equals(pair[0]))) continue;
            String cookieValue = URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
            if (redis.exists("anhmedia:http-session:sessions:" + cookieValue)) return true;
            try {
                String sessionId = new String(Base64.getDecoder().decode(cookieValue), StandardCharsets.UTF_8);
                if (redis.exists("anhmedia:http-session:sessions:" + sessionId)) return true;
            } catch (IllegalArgumentException ignored) {
                // Not a Base64-encoded Spring Session cookie.
            }
        }
        return false;
    }

    private static String queryParam(String rawQuery, String name) {
        if (rawQuery == null || rawQuery.isBlank()) return "";
        for (String part : rawQuery.split("&")) {
            String[] pair = part.split("=", 2);
            if (URLDecoder.decode(pair[0], StandardCharsets.UTF_8).equals(name)) {
                return pair.length == 2 ? URLDecoder.decode(pair[1], StandardCharsets.UTF_8) : "";
            }
        }
        return "";
    }

    private CachedResponse cachedResponse(String key) {
        try {
            String encoded = redis.get(key);
            return encoded == null ? null : CachedResponse.decode(encoded);
        } catch (RuntimeException invalidOrUnavailable) {
            return null;
        }
    }

    private void respondFromCacheOrUnavailable(HttpExchange exchange, CachedResponse cached) throws IOException {
        if (cached != null) {
            respondCached(exchange, cached);
        } else {
            json(exchange, 503, "{\"error\":\"Menu is temporarily unavailable and has not been cached yet\"}");
        }
    }

    private static void respondCached(HttpExchange exchange, CachedResponse cached) throws IOException {
        exchange.getResponseHeaders().set("X-Order-Buffer-Cache", "STALE");
        exchange.getResponseHeaders().set("X-Order-Buffer-Cached-At", cached.cachedAt());
        exchange.getResponseHeaders().set("Warning", "110 - Response is from the last available shop snapshot");
        respond(exchange, cached.status(), cached.contentType(), cached.body());
    }

    private static boolean isCacheablePublicPath(String path) {
        if ((PUBLIC_PATH_PREFIX + "menu").equals(path)
                || (PUBLIC_PATH_PREFIX + "menu-options").equals(path)
                || (PUBLIC_PATH_PREFIX + "shop-config").equals(path)
                || (PUBLIC_PATH_PREFIX + "tables").equals(path)
                || (PUBLIC_PATH_PREFIX + "ordering-status").equals(path)
                || (PUBLIC_PATH_PREFIX + "localized-labels").equals(path)) {
            return true;
        }
        String tokenPrefix = PUBLIC_PATH_PREFIX + "token/";
        return path.startsWith(tokenPrefix) && path.length() > tokenPrefix.length()
                && path.indexOf('/', tokenPrefix.length()) < 0;
    }

    private void handleStatus(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            exchange.getResponseHeaders().set("Allow", "GET");
            json(exchange, 405, "{\"error\":\"Method not allowed\"}");
            return;
        }
        String path = exchange.getRequestURI().getPath();
        String id = path.startsWith(STATUS_PREFIX) ? path.substring(STATUS_PREFIX.length()) : "";
        if (!isUuid(id)) {
            json(exchange, 400, "{\"error\":\"Invalid queue id\"}");
            return;
        }
        String encoded = redis.get(REDIS_KEY_PREFIX + id);
        if (encoded == null) {
            json(exchange, 404, "{\"error\":\"Buffered order not found or expired\"}");
            return;
        }
        BufferedRequest request = BufferedRequest.decode(encoded);
        StringBuilder result = new StringBuilder(256);
        result.append("{\"queueId\":\"").append(jsonEscape(request.id())).append("\"")
                .append(",\"state\":\"").append(jsonEscape(request.state())).append("\"")
                .append(",\"createdAt\":\"").append(jsonEscape(request.createdAt())).append("\"")
                .append(",\"attempts\":").append(request.attempts());
        if (!request.lastError().isBlank()) {
            result.append(",\"lastError\":\"").append(jsonEscape(request.lastError())).append("\"");
        }
        if (request.upstreamStatus() > 0) {
            result.append(",\"upstreamStatus\":").append(request.upstreamStatus());
        }
        if (!request.responseBody().isBlank()) {
            result.append(",\"response\":").append(asJsonValue(request.responseBody()));
        }
        result.append('}');
        json(exchange, 200, result.toString());
    }

    private void handleHealth(HttpExchange exchange) throws IOException {
        if (!"GET".equalsIgnoreCase(exchange.getRequestMethod())) {
            json(exchange, 405, "{\"error\":\"Method not allowed\"}");
            return;
        }
        try {
            redis.ping();
            json(exchange, 200, "{\"status\":\"UP\",\"redis\":\"UP\"}");
        } catch (RuntimeException error) {
            json(exchange, 503, "{\"status\":\"DOWN\",\"redis\":\"DOWN\"}");
        }
    }

    private void replaySafely() {
        if (!replaying.compareAndSet(false, true)) return;
        try {
            replayQueued();
        } catch (Exception error) {
            System.err.printf("%s replay scan failed: %s%n", Instant.now(), oneLine(error));
        } finally {
            replaying.set(false);
        }
    }

    private void replayQueued() {
        List<String> ids = redis.lrange(REDIS_QUEUE_KEY, 0, config.replayBatchSize() - 1L);
        for (String id : ids) {
            String key = REDIS_KEY_PREFIX + id;
            String encoded = redis.get(key);
            if (encoded == null) {
                redis.lrem(REDIS_QUEUE_KEY, 0, id);
                continue;
            }
            BufferedRequest request;
            try {
                request = BufferedRequest.decode(encoded);
            } catch (RuntimeException invalid) {
                redis.lrem(REDIS_QUEUE_KEY, 0, id);
                System.err.printf("%s dropped invalid buffered request %s%n", Instant.now(), id);
                continue;
            }
            if (!"QUEUED".equals(request.state())) {
                redis.lrem(REDIS_QUEUE_KEY, 0, id);
                continue;
            }
            if (!retryDue(request)) continue;

            BufferedRequest attempted = request.withAttempt(oneLine(null));
            try {
                UpstreamResponse response = forward(attempted, config.replayRequestTimeoutMs());
                if ((response.status() >= 200 && response.status() < 300)
                        || (response.status() >= 400 && response.status() < 500 && response.status() != 408 && response.status() != 429)) {
                    String state = response.status() < 300 ? "COMPLETED" : "REJECTED";
                    BufferedRequest completed = attempted.withResponse(state, response.status(), response.body());
                    redis.setEx(key, completed.encode(), config.queueTtlSeconds());
                    redis.lrem(REDIS_QUEUE_KEY, 0, id);
                    System.out.printf("%s replayed %s -> HTTP %d (%s)%n", Instant.now(), id, response.status(), state);
                } else {
                    if (attempted.attempts() >= config.maxServerErrorAttempts()) {
                        BufferedRequest rejected = attempted.withResponse("REJECTED", response.status(), response.body());
                        redis.setEx(key, rejected.encode(), config.queueTtlSeconds());
                        redis.lrem(REDIS_QUEUE_KEY, 0, id);
                        System.err.printf("%s stopped replaying %s after %d server errors%n",
                                Instant.now(), id, attempted.attempts());
                    } else {
                        redis.setEx(key, attempted.withError("Upstream HTTP " + response.status()).encode(), config.queueTtlSeconds());
                    }
                }
            } catch (Exception error) {
                redis.setEx(key, attempted.withError(oneLine(error)).encode(), config.queueTtlSeconds());
                return;
            }
        }
    }

    private boolean retryDue(BufferedRequest request) {
        if (request.lastAttemptAt().isBlank() || request.attempts() <= 0) return true;
        try {
            int exponent = Math.min(request.attempts() - 1, 10);
            long multiplier = 1L << exponent;
            long delay = Math.min(config.retryMaxDelayMs(), config.retryBaseDelayMs() * multiplier);
            return !Instant.now().isBefore(Instant.parse(request.lastAttemptAt()).plusMillis(delay));
        } catch (RuntimeException invalidTimestamp) {
            return true;
        }
    }

    private UpstreamResponse forward(BufferedRequest request, long timeoutMs) throws IOException, InterruptedException {
        URI uri = URI.create(config.upstreamBase() + request.target());
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(timeoutMs))
                .POST(HttpRequest.BodyPublishers.ofString(request.body(), StandardCharsets.UTF_8))
                .header("Content-Type", request.contentType())
                .header("X-Order-Buffer-Id", request.id());
        putHeader(builder, "X-Time-Zone", request.timeZone());
        putHeader(builder, "Accept-Language", request.acceptLanguage());
        putHeader(builder, "X-App-Language", request.appLanguage());
        putHeader(builder, "X-Forwarded-For", request.forwardedFor());
        putHeader(builder, "X-Forwarded-Proto", request.forwardedProto());
        putHeader(builder, "X-Real-IP", request.realIp());
        putHeader(builder, "User-Agent", request.userAgent());
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        String contentType = response.headers().firstValue("Content-Type").orElse("application/json; charset=utf-8");
        return new UpstreamResponse(response.statusCode(), contentType, response.body());
    }

    private UpstreamResponse forwardGet(HttpExchange exchange, long timeoutMs) throws IOException, InterruptedException {
        URI uri = URI.create(config.upstreamBase() + exchange.getRequestURI());
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofMillis(timeoutMs))
                .GET();
        copyForwardHeaders(builder, exchange.getRequestHeaders());
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        String contentType = response.headers().firstValue("Content-Type").orElse("application/json; charset=utf-8");
        return new UpstreamResponse(response.statusCode(), contentType, response.body());
    }

    private UpstreamResponse forwardExchange(HttpExchange exchange, long timeoutMs) throws IOException, InterruptedException {
        byte[] body;
        try {
            body = readLimited(exchange.getRequestBody(), config.maxBodyBytes());
        } catch (BodyTooLargeException error) {
            throw new IOException("Request payload is too large", error);
        }
        HttpRequest.BodyPublisher publisher = body.length == 0
                ? HttpRequest.BodyPublishers.noBody()
                : HttpRequest.BodyPublishers.ofByteArray(body);
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(config.upstreamBase() + exchange.getRequestURI()))
                .timeout(Duration.ofMillis(timeoutMs))
                .method(exchange.getRequestMethod().toUpperCase(Locale.ROOT), publisher);
        copyForwardHeaders(builder, exchange.getRequestHeaders());
        HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        String contentType = response.headers().firstValue("Content-Type").orElse("application/json; charset=utf-8");
        return new UpstreamResponse(response.statusCode(), contentType, response.body());
    }

    private static void copyForwardHeaders(HttpRequest.Builder builder, Headers headers) {
        putHeader(builder, "X-Time-Zone", first(headers, "X-Time-Zone", ""));
        putHeader(builder, "Accept-Language", first(headers, "Accept-Language", ""));
        putHeader(builder, "X-App-Language", first(headers, "X-App-Language", ""));
        putHeader(builder, "X-Forwarded-For", first(headers, "X-Forwarded-For", ""));
        putHeader(builder, "X-Forwarded-Proto", first(headers, "X-Forwarded-Proto", ""));
        putHeader(builder, "X-Real-IP", first(headers, "X-Real-IP", ""));
        putHeader(builder, "User-Agent", first(headers, "User-Agent", ""));
        putHeader(builder, "Cookie", first(headers, "Cookie", ""));
        putHeader(builder, "X-Tenant-Id", first(headers, "X-Tenant-Id", ""));
        putHeader(builder, "X-Company-Id", first(headers, "X-Company-Id", ""));
        putHeader(builder, "X-Username", first(headers, "X-Username", ""));
        putHeader(builder, "Content-Type", first(headers, "Content-Type", ""));
    }

    private static void putHeader(HttpRequest.Builder builder, String name, String value) {
        if (value != null && !value.isBlank()) builder.header(name, value);
    }

    private static byte[] readLimited(InputStream input, int limit) throws IOException, BodyTooLargeException {
        try (input; ByteArrayOutputStream output = new ByteArrayOutputStream(Math.min(limit, 8192))) {
            byte[] buffer = new byte[8192];
            int total = 0;
            int read;
            while ((read = input.read(buffer)) >= 0) {
                total += read;
                if (total > limit) throw new BodyTooLargeException();
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private static void json(HttpExchange exchange, int status, String body) throws IOException {
        respond(exchange, status, "application/json; charset=utf-8", body);
    }

    private static void respond(HttpExchange exchange, int status, String contentType, String body) throws IOException {
        byte[] bytes = (body == null ? "" : body).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType == null ? "application/json; charset=utf-8" : contentType);
        exchange.getResponseHeaders().set("Cache-Control", "no-store");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }

    private static boolean isUuid(String value) {
        try {
            UUID.fromString(value);
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private static String oneLine(Throwable error) {
        if (error == null) return "";
        String message = error.getClass().getSimpleName() + ": " + String.valueOf(error.getMessage());
        return message.replace('\n', ' ').replace('\r', ' ');
    }

    private static String first(Headers headers, String name, String fallback) {
        String value = headers.getFirst(name);
        return value == null ? fallback : value;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String jsonEscape(String value) {
        if (value == null) return "";
        StringBuilder out = new StringBuilder(value.length() + 16);
        for (int i = 0; i < value.length(); i++) {
            char c = value.charAt(i);
            switch (c) {
                case '"' -> out.append("\\\"");
                case '\\' -> out.append("\\\\");
                case '\b' -> out.append("\\b");
                case '\f' -> out.append("\\f");
                case '\n' -> out.append("\\n");
                case '\r' -> out.append("\\r");
                case '\t' -> out.append("\\t");
                default -> {
                    if (c < 0x20) out.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
                    else out.append(c);
                }
            }
        }
        return out.toString();
    }

    private static String asJsonValue(String value) {
        String trimmed = value == null ? "" : value.trim();
        if ((trimmed.startsWith("{") && trimmed.endsWith("}"))
                || (trimmed.startsWith("[") && trimmed.endsWith("]"))) return trimmed;
        return "{\"error\":\"" + jsonEscape(trimmed) + "\"}";
    }

    private record UpstreamResponse(int status, String contentType, String body) {}
    private record CachedResponse(int status, String contentType, String body, String cachedAt) {
        String encode() {
            Properties p = new Properties();
            p.setProperty("status", Integer.toString(status));
            p.setProperty("contentType", contentType);
            p.setProperty("body", body);
            p.setProperty("cachedAt", cachedAt);
            try {
                StringWriter writer = new StringWriter();
                p.store(writer, null);
                return writer.toString();
            } catch (IOException impossible) {
                throw new IllegalStateException(impossible);
            }
        }

        static CachedResponse decode(String value) {
            Properties p = new Properties();
            try {
                p.load(new StringReader(value));
            } catch (IOException error) {
                throw new IllegalArgumentException("Invalid cached response", error);
            }
            return new CachedResponse(
                    Integer.parseInt(p.getProperty("status", "200")),
                    p.getProperty("contentType", "application/json; charset=utf-8"),
                    p.getProperty("body", ""),
                    p.getProperty("cachedAt", ""));
        }
    }
    private static final class BodyTooLargeException extends Exception {}

    private record BufferedRequest(
            String id,
            String state,
            String createdAt,
            int attempts,
            String target,
            String contentType,
            String timeZone,
            String acceptLanguage,
            String appLanguage,
            String forwardedFor,
            String forwardedProto,
            String realIp,
            String userAgent,
            String body,
            int upstreamStatus,
            String responseBody,
            String lastError,
            String lastAttemptAt
    ) {
        static BufferedRequest create(HttpExchange exchange, byte[] bytes) {
            Headers headers = exchange.getRequestHeaders();
            return new BufferedRequest(
                    UUID.randomUUID().toString(), "QUEUED", Instant.now().toString(), 0,
                    exchange.getRequestURI().toString(),
                    first(headers, "Content-Type", "application/json; charset=utf-8"),
                    first(headers, "X-Time-Zone", ""),
                    first(headers, "Accept-Language", ""),
                    first(headers, "X-App-Language", ""),
                    first(headers, "X-Forwarded-For", ""),
                    first(headers, "X-Forwarded-Proto", ""),
                    first(headers, "X-Real-IP", ""),
                    first(headers, "User-Agent", ""),
                    new String(bytes, StandardCharsets.UTF_8), 0, "", "", "");
        }

        BufferedRequest withAttempt(String error) {
            return new BufferedRequest(id, state, createdAt, attempts + 1, target, contentType, timeZone,
                    acceptLanguage, appLanguage, forwardedFor, forwardedProto, realIp, userAgent,
                    body, upstreamStatus, responseBody,
                    error == null ? "" : error, Instant.now().toString());
        }

        BufferedRequest withError(String error) {
            return new BufferedRequest(id, state, createdAt, attempts, target, contentType, timeZone,
                    acceptLanguage, appLanguage, forwardedFor, forwardedProto, realIp, userAgent,
                    body, upstreamStatus, responseBody,
                    error == null ? "" : error, lastAttemptAt);
        }

        BufferedRequest withResponse(String nextState, int status, String response) {
            return new BufferedRequest(id, nextState, createdAt, attempts, target, contentType, timeZone,
                    acceptLanguage, appLanguage, forwardedFor, forwardedProto, realIp, userAgent,
                    body, status, response == null ? "" : response, "", lastAttemptAt);
        }

        String encode() {
            Properties p = new Properties();
            p.setProperty("id", id);
            p.setProperty("state", state);
            p.setProperty("createdAt", createdAt);
            p.setProperty("attempts", Integer.toString(attempts));
            p.setProperty("target", target);
            p.setProperty("contentType", contentType);
            p.setProperty("timeZone", timeZone);
            p.setProperty("acceptLanguage", acceptLanguage);
            p.setProperty("appLanguage", appLanguage);
            p.setProperty("forwardedFor", forwardedFor);
            p.setProperty("forwardedProto", forwardedProto);
            p.setProperty("realIp", realIp);
            p.setProperty("userAgent", userAgent);
            p.setProperty("body", body);
            p.setProperty("upstreamStatus", Integer.toString(upstreamStatus));
            p.setProperty("responseBody", responseBody);
            p.setProperty("lastError", lastError);
            p.setProperty("lastAttemptAt", lastAttemptAt);
            try {
                StringWriter writer = new StringWriter();
                p.store(writer, null);
                return writer.toString();
            } catch (IOException impossible) {
                throw new IllegalStateException(impossible);
            }
        }

        static BufferedRequest decode(String value) {
            Properties p = new Properties();
            try {
                p.load(new StringReader(value));
            } catch (IOException error) {
                throw new IllegalArgumentException("Invalid buffered request", error);
            }
            return new BufferedRequest(
                    required(p, "id"), p.getProperty("state", "QUEUED"), required(p, "createdAt"),
                    integer(p, "attempts"), required(p, "target"),
                    p.getProperty("contentType", "application/json; charset=utf-8"),
                    p.getProperty("timeZone", ""), p.getProperty("acceptLanguage", ""),
                    p.getProperty("appLanguage", ""), p.getProperty("forwardedFor", ""),
                    p.getProperty("forwardedProto", ""),
                    p.getProperty("realIp", ""), p.getProperty("userAgent", ""),
                    required(p, "body"), integer(p, "upstreamStatus"),
                    p.getProperty("responseBody", ""), p.getProperty("lastError", ""),
                    p.getProperty("lastAttemptAt", ""));
        }

        private static String first(Headers headers, String name, String fallback) {
            String value = headers.getFirst(name);
            return value == null ? fallback : value;
        }

        private static String required(Properties p, String key) {
            String value = p.getProperty(key);
            if (value == null) throw new IllegalArgumentException("Missing " + key);
            return value;
        }

        private static int integer(Properties p, String key) {
            try {
                return Integer.parseInt(p.getProperty(key, "0"));
            } catch (NumberFormatException error) {
                return 0;
            }
        }
    }

    private record Config(
            String bindHost,
            int port,
            String upstreamBase,
            String redisHost,
            int redisPort,
            int redisTimeoutMs,
            int httpThreads,
            int maxBodyBytes,
            int queueTtlSeconds,
            long replayIntervalMs,
            int replayBatchSize,
            int maxServerErrorAttempts,
            int publicCacheTtlSeconds,
            long retryBaseDelayMs,
            long retryMaxDelayMs,
            long upstreamConnectTimeoutMs,
            long normalRequestTimeoutMs,
            long replayRequestTimeoutMs
    ) {
        static Config fromEnvironment() {
            Map<String, String> env = System.getenv();
            return new Config(
                    env.getOrDefault("ORDER_BUFFER_HOST", "127.0.0.1"),
                    intEnv(env, "ORDER_BUFFER_PORT", 8082),
                    trimTrailingSlash(env.getOrDefault("ORDER_BUFFER_UPSTREAM", "http://127.0.0.1:8081")),
                    env.getOrDefault("REDIS_HOST", "127.0.0.1"),
                    intEnv(env, "REDIS_PORT", 6379),
                    intEnv(env, "REDIS_TIMEOUT_MS", 1500),
                    intEnv(env, "ORDER_BUFFER_HTTP_THREADS", 4),
                    intEnv(env, "ORDER_BUFFER_MAX_BODY_BYTES", 1_048_576),
                    intEnv(env, "ORDER_BUFFER_TTL_SECONDS", 172_800),
                    intEnv(env, "ORDER_BUFFER_REPLAY_INTERVAL_MS", 2_000),
                    intEnv(env, "ORDER_BUFFER_REPLAY_BATCH", 20),
                    intEnv(env, "ORDER_BUFFER_MAX_SERVER_ERROR_ATTEMPTS", 8),
                    intEnv(env, "ORDER_BUFFER_PUBLIC_CACHE_TTL_SECONDS", 604_800),
                    intEnv(env, "ORDER_BUFFER_RETRY_BASE_DELAY_MS", 2_000),
                    intEnv(env, "ORDER_BUFFER_RETRY_MAX_DELAY_MS", 30_000),
                    intEnv(env, "ORDER_BUFFER_CONNECT_TIMEOUT_MS", 1_200),
                    intEnv(env, "ORDER_BUFFER_REQUEST_TIMEOUT_MS", 30_000),
                    intEnv(env, "ORDER_BUFFER_REPLAY_TIMEOUT_MS", 30_000));
        }

        private static int intEnv(Map<String, String> env, String name, int fallback) {
            try {
                return Integer.parseInt(env.getOrDefault(name, Integer.toString(fallback)));
            } catch (NumberFormatException error) {
                return fallback;
            }
        }

        private static String trimTrailingSlash(String value) {
            String result = value;
            while (result.endsWith("/")) result = result.substring(0, result.length() - 1);
            return result;
        }
    }

    /** Minimal RESP2 client. One short-lived socket per command keeps failure handling predictable. */
    private static final class Redis {
        private final String host;
        private final int port;
        private final int timeoutMs;

        private Redis(String host, int port, int timeoutMs) {
            this.host = host;
            this.port = port;
            this.timeoutMs = timeoutMs;
        }

        void ping() { command("PING"); }
        String get(String key) { return string(command("GET", key)); }
        void setEx(String key, String value, int seconds) { command("SET", key, value, "EX", Integer.toString(seconds)); }
        void rpush(String key, String value) { command("RPUSH", key, value); }
        void lrem(String key, long count, String value) { command("LREM", key, Long.toString(count), value); }
        boolean exists(String key) { return Long.valueOf(1L).equals(command("EXISTS", key)); }

        List<String> keys(String pattern) {
            Object result = command("KEYS", pattern);
            if (!(result instanceof List<?> list)) return List.of();
            List<String> values = new ArrayList<>(list.size());
            for (Object item : list) if (item != null) values.add(String.valueOf(item));
            return values;
        }

        List<String> lrange(String key, long start, long stop) {
            Object result = command("LRANGE", key, Long.toString(start), Long.toString(stop));
            if (!(result instanceof List<?> list)) return List.of();
            List<String> values = new ArrayList<>(list.size());
            for (Object item : list) if (item != null) values.add(String.valueOf(item));
            return values;
        }

        private Object command(String... parts) {
            try (Socket socket = new Socket()) {
                socket.connect(new InetSocketAddress(host, port), timeoutMs);
                socket.setSoTimeout(timeoutMs);
                try (BufferedOutputStream output = new BufferedOutputStream(socket.getOutputStream());
                     BufferedInputStream input = new BufferedInputStream(socket.getInputStream())) {
                    writeCommand(output, parts);
                    output.flush();
                    return readReply(input);
                }
            } catch (IOException error) {
                throw new IllegalStateException("Redis unavailable", error);
            }
        }

        private static void writeCommand(OutputStream output, String[] parts) throws IOException {
            output.write(("*" + parts.length + "\r\n").getBytes(StandardCharsets.US_ASCII));
            for (String part : parts) {
                byte[] bytes = part.getBytes(StandardCharsets.UTF_8);
                output.write(("$" + bytes.length + "\r\n").getBytes(StandardCharsets.US_ASCII));
                output.write(bytes);
                output.write("\r\n".getBytes(StandardCharsets.US_ASCII));
            }
        }

        private static Object readReply(InputStream input) throws IOException {
            int marker = input.read();
            if (marker < 0) throw new IOException("Redis closed connection");
            return switch (marker) {
                case '+' -> readLine(input);
                case '-' -> throw new IOException("Redis error: " + readLine(input));
                case ':' -> Long.parseLong(readLine(input));
                case '$' -> readBulk(input);
                case '*' -> readArray(input);
                default -> throw new IOException("Unknown Redis reply: " + (char) marker);
            };
        }

        private static String readBulk(InputStream input) throws IOException {
            int length = Integer.parseInt(readLine(input));
            if (length < 0) return null;
            byte[] bytes = input.readNBytes(length);
            if (bytes.length != length) throw new IOException("Short Redis bulk reply");
            expectCrLf(input);
            return new String(bytes, StandardCharsets.UTF_8);
        }

        private static List<Object> readArray(InputStream input) throws IOException {
            int count = Integer.parseInt(readLine(input));
            if (count < 0) return List.of();
            List<Object> result = new ArrayList<>(count);
            for (int i = 0; i < count; i++) result.add(readReply(input));
            return result;
        }

        private static String readLine(InputStream input) throws IOException {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream(64);
            int previous = -1;
            int current;
            while ((current = input.read()) >= 0) {
                if (previous == '\r' && current == '\n') {
                    byte[] value = bytes.toByteArray();
                    return new String(value, 0, Math.max(0, value.length - 1), StandardCharsets.UTF_8);
                }
                bytes.write(current);
                previous = current;
            }
            throw new IOException("Incomplete Redis line");
        }

        private static void expectCrLf(InputStream input) throws IOException {
            if (input.read() != '\r' || input.read() != '\n') throw new IOException("Invalid Redis bulk terminator");
        }

        private static String string(Object value) {
            return value == null ? null : String.valueOf(value);
        }
    }
}
