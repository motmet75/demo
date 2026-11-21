package com.ams.bomcore.service.portalcontent;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Media (social post) schedules of a Portal website tenant.
 *
 * <p>Writes the same rows as the legacy Portal "Schedule media post" form: one
 * {@code schedulelogtb} row with the post content, plus one {@code appscheduletb}
 * row whose {@code actionvalue} is that log id. The legacy Portal dispatcher
 * (runs every minute on Portal 8080) picks up due schedules and posts them,
 * so this service never talks to Facebook, YouTube or TikTok itself.
 */
@Service
public class PortalScheduleService {
    public static final String DEFAULT_ZONE = "Asia/Ho_Chi_Minh";
    private static final String FACEBOOK_PAGE_TOKEN_TYPE = "facebook_page_access_token";
    private static final String FACEBOOK_PAGE_TARGET_PREFIX = "facebook-page:";
    private static final Pattern DAILYMOTION_ID = Pattern.compile("(?:video=|/video/|dai\\.ly/)([A-Za-z0-9]+)");
    private static final Pattern PLAIN_VIDEO_ID = Pattern.compile("^[A-Za-z0-9]{5,20}$");
    private static final List<String> TIKTOK_PRIVACY =
            List.of("PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY");

    /** Supported actions, with the platform/media type/label the legacy form stores. */
    private static final Map<String, Action> ACTIONS = Map.of(
            "post_facebook_multi_image", new Action("Facebook", "multi_image", "Facebook Images", false, true),
            "post_facebook_video", new Action("Facebook", "video", "Facebook Video", true, true),
            "post_youtube_video", new Action("YouTube", "video", "YouTube Video", true, false),
            "post_tiktok_video", new Action("TikTok", "video", "TikTok Video", true, false),
            "post_tiktok_image", new Action("TikTok", "multi_image", "TikTok Images", false, false));

    private final PortalTenantDataSourceRegistry tenants;

    public PortalScheduleService(PortalTenantDataSourceRegistry tenants) {
        this.tenants = tenants;
    }

    // ---- reads ----

    public List<ScheduleView> schedules(String tenantId) {
        String sql = """
                SELECT s.id, s.schedulename, s.actionname, s.relatedcode, s.starttime, s.timezone,
                       s.isenable, s.createdtime, l.id AS logid, l.platform, l.mediatype, l.status,
                       l.lasterror, l.createdby, l.postmessage, l.imageurls, l.videodmid,
                       l.targetusername, l.targetaccountid
                  FROM appscheduletb s
                  LEFT JOIN schedulelogtb l
                    ON l.id = CASE WHEN s.actionvalue ~ '^[0-9]{1,18}$' THEN CAST(s.actionvalue AS bigint) END
                 WHERE s.isvisible = true AND s.scheduletype = 'SOCIAL_POST'
                 ORDER BY s.starttime DESC NULLS LAST, s.id DESC
                 LIMIT 300
                """;
        return run(tenantId, db -> db.query(sql, this::schedule));
    }

    /** Facebook Pages that have a stored page token. Never returns the token itself. */
    public List<FacebookPage> facebookPages(String tenantId) {
        String sql = """
                SELECT userstringid, abtestgroup, marketingcampaign
                  FROM tokentb
                 WHERE tokentype = ? AND isvisible = true
                   AND coalesce(userstringid,'') NOT IN ('', 'none')
                   AND coalesce(token,'') NOT IN ('', 'none')
                 ORDER BY createdtime DESC
                """;
        List<FacebookPage> rows = run(tenantId, db -> db.query(sql, (row, n) -> new FacebookPage(
                row.getString("userstringid"), clean(row.getString("abtestgroup")),
                clean(row.getString("marketingcampaign"))), FACEBOOK_PAGE_TOKEN_TYPE));
        List<FacebookPage> unique = new ArrayList<>();
        for (FacebookPage page : rows)
            if (unique.stream().noneMatch(p -> p.pageId().equals(page.pageId()))) unique.add(page);
        return unique;
    }

    // ---- writes ----

    public List<ScheduleView> create(String tenantId, ScheduleRequest request, String actor) {
        if (request == null) throw new IllegalArgumentException("Schedule is required");
        if (request.actions() == null || request.actions().isEmpty())
            throw new IllegalArgumentException("Choose at least one platform");
        String zone = text(request.timezone(), DEFAULT_ZONE);
        ZoneId zoneId;
        try { zoneId = ZoneId.of(zone); }
        catch (Exception exception) { throw new IllegalArgumentException("Unknown time zone: " + zone); }
        LocalDateTime local = request.scheduledAt() == null
                ? LocalDateTime.now(zoneId).plusMinutes(1) : request.scheduledAt().withNano(0);
        LocalDateTime utc = local.atZone(zoneId).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        if (utc.isBefore(LocalDateTime.now(ZoneOffset.UTC).minusMinutes(5)))
            throw new IllegalArgumentException("Scheduled time is in the past");
        String message = text(request.message(), "");
        if (message.isEmpty()) throw new IllegalArgumentException("Post message is required");
        if (message.length() > 5000) throw new IllegalArgumentException("Post message must be at most 5000 characters");
        String createdBy = text(actor, "admin");
        String normalizedTenant = PortalTenantDataSourceRegistry.normalizeTenantId(tenantId);

        DataSource source = tenants.dataSource(tenantId);
        JdbcTemplate db = new JdbcTemplate(source);
        TransactionTemplate tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        try {
            List<Long> created = tx.execute(status -> {
                Product product = product(db, request.productId());
                List<String> images = images(request.imageUrls(), product.imageUrls());
                String videoId = videoId(text(request.videoId(), product.video()));
                String title = text(request.title(), product.name());
                List<Long> ids = new ArrayList<>();
                for (String actionName : new LinkedHashSet<>(request.actions())) {
                    Action action = ACTIONS.get(actionName);
                    if (action == null) throw new IllegalArgumentException("Unsupported platform action: " + actionName);
                    if (action.video() && videoId.isEmpty())
                        throw new IllegalArgumentException(action.label() + " needs a Dailymotion video id");
                    if (!action.video() && images.isEmpty())
                        throw new IllegalArgumentException(action.label() + " needs at least one image");
                    String target;
                    String accountId = "";
                    if (action.facebookPage()) {
                        String pageId = text(request.facebookPageId(), "");
                        if (facebookPages(normalizedTenant).stream().noneMatch(p -> p.pageId().equals(pageId)))
                            throw new IllegalArgumentException("Choose a Facebook Page that has a stored page token");
                        target = FACEBOOK_PAGE_TARGET_PREFIX + pageId;
                        accountId = pageId;
                    } else {
                        target = title.length() > 255 ? title.substring(0, 255) : title;
                    }
                    String privacy = text(request.tiktokPrivacyLevel(), "PUBLIC_TO_EVERYONE");
                    if (!TIKTOK_PRIVACY.contains(privacy)) throw new IllegalArgumentException("Unknown TikTok privacy level");

                    Long logId = db.queryForObject("""
                            INSERT INTO schedulelogtb
                                (relatedpath, relatedcode, relatedtype, platform, mediatype, postmessage, imageurls,
                                 videodmid, scheduledtime, scheduledtimeutc, timezone, status, createdtime, modifiedtime,
                                 visible, targetusername, targetaccountid, tiktokprivacylevel, createdby)
                            VALUES (?, ?, 'product', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, true, ?, ?, ?, ?)
                            RETURNING id
                            """, Long.class,
                            product.path(), product.code(), action.platform(), action.mediaType(), message,
                            action.video() ? "" : String.join("\n", images), action.video() ? videoId : "",
                            Timestamp.valueOf(local), Timestamp.valueOf(utc), zone, now(), now(),
                            target, accountId, privacy, createdBy);
                    String name = action.label() + ": " + product.name();
                    Long scheduleId = db.queryForObject("""
                            INSERT INTO appscheduletb
                                (schedulename, schedulecode, schedulestringid, scheduletype, relatedcode, actionname,
                                 actionvalue, repeatingrange, recure, recurevalue, starttime, endtime, createdtime,
                                 modifiedtime, isenable, islocked, isvisible, timezone, starttimeutc, endtimeutc)
                            VALUES (?, 'none', ?, 'SOCIAL_POST', ?, ?, ?, 'none', 0, 'none', ?, ?, ?, ?,
                                    true, false, true, ?, ?, ?)
                            RETURNING id
                            """, Long.class,
                            name.length() > 255 ? name.substring(0, 255) : name, normalizedTenant, product.code(),
                            actionName, String.valueOf(logId), Timestamp.valueOf(local), Timestamp.valueOf(local),
                            now(), now(), zone, Timestamp.valueOf(utc), Timestamp.valueOf(utc));
                    ids.add(scheduleId);
                }
                return ids;
            });
            List<Long> createdIds = created == null ? List.of() : created;
            return schedules(tenantId).stream().filter(s -> createdIds.contains(s.id())).toList();
        } catch (DataAccessException exception) {
            throw new IllegalStateException("Portal database operation failed for tenant " + normalizedTenant, exception);
        }
    }

    /** Cancels a schedule that has not run yet (the dispatcher only runs enabled rows). */
    public void cancel(String tenantId, long scheduleId) {
        DataSource source = tenants.dataSource(tenantId);
        JdbcTemplate db = new JdbcTemplate(source);
        TransactionTemplate tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        try {
            tx.executeWithoutResult(status -> {
                List<String> values = db.queryForList("""
                        UPDATE appscheduletb SET isenable = false, modifiedtime = ?
                         WHERE id = ? AND isenable = true AND isvisible = true AND scheduletype = 'SOCIAL_POST'
                        RETURNING actionvalue
                        """, String.class, now(), scheduleId);
                if (values.isEmpty()) throw new IllegalArgumentException("Only pending schedules can be cancelled");
                String logId = values.get(0);
                if (logId != null && logId.matches("^[0-9]+$"))
                    db.update("UPDATE schedulelogtb SET status = 'cancelled', modifiedtime = ? WHERE id = ? AND status IN ('pending','retrying')",
                            now(), Long.parseLong(logId));
            });
        } catch (DataAccessException exception) {
            throw new IllegalStateException("Portal database operation failed", exception);
        }
    }

    // ---- helpers ----

    private Product product(JdbcTemplate db, Integer productId) {
        if (productId == null) throw new IllegalArgumentException("Choose a product");
        List<Product> rows = db.query("""
                SELECT productname, productcode, path, productimageurl1, productvideoadd
                  FROM producttb WHERE id = ?
                """, (row, n) -> new Product(clean(row.getString("productname")), clean(row.getString("productcode")),
                clean(row.getString("path")), clean(row.getString("productimageurl1")),
                clean(row.getString("productvideoadd"))), productId);
        if (rows.isEmpty()) throw new IllegalArgumentException("Product not found");
        Product product = rows.get(0);
        if (product.code().isEmpty()) throw new IllegalArgumentException("Product has no product code");
        return product;
    }

    private static List<String> images(List<String> requested, String productImages) {
        List<String> source = requested != null && !requested.isEmpty() ? requested
                : Arrays.asList(productImages.split("\n"));
        List<String> result = new ArrayList<>();
        for (String value : source) {
            String url = value == null ? "" : value.trim();
            if (url.isEmpty() || "none".equalsIgnoreCase(url)) continue;
            if (!url.startsWith("https://") && !url.startsWith("http://"))
                throw new IllegalArgumentException("Image URLs must start with http(s): " + url);
            if (!result.contains(url)) result.add(url);
        }
        if (result.size() > 35) throw new IllegalArgumentException("At most 35 images per post");
        return result;
    }

    /** Accepts a Dailymotion id or URL (the product video field stores the player URL). */
    static String videoId(String value) {
        String v = value == null ? "" : value.trim();
        if (v.isEmpty() || "none".equalsIgnoreCase(v)) return "";
        Matcher m = DAILYMOTION_ID.matcher(v);
        if (m.find()) return m.group(1);
        if (PLAIN_VIDEO_ID.matcher(v).matches()) return v;
        throw new IllegalArgumentException("Video must be a Dailymotion video id or URL");
    }

    private ScheduleView schedule(ResultSet row, int ignored) throws SQLException {
        Long logId = row.getObject("logid") == null ? null : row.getLong("logid");
        String message = clean(row.getString("postmessage"));
        String images = clean(row.getString("imageurls"));
        String target = clean(row.getString("targetusername"));
        String account = clean(row.getString("targetaccountid"));
        if (account.isEmpty() && target.startsWith(FACEBOOK_PAGE_TARGET_PREFIX))
            account = target.substring(FACEBOOK_PAGE_TARGET_PREFIX.length());
        boolean enabled = row.getBoolean("isenable");
        String status = clean(row.getString("status"));
        if (status.isEmpty()) status = enabled ? "pending" : "done";
        return new ScheduleView(row.getLong("id"), clean(row.getString("schedulename")), clean(row.getString("actionname")),
                clean(row.getString("relatedcode")), time(row, "starttime"), clean(row.getString("timezone")), enabled,
                logId, clean(row.getString("platform")), clean(row.getString("mediatype")), status,
                clean(row.getString("lasterror")), clean(row.getString("createdby")), message,
                images.isEmpty() ? 0 : (int) Arrays.stream(images.split("\n")).filter(s -> !s.isBlank()).count(),
                clean(row.getString("videodmid")), account);
    }

    private static Timestamp now() { return Timestamp.valueOf(LocalDateTime.now(ZoneOffset.UTC)); }
    private static LocalDateTime time(ResultSet row, String field) throws SQLException {
        Timestamp value = row.getTimestamp(field);
        return value == null ? null : value.toLocalDateTime();
    }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
    private static String text(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }

    private <T> T run(String tenantId, Work<T> work) {
        try { return work.run(new JdbcTemplate(tenants.dataSource(tenantId))); }
        catch (DataAccessException exception) {
            throw new IllegalStateException("Portal database operation failed for tenant "
                    + PortalTenantDataSourceRegistry.normalizeTenantId(tenantId), exception);
        }
    }

    @FunctionalInterface private interface Work<T> { T run(JdbcTemplate db); }
    private record Action(String platform, String mediaType, String label, boolean video, boolean facebookPage) {}
    private record Product(String name, String code, String path, String imageUrls, String video) {}

    public record FacebookPage(String pageId, String name, String contactLine) {}
    public record ScheduleRequest(Integer productId, List<String> actions, String message, String title,
                                  List<String> imageUrls, String videoId, String facebookPageId,
                                  String tiktokPrivacyLevel, LocalDateTime scheduledAt, String timezone) {}
    public record ScheduleView(long id, String name, String actionName, String productCode, LocalDateTime startTime,
                               String timezone, boolean enabled, Long logId, String platform, String mediaType,
                               String status, String lastError, String createdBy, String message, int imageCount,
                               String videoId, String facebookPageId) {}
}
