package com.ams.bomcore.service.portalcontent;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.time.DateTimeException;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Queues Facebook posts for many Portal products at once, with optional repeat rounds.
 *
 * Writes the same rows the Portal's own bulk scheduler writes (ScheduleLogTB + AppScheduleTB in the
 * Portal tenant database); the Portal's AppScheduleDispatcher posts them every minute. Product
 * content (images, path) is always read from producttb on the server, never trusted from the browser.
 */
@Service
public class PortalSocialScheduleService {
    static final String FACEBOOK_PAGE_TOKEN_TYPE = "facebook_page_access_token";
    static final int MAX_PRODUCTS = 100;
    static final int MAX_ROUNDS = 52;
    static final int MAX_POSTS = 2000;
    static final int MAX_IMAGES = 30;

    private final PortalTenantDataSourceRegistry tenants;

    public PortalSocialScheduleService(PortalTenantDataSourceRegistry tenants) {
        this.tenants = tenants;
    }

    // ── Facebook Pages connected in the Portal tenant ─────────────────────────

    public List<FacebookPage> facebookPages(String tenantId) {
        String sql = """
                SELECT userstringid, abtestgroup FROM tokentb
                 WHERE isvisible = true AND tokentype = ?
                   AND coalesce(userstringid,'') NOT IN ('', 'none')
                   AND coalesce(token,'') NOT IN ('', 'none')
                 ORDER BY createdtime DESC
                """;
        List<FacebookPage> rows = access(tenantId, db -> db.query(sql, (row, i) -> {
            String id = row.getString("userstringid").trim();
            String label = row.getString("abtestgroup");
            String name = label == null || label.isBlank() || "none".equalsIgnoreCase(label.trim()) ? id : label.trim();
            return new FacebookPage(id, name);
        }, FACEBOOK_PAGE_TOKEN_TYPE));
        Map<String, FacebookPage> unique = new LinkedHashMap<>();
        rows.forEach(page -> unique.putIfAbsent(page.id(), page));
        return new ArrayList<>(unique.values());
    }

    // ── Bulk schedule ─────────────────────────────────────────────────────────

    public ScheduleResult schedule(String tenantId, BulkRequest request, String actor) {
        String tenant = PortalTenantDataSourceRegistry.normalizeTenantId(tenantId);
        if (request == null) throw new IllegalArgumentException("Schedule request is required");
        ZoneId zone = zone(request.timezone());
        List<ItemRequest> items = request.items() == null ? List.of() : request.items();
        if (items.isEmpty()) throw new IllegalArgumentException("Select at least one product");
        if (items.size() > MAX_PRODUCTS) throw new IllegalArgumentException("At most " + MAX_PRODUCTS + " products per batch");

        Set<String> known = new LinkedHashSet<>();
        facebookPages(tenant).forEach(page -> known.add(page.id()));
        List<String> pages = request.pageIds() == null ? List.of()
                : request.pageIds().stream().filter(id -> id != null && !id.isBlank()).map(String::trim).distinct().sorted().toList();
        if (pages.isEmpty()) throw new IllegalArgumentException("Choose at least one Facebook Page");
        for (String page : pages)
            if (!known.contains(page)) throw new IllegalArgumentException("Facebook Page " + page + " is not connected in " + tenant);

        Repeat repeat = request.repeat() == null ? new Repeat(1, 7, "DAYS") : request.repeat();
        int rounds = repeat.times() < 1 ? 1 : repeat.times();
        if (rounds > MAX_ROUNDS) throw new IllegalArgumentException("Repeat at most " + MAX_ROUNDS + " times");
        if (rounds > 1 && repeat.every() < 1) throw new IllegalArgumentException("Repeat period must be at least 1");
        String unit = repeat.unit() == null ? "DAYS" : repeat.unit().trim().toUpperCase();
        if (!List.of("HOURS", "DAYS", "WEEKS").contains(unit)) throw new IllegalArgumentException("Repeat unit must be HOURS, DAYS or WEEKS");
        int total = items.size() * pages.size() * rounds;
        if (total > MAX_POSTS) throw new IllegalArgumentException(total + " posts would be queued; the limit is " + MAX_POSTS);

        // Validate every product before writing anything.
        LocalDateTime now = LocalDateTime.now(zone);
        Map<Integer, ProductContent> products = new LinkedHashMap<>();
        List<String> errors = new ArrayList<>();
        LocalDateTime first = null, last = null;
        for (ItemRequest item : items) {
            ProductContent product = products.computeIfAbsent(item.productId(), id -> product(tenant, id));
            String label = product == null ? "Product #" + item.productId() : product.name();
            if (product == null) { errors.add(label + ": not found"); continue; }
            if (item.scheduledTime() == null || !item.scheduledTime().isAfter(now)) errors.add(label + ": choose a future time");
            if (item.message() == null || item.message().isBlank()) errors.add(label + ": post message is empty");
            else if (item.message().length() > 10000) errors.add(label + ": post message is longer than 10000 characters");
            if (product.imageUrls().isEmpty()) errors.add(label + ": has no image");
            if (item.scheduledTime() != null) {
                if (first == null || item.scheduledTime().isBefore(first)) first = item.scheduledTime();
                if (last == null || item.scheduledTime().isAfter(last)) last = item.scheduledTime();
            }
        }
        if (!errors.isEmpty())
            throw new IllegalArgumentException(errors.size() + " problem(s): " + String.join("; ", errors.subList(0, Math.min(5, errors.size()))));
        if (rounds > 1) {
            LocalDateTime roundEnd = last.plusMinutes(pages.size());
            if (!shift(first, 1, repeat.every(), unit).isAfter(roundEnd))
                throw new IllegalArgumentException("Repeat period is shorter than one round of posts; increase \"Repeat every\"");
        }

        String batchId = "demo-" + UUID.randomUUID().toString().substring(0, 8);
        String repeatLabel = rounds > 1 ? "every " + repeat.every() + " " + unit.toLowerCase() + " x" + rounds : "none";
        String createdBy = actor == null || actor.isBlank() ? "demo-admin" : actor.trim();
        DataSource source = tenants.dataSource(tenant);
        JdbcTemplate db = new JdbcTemplate(source);
        TransactionTemplate tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        LocalDateTime lastPost;
        try {
            lastPost = tx.execute(status -> {
                LocalDateTime latest = null;
                for (int round = 0; round < rounds; round++) {
                    for (ItemRequest item : items) {
                        ProductContent product = products.get(item.productId());
                        LocalDateTime base = shift(item.scheduledTime(), round, repeat.every(), unit);
                        int offset = 0;
                        for (String page : pages) {
                            // One minute apart per Page so the Graph API is not hit at the same instant.
                            LocalDateTime at = base.plusMinutes(offset++);
                            long logId = insertLog(db, product, page, item.message().trim(), at, zone, createdBy);
                            insertSchedule(db, tenant, product, logId, at, zone, repeatLabel, round + 1, batchId);
                            if (latest == null || at.isAfter(latest)) latest = at;
                        }
                    }
                }
                return latest;
            });
        } catch (DataAccessException exception) {
            throw new IllegalStateException("Could not queue posts in Portal tenant " + tenant + "; nothing was saved", exception);
        }
        return new ScheduleResult(batchId, total, rounds, pages.size(), first, lastPost);
    }

    // ── Upcoming batches + cancel ─────────────────────────────────────────────

    public List<BatchView> batches(String tenantId) {
        String sql = """
                SELECT a.recurevalue AS batch, max(a.repeatingrange) AS repeating,
                       count(*) AS total,
                       sum(CASE WHEN a.isenable THEN 1 ELSE 0 END) AS waiting,
                       sum(CASE WHEN l.status = 'fired' THEN 1 ELSE 0 END) AS posted,
                       sum(CASE WHEN l.status = 'failed' THEN 1 ELSE 0 END) AS failed,
                       min(a.starttime) AS first_time, max(a.starttime) AS last_time,
                       min(CASE WHEN a.isenable THEN a.starttime END) AS next_time,
                       string_agg(DISTINCT l.relatedcode, ', ') AS codes
                  FROM appscheduletb a
                  LEFT JOIN schedulelogtb l ON a.actionvalue ~ '^[0-9]+$' AND l.id = CAST(a.actionvalue AS bigint)
                 WHERE a.scheduletype = 'SOCIAL_POST' AND a.recurevalue LIKE 'demo-%' AND a.isvisible = true
                 GROUP BY a.recurevalue
                 ORDER BY max(a.createdtime) DESC
                 LIMIT 50
                """;
        return access(tenantId, db -> db.query(sql, (row, i) -> new BatchView(row.getString("batch"),
                row.getString("repeating"), row.getInt("total"), row.getInt("waiting"), row.getInt("posted"),
                row.getInt("failed"), time(row.getTimestamp("first_time")), time(row.getTimestamp("last_time")),
                time(row.getTimestamp("next_time")), row.getString("codes"))));
    }

    public int cancel(String tenantId, String batchId) {
        if (batchId == null || !batchId.matches("^demo-[0-9a-f]{8}$")) throw new IllegalArgumentException("Invalid batch");
        String tenant = PortalTenantDataSourceRegistry.normalizeTenantId(tenantId);
        DataSource source = tenants.dataSource(tenant);
        JdbcTemplate db = new JdbcTemplate(source);
        TransactionTemplate tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        try {
            Integer changed = tx.execute(status -> {
                db.update("""
                        UPDATE schedulelogtb SET status = 'cancelled', modifiedtime = ?
                         WHERE status = 'pending' AND id IN (
                               SELECT CAST(actionvalue AS bigint) FROM appscheduletb
                                WHERE recurevalue = ? AND isenable = true AND actionvalue ~ '^[0-9]+$')
                        """, nowUtc(), batchId);
                return db.update("UPDATE appscheduletb SET isenable = false, modifiedtime = ? WHERE recurevalue = ? AND isenable = true",
                        nowUtc(), batchId);
            });
            return changed == null ? 0 : changed;
        } catch (DataAccessException exception) {
            throw new IllegalStateException("Could not cancel batch in Portal tenant " + tenant, exception);
        }
    }

    // ── Rows ──────────────────────────────────────────────────────────────────

    private long insertLog(JdbcTemplate db, ProductContent product, String pageId, String message,
                           LocalDateTime at, ZoneId zone, String createdBy) {
        String sql = """
                INSERT INTO schedulelogtb
                    (relatedpath, relatedcode, relatedtype, platform, mediatype, targetusername, targetaccountid,
                     postmessage, imageurls, videodmid, tiktokautoaddmusic, tiktokallowrepost, tiktokallowcomment,
                     tiktokallowduet, tiktokallowstitch, tiktokprivacylevel, scheduledtime, timezone, scheduledtimeutc,
                     status, createdby, attemptcount, lasterror, createdtime, modifiedtime, visible)
                VALUES (?, ?, 'product', 'Facebook', 'multi_image', '', ?, ?, ?, '', false, false, true,
                        false, false, 'SELF_ONLY', ?, ?, ?, 'pending', ?, 0, '', ?, ?, true)
                RETURNING id
                """;
        LocalDateTime now = nowUtc();
        Long id = db.queryForObject(sql, Long.class, product.path(), product.code(), pageId, message,
                String.join("\n", product.imageUrls()), at, zone.getId(), toUtc(at, zone), createdBy, now, now);
        if (id == null) throw new IllegalStateException("Portal did not return a schedule log id");
        return id;
    }

    private void insertSchedule(JdbcTemplate db, String tenant, ProductContent product, long logId, LocalDateTime at,
                                ZoneId zone, String repeatLabel, int round, String batchId) {
        String name = "Facebook Images: " + product.name() + (repeatLabel.equals("none") ? "" : " (round " + round + ")");
        if (name.length() > 250) name = name.substring(0, 250);
        LocalDateTime now = nowUtc();
        db.update("""
                INSERT INTO appscheduletb
                    (schedulename, schedulecode, schedulestringid, scheduletype, relatedcode, actionname, actionvalue,
                     repeatingrange, recure, recurevalue, starttime, endtime, timezone, starttimeutc, endtimeutc,
                     createdtime, modifiedtime, isenable, islocked, isvisible)
                VALUES (?, 'none', ?, 'SOCIAL_POST', ?, 'post_facebook_multi_image', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, true, false, true)
                """, name, tenant, product.code(), String.valueOf(logId), repeatLabel, round, batchId,
                at, at, zone.getId(), toUtc(at, zone), toUtc(at, zone), now, now);
    }

    private ProductContent product(String tenant, int id) {
        List<ProductContent> rows = access(tenant, db -> db.query(
                "SELECT id, productname, productcode, productimageurl1, path FROM producttb WHERE id = ?",
                (row, i) -> new ProductContent(row.getInt("id"), text(row.getString("productname")),
                        text(row.getString("productcode")), text(row.getString("path")),
                        imageUrls(row.getString("productimageurl1"), tenant)), id));
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** Same rules as the Portal: absolute URLs kept, "/x" and bare file ids resolved on https://{tenant}. */
    static List<String> imageUrls(String raw, String tenant) {
        Set<String> urls = new LinkedHashSet<>();
        if (raw == null) return List.of();
        String host = "https://" + tenant;
        for (String line : raw.split("\\R")) {
            String url = line.trim();
            if (url.isEmpty() || "none".equalsIgnoreCase(url)) continue;
            if (url.startsWith("http://") || url.startsWith("https://")) urls.add(url);
            else if (url.startsWith("/")) urls.add(host + url);
            else urls.add(host + "/image/" + url);
            if (urls.size() >= MAX_IMAGES) break;
        }
        return new ArrayList<>(urls);
    }

    static LocalDateTime shift(LocalDateTime time, int round, int every, String unit) {
        long amount = (long) every * round;
        return switch (unit) {
            case "HOURS" -> time.plusHours(amount);
            case "WEEKS" -> time.plusWeeks(amount);
            default -> time.plusDays(amount);
        };
    }

    private static ZoneId zone(String value) {
        try { return ZoneId.of(value == null || value.isBlank() ? "Asia/Ho_Chi_Minh" : value.trim()); }
        catch (DateTimeException exception) { throw new IllegalArgumentException("Unknown time zone: " + value); }
    }

    private static LocalDateTime toUtc(LocalDateTime local, ZoneId zone) {
        return local.atZone(zone).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    private static LocalDateTime nowUtc() { return LocalDateTime.now(ZoneOffset.UTC); }
    private static LocalDateTime time(java.sql.Timestamp value) { return value == null ? null : value.toLocalDateTime(); }
    private static String text(String value) { return value == null ? "" : value.trim(); }

    private <T> T access(String tenantId, Work<T> work) {
        try { return work.run(new JdbcTemplate(tenants.dataSource(tenantId))); }
        catch (IllegalArgumentException exception) { throw exception; }
        catch (DataAccessException exception) {
            throw new IllegalStateException("Portal database operation failed for tenant "
                    + PortalTenantDataSourceRegistry.normalizeTenantId(tenantId), exception);
        }
    }

    @FunctionalInterface private interface Work<T> { T run(JdbcTemplate db); }

    private record ProductContent(int id, String name, String code, String path, List<String> imageUrls) {}

    public record FacebookPage(String id, String name) {}
    public record Repeat(int times, int every, String unit) {}
    public record ItemRequest(int productId, LocalDateTime scheduledTime, String message) {}
    public record BulkRequest(List<String> pageIds, String timezone, Repeat repeat, List<ItemRequest> items) {}
    public record ScheduleResult(String batchId, int queued, int rounds, int pages, LocalDateTime firstPost, LocalDateTime lastPost) {}
    public record BatchView(String batchId, String repeating, int total, int waiting, int posted, int failed,
                            LocalDateTime firstTime, LocalDateTime lastTime, LocalDateTime nextTime, String productCodes) {}
}
