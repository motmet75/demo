package com.ams.bomcore.service.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.fasterxml.jackson.databind.ObjectMapper;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.env.Environment;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.Security;
import java.text.NumberFormat;
import java.util.Locale;
import java.time.Instant;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;

/**
 * Send standards-based Web Push notifications to installed iOS Home Screen PWAs.
 * Subscription endpoints are private credentials: never print them in logs.
 * Does not send to arbitrary URLs (prevents SSRF from user-supplied endpoints).
 */
@Service
public class ShopWebPushService {
    private static final Logger log = LoggerFactory.getLogger(ShopWebPushService.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    private final JdbcTemplate jdbc;
    private final ThreadPoolTaskExecutor executor;
    private final String vapidPublicKey;
    private final PushService sender;

    public ShopWebPushService(JdbcTemplate jdbc,
                              @Qualifier("shopWebPushExecutor") ThreadPoolTaskExecutor executor,
                              Environment env) {
        this.jdbc = jdbc;
        this.executor = executor;
        this.vapidPublicKey = env.getProperty("APP_WEB_PUSH_PUBLIC_KEY", "").trim();
        String privateKey = env.getProperty("APP_WEB_PUSH_PRIVATE_KEY", "").trim();
        String subject = env.getProperty("APP_WEB_PUSH_SUBJECT", "mailto:services@anhmedia.vn");
        PushService configured = null;
        if (StringUtils.hasText(vapidPublicKey) && StringUtils.hasText(privateKey)) {
            try {
                if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                    Security.addProvider(new BouncyCastleProvider());
                }
                configured = new PushService(vapidPublicKey, privateKey, subject);
            } catch (Exception e) {
                log.error("SHOP WEB PUSH: invalid VAPID configuration; push disabled", e);
            }
        } else {
            log.info("SHOP WEB PUSH: disabled until APP_WEB_PUSH_PUBLIC_KEY and APP_WEB_PUSH_PRIVATE_KEY are set");
        }
        this.sender = configured;
    }

    public String publicKey() {
        if (sender == null) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE,
                    "Web Push is not configured");
        }
        return vapidPublicKey;
    }

    public void subscribe(UUID tenantId, UUID companyId, String username,
                          String endpoint, String p256dh, String auth) {
        validateSubscription(endpoint, p256dh, auth);
        String hash = endpointHash(endpoint);
        jdbc.update("""
            INSERT INTO shop_web_push_subscription
                (id, tenant_id, company_id, username, endpoint_sha256, endpoint,
                 p256dh, auth_key, enabled, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE, NOW(), NOW())
            -- Keep each subscription assigned to its registered company.
            ON CONFLICT (tenant_id, company_id, endpoint_sha256)
            DO UPDATE SET username = EXCLUDED.username,
                          endpoint = EXCLUDED.endpoint,
                          p256dh = EXCLUDED.p256dh,
                          auth_key = EXCLUDED.auth_key,
                          enabled = TRUE, updated_at = NOW()
            """,
            UUID.randomUUID(), tenantId, companyId, username, hash,
            endpoint, p256dh, auth);
    }

    public void unsubscribe(UUID tenantId, UUID companyId, String username, String endpoint) {
        if (!allowedEndpoint(endpoint)) throw new ResponseStatusException(BAD_REQUEST, "Invalid push endpoint");
        jdbc.update("""
            DELETE FROM shop_web_push_subscription
            WHERE tenant_id=? AND company_id=? AND username=? AND endpoint_sha256=?
            """, tenantId, companyId, username, endpointHash(endpoint));
    }

    public void enqueueOrderPlaced(ShopOrderResponseDto order) {
        if (sender == null || order == null
                || order.getTenantId() == null || order.getCompanyId() == null) return;
        UUID tenantId = order.getTenantId();
        UUID companyId = order.getCompanyId();
        enqueue(tenantId, companyId, null,
                orderNotificationTitle(order),
                orderNotificationBody(order),
                "order-" + order.getId());
    }

    /**
     * Keep the order of information stable for iPhone Lock Screen:
     * sequence → table → item quantity → total money → last five characters of
     * the order code (when present). Never query or expose five other orders.
     * PENDING QR orders do not have an assigned numeric sequence yet.
     */
    static String orderNotificationTitle(ShopOrderResponseDto order) {
        // A zero or negative value is not an assigned sequence (no fake "STT 0").
        Integer sequence = assignedSequence(order.getDailySeq()) != null
                ? order.getDailySeq() : assignedSequence(order.getOrderNumber());
        String title = sequence == null ? "Đơn QR mới" : "STT " + sequence;
        String table = StringUtils.hasText(order.getTableName())
                ? order.getTableName().trim() : order.getCustomerTableTag();
        if (StringUtils.hasText(table)) {
            title += " · Bàn " + table.trim();
        }
        return title;
    }

    private static Integer assignedSequence(Integer value) {
        return value != null && value > 0 ? value : null;
    }

    static String orderNotificationBody(ShopOrderResponseDto order) {
        StringBuilder text = new StringBuilder();
        BigDecimal items = BigDecimal.ZERO;
        if (order.getItems() != null) {
            for (ShopOrderResponseDto.ItemDto item : order.getItems()) {
                // A topping is a child line. Do not double-count it as a main item.
                if (item == null || item.getParentItemId() != null) continue;
                if (item.getQuantity() != null) items = items.add(item.getQuantity());
            }
        }
        text.append(formatNumber(items)).append(" món");
        if (order.getTotalAmount() != null) {
            text.append(" · ").append(formatNumber(order.getTotalAmount())).append("đ");
        }
        String codeSuffix = lastFiveCode(order.getOrderCode());
        if (codeSuffix != null) text.append(" · Mã ").append(codeSuffix);
        return text.toString();
    }

    /** Display only the last five code characters, with an ellipsis for hidden prefix. */
    static String lastFiveCode(String orderCode) {
        if (!StringUtils.hasText(orderCode)) return null;
        String code = orderCode.trim();
        return code.length() > 5 ? "…" + code.substring(code.length() - 5) : code;
    }

    private static String formatNumber(BigDecimal value) {
        NumberFormat format = NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN"));
        format.setGroupingUsed(true);
        format.setMaximumFractionDigits(2);
        return format.format(value);
    }

    /** Only test the current user's subscriptions, never broadcast test alerts. */
    public void enqueueTest(UUID tenantId, UUID companyId, String username) {
        if (sender == null) { publicKey(); return; }
        enqueue(tenantId, companyId, username,
                "AnhMedia · Kiểm tra thông báo",
                "Thông báo thử nghiệm từ QR Shop.",
                "shop-test-" + System.currentTimeMillis());
    }

    private void enqueue(UUID tenantId, UUID companyId, String username,
                         String title, String body, String tag) {
        try {
            executor.execute(() -> deliver(tenantId, companyId, username, title, body, tag));
        } catch (RuntimeException e) {
            log.warn("SHOP WEB PUSH: cannot queue delivery for company {}", companyId, e);
        }
    }

    private void deliver(UUID tenantId, UUID companyId, String username,
                         String title, String body, String tag) {
        try {
            String query = """
                SELECT id, endpoint, p256dh, auth_key
                FROM shop_web_push_subscription
                WHERE tenant_id=? AND company_id=? AND enabled=TRUE
                """ + (username == null ? "" : " AND username=?") + " ORDER BY updated_at DESC LIMIT 300";
            List<Map<String, Object>> rows = username == null
                    ? jdbc.queryForList(query, tenantId, companyId)
                    : jdbc.queryForList(query, tenantId, companyId, username);
            Map<String, String> payload = new LinkedHashMap<>();
            payload.put("title", title);
            payload.put("body", body);
            payload.put("tag", tag);
            payload.put("url", "/bom-inventory/shop-orders");
            String data = JSON.writeValueAsString(payload);
            for (Map<String, Object> row : rows) {
                UUID id = (UUID) row.get("id");
                String endpoint = (String) row.get("endpoint");
                try {
                    if (!allowedEndpoint(endpoint)) {
                        jdbc.update("UPDATE shop_web_push_subscription SET enabled=FALSE WHERE id=?", id);
                        continue;
                    }
                    Notification message = new Notification(
                            endpoint, (String) row.get("p256dh"),
                            (String) row.get("auth_key"),
                            data.getBytes(StandardCharsets.UTF_8), 3600);
                    HttpResponse response = sender.send(message);
                    int status = response.getStatusLine().getStatusCode();
                    if (status == 404 || status == 410) {
                        jdbc.update("DELETE FROM shop_web_push_subscription WHERE id=?", id);
                    } else if (status < 200 || status >= 300) {
                        log.warn("SHOP WEB PUSH: delivery failed; company={}, status={}", companyId, status);
                    }
                } catch (Exception e) {
                    log.warn("SHOP WEB PUSH: delivery error; company={}, subscriptionId={}", companyId, id, e);
                }
            }
        } catch (Exception e) {
            log.warn("SHOP WEB PUSH: failed to load subscriptions for company={}", companyId, e);
        }
    }

    private static void validateSubscription(String endpoint, String p256dh, String auth) {
        if (!allowedEndpoint(endpoint) || !StringUtils.hasText(p256dh) || !StringUtils.hasText(auth)
                || p256dh.length() > 256 || auth.length() > 256) {
            throw new ResponseStatusException(BAD_REQUEST, "Invalid Web Push subscription");
        }
    }

    /** Restrict endpoints to known push gateways, never to user-defined hosts. */
    static boolean allowedEndpoint(String endpoint) {
        if (!StringUtils.hasText(endpoint) || endpoint.length() > 4096) return false;
        try {
            URI uri = URI.create(endpoint);
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null
                    || uri.getUserInfo() != null || uri.getPort() != -1
                    || uri.getFragment() != null) return false;
            String host = uri.getHost().toLowerCase(java.util.Locale.ROOT);
            return host.endsWith(".push.apple.com")
                    || host.equals("fcm.googleapis.com")
                    || host.equals("updates.push.services.mozilla.com")
                    || host.endsWith(".notify.windows.com");
        } catch (Exception e) { return false; }
    }

    private static String endpointHash(String endpoint) {
        try {
            byte[] bytes = MessageDigest.getInstance("SHA-256")
                    .digest(endpoint.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(bytes);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
