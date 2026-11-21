package com.ams.bomcore.service.portalcontent;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Facebook group posting campaigns, ported from the legacy Portal
 * {@code ProductGroupPostForm} (views/product/ProductGroupPostForm.java).
 *
 * <p>Concept: a "user" in {@code usertb} that belongs to a marketing group
 * ({@code usergrouptb} / {@code marketinggrouptb}) represents one Facebook
 * group; its username is the group URL/ID. One campaign posts the chosen
 * products across the chosen groups, one row per group, staggered in time.
 *
 * <p>Writes exactly what the legacy form writes: one {@code schedulelogtb} row
 * per group with platform=Facebook, mediaType=group_post, status=pending
 * (no {@code appscheduletb} row) — the Chrome add-on picks these up through the
 * legacy Portal {@code GET /api/ext/queue}. Each row gets a per-group/per-product
 * click-tracking token in {@code access_tokens} (token_type GROUP_POST_TRACK),
 * appended to the product link as {@code ?t=<base62 id>}.
 */
@Service
public class PortalGroupPostService {
    public static final String LINK_PLACEHOLDER = "{{link}}";
    private static final String BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    private static final int MAX_ROWS = 500;

    private final PortalTenantDataSourceRegistry tenants;

    public PortalGroupPostService(PortalTenantDataSourceRegistry tenants) {
        this.tenants = tenants;
    }

    // ---- reads ----

    public Options options(String tenantId) {
        return run(tenantId, db -> {
            List<MarketingGroup> groups = db.query("""
                    SELECT g.stringid, g.groupname,
                           (SELECT count(DISTINCT m.username) FROM usergrouptb m WHERE m.groupstringid = g.stringid) AS members
                      FROM marketinggrouptb g
                     ORDER BY g.groupname
                    """, (r, n) -> new MarketingGroup(clean(r.getString("stringid")),
                    text(r.getString("groupname"), r.getString("stringid")), r.getInt("members")));
            List<Campaign> campaigns = db.query("""
                    SELECT code, name FROM marketing_campaign
                     WHERE coalesce(active, true) = true AND coalesce(code,'') <> ''
                     ORDER BY created_time DESC NULLS LAST, id DESC
                    """, (r, n) -> new Campaign(clean(r.getString("code")), text(r.getString("name"), r.getString("code"))));
            return new Options(groups, campaigns);
        });
    }

    /** Facebook groups (marketing users) in the chosen marketing groups; all of them when none chosen. */
    public List<Member> members(String tenantId, List<String> groupIds) {
        List<String> ids = groupIds == null ? List.of() : groupIds.stream().map(PortalGroupPostService::clean)
                .filter(s -> !s.isEmpty()).distinct().toList();
        return run(tenantId, db -> {
            String filter = ids.isEmpty() ? "" : " WHERE m.groupstringid IN (" + String.join(",", ids.stream().map(i -> "?").toList()) + ")";
            List<Member> rows = db.query("""
                    SELECT m.username, min(trim(coalesce(u.firstname,'') || ' ' || coalesce(u.lastname,''))) AS name,
                           string_agg(DISTINCT coalesce(g.groupname, m.groupstringid), ', ') AS groups
                      FROM usergrouptb m
                      JOIN usertb u ON u.username = m.username
                      LEFT JOIN marketinggrouptb g ON g.stringid = m.groupstringid
                    """ + filter + """
                     GROUP BY m.username
                     ORDER BY m.username
                    """, (r, n) -> new Member(clean(r.getString("username")), clean(r.getString("name")),
                    clean(r.getString("groups"))), ids.toArray());
            return rows.stream().filter(m -> !m.username().isEmpty()).toList();
        });
    }

    public List<GroupPostView> recent(String tenantId) {
        return run(tenantId, db -> db.query("""
                SELECT id, relatedcode, targetusername, postmessage, scheduledtime, timezone, status,
                       lasterror, createdby, attemptcount
                  FROM schedulelogtb
                 WHERE visible = true AND platform = 'Facebook' AND mediatype = 'group_post'
                 ORDER BY scheduledtime DESC NULLS LAST, id DESC
                 LIMIT 300
                """, (r, n) -> new GroupPostView(r.getLong("id"), clean(r.getString("relatedcode")),
                clean(r.getString("targetusername")), clean(r.getString("postmessage")),
                r.getTimestamp("scheduledtime") == null ? null : r.getTimestamp("scheduledtime").toLocalDateTime(),
                clean(r.getString("timezone")), clean(r.getString("status")), clean(r.getString("lasterror")),
                clean(r.getString("createdby")), r.getInt("attemptcount"))));
    }

    // ---- preview (no writes) ----

    /**
     * Builds one row per chosen Facebook group: products spread evenly in
     * order (legacy productForRowIndex), times start + i * interval, message
     * from the legacy "append sequence". The tracked link is the
     * {@link #LINK_PLACEHOLDER}; it is resolved per row on save.
     */
    public List<PreviewRow> preview(String tenantId, PreviewRequest request) {
        if (request == null) throw new IllegalArgumentException("Campaign is required");
        List<String> usernames = request.usernames() == null ? List.of()
                : request.usernames().stream().map(PortalGroupPostService::clean).filter(s -> !s.isEmpty()).distinct().toList();
        if (usernames.isEmpty()) throw new IllegalArgumentException("Choose at least one Facebook group");
        if (usernames.size() > MAX_ROWS) throw new IllegalArgumentException("At most " + MAX_ROWS + " groups per campaign");
        List<Integer> productIds = request.productIds() == null ? List.of() : request.productIds().stream().distinct().toList();
        if (productIds.isEmpty()) throw new IllegalArgumentException("Choose at least one product");
        String sequence = clean(request.sequence());
        if (!sequence.matches("[0-7]*")) throw new IllegalArgumentException("Sequence may only contain digits 0-7");
        ZoneId zone = zone(request.timezone());
        int interval = request.intervalMinutes() == null ? 10 : request.intervalMinutes();
        if (interval < 0 || interval > 1440) throw new IllegalArgumentException("Minutes between posts must be 0-1440");
        LocalDateTime start = request.startAt() == null
                ? LocalDateTime.now(zone).plusHours(1).withSecond(0).withNano(0) : request.startAt().withNano(0);

        return run(tenantId, db -> {
            List<Product> products = new ArrayList<>();
            for (Integer id : productIds) products.add(product(db, id));
            Map<String, String> tokens = new HashMap<>();
            tokens.put("1", tokenCampaignText(db, "hashtag_token"));
            tokens.put("5", tokenCampaignText(db, "facebook_page_access_token"));
            Map<String, String> names = new LinkedHashMap<>();
            for (Member m : members(tenantId, List.of())) names.put(m.username(), m.name());

            List<PreviewRow> rows = new ArrayList<>();
            for (int i = 0; i < usernames.size(); i++) {
                Product product = productForRow(i, usernames.size(), products);
                String username = usernames.get(i);
                rows.add(new PreviewRow(username, names.getOrDefault(username, ""), product.id(), product.code(),
                        product.name(), start.plusMinutes((long) interval * i), message(product, sequence, tokens)));
            }
            return rows;
        });
    }

    // ---- save ----

    public SaveResult save(String tenantId, SaveRequest request, String actor) {
        if (request == null || request.rows() == null || request.rows().isEmpty())
            throw new IllegalArgumentException("Generate rows first");
        if (request.rows().size() > MAX_ROWS) throw new IllegalArgumentException("At most " + MAX_ROWS + " rows per campaign");
        ZoneId zoneId = zone(request.timezone());
        String zone = zoneId.getId();
        String normalizedTenant = PortalTenantDataSourceRegistry.normalizeTenantId(tenantId);
        String createdBy = text(actor, "admin");
        DataSource source = tenants.dataSource(tenantId);
        JdbcTemplate db = new JdbcTemplate(source);
        TransactionTemplate tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        try {
            String campaignCode = clean(request.campaignCode());
            String campaignName = campaignCode.isEmpty() ? "" : db.query(
                    "SELECT name FROM marketing_campaign WHERE code = ?", (r, n) -> clean(r.getString("name")), campaignCode)
                    .stream().findFirst().orElseThrow(() -> new IllegalArgumentException("Unknown campaign: " + campaignCode));
            java.util.Set<String> knownGroups = new java.util.HashSet<>(
                    members(tenantId, List.of()).stream().map(Member::username).toList());

            List<Long> ids = tx.execute(status -> {
                Map<Integer, Product> products = new HashMap<>();
                List<Long> created = new ArrayList<>();
                int index = 0;
                for (SaveRow row : request.rows()) {
                    index++;
                    String username = clean(row.username());
                    if (!knownGroups.contains(username))
                        throw new IllegalArgumentException("Row " + index + ": not a marketing group member: " + username);
                    if (row.productId() == null) throw new IllegalArgumentException("Row " + index + ": choose a product");
                    if (row.scheduledAt() == null) throw new IllegalArgumentException("Row " + index + ": no time set");
                    String message = clean(row.message());
                    if (message.isEmpty()) throw new IllegalArgumentException("Row " + index + ": empty message");
                    if (message.length() > 5000) throw new IllegalArgumentException("Row " + index + ": message over 5000 characters");
                    Product product = products.computeIfAbsent(row.productId(), id -> product(db, id));
                    LocalDateTime local = row.scheduledAt().withNano(0);
                    LocalDateTime utc = local.atZone(zoneId).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();

                    if (message.contains(LINK_PLACEHOLDER)) {
                        String url = productUrl(normalizedTenant, product);
                        if (url.isEmpty()) throw new IllegalArgumentException("Row " + index + ": product " + product.code() + " has no link path");
                        String token = ensureTrackingToken(db, username, url, campaignCode,
                                campaignName + " - " + product.name());
                        message = message.replace(LINK_PLACEHOLDER, url + "?t=" + token);
                    }
                    created.add(db.queryForObject("""
                            INSERT INTO schedulelogtb
                                (relatedpath, relatedcode, relatedtype, platform, mediatype, targetusername, targetaccountid,
                                 postmessage, imageurls, videodmid, scheduledtime, scheduledtimeutc, timezone, status,
                                 createdby, attemptcount, lasterror, createdtime, modifiedtime, visible,
                                 tiktokautoaddmusic, tiktokallowrepost, tiktokallowcomment, tiktokallowduet,
                                 tiktokallowstitch, tiktokprivacylevel)
                            VALUES (?, ?, 'product', 'Facebook', 'group_post', ?, '', ?, ?, ?, ?, ?, ?, 'pending',
                                    ?, 0, '', ?, ?, true, false, false, true, false, false, 'SELF_ONLY')
                            RETURNING id
                            """, Long.class,
                            product.path(), product.code(), username, message, product.image(), product.video(),
                            Timestamp.valueOf(local), Timestamp.valueOf(utc), zone, createdBy, now(), now()));
                }
                return created;
            });
            return new SaveResult(ids == null ? 0 : ids.size());
        } catch (DataAccessException exception) {
            throw new IllegalStateException("Portal database operation failed for tenant " + normalizedTenant, exception);
        }
    }

    /** Only rows the add-on has not picked up yet (status pending) can be cancelled. */
    public void cancel(String tenantId, long logId) {
        int updated = run(tenantId, db -> db.update("""
                UPDATE schedulelogtb SET status = 'cancelled', modifiedtime = ?
                 WHERE id = ? AND status = 'pending' AND mediatype = 'group_post' AND visible = true
                """, now(), logId));
        if (updated == 0) throw new IllegalArgumentException("Only pending group posts can be cancelled");
    }

    // ---- helpers ----

    /** Legacy ensureAccessToken: reuse the enabled token for (campaign, product URL, group), else create one. */
    private String ensureTrackingToken(JdbcTemplate db, String username, String url, String campaignCode, String description) {
        List<String> existing = db.query("""
                SELECT idbase62, id FROM access_tokens
                 WHERE coalesce(campaign_string_id,'') = ? AND place_id = ? AND username = ? AND enable = true
                 ORDER BY id LIMIT 1
                """, (r, n) -> {
            String b = clean(r.getString("idbase62"));
            return b.isEmpty() || "none".equals(b) ? base62(r.getLong("id")) : b;
        }, campaignCode, url, username);
        if (!existing.isEmpty()) return existing.get(0);
        LocalDateTime now = LocalDateTime.now();
        Long id = db.queryForObject("""
                INSERT INTO access_tokens
                    (idbase62, username, token_type, place_id, place_type, place_description, access_count,
                     lastclicktime, createdtime, expiredtime, enable, visible, campaign_string_id)
                VALUES ('none', ?, 'GROUP_POST_TRACK', ?, 'PRODUCT', ?, 0, ?, ?, ?, true, true, ?)
                RETURNING id
                """, Long.class, username, url, description.length() > 255 ? description.substring(0, 255) : description,
                Timestamp.valueOf(now), Timestamp.valueOf(now), Timestamp.valueOf(now.plusYears(2)), campaignCode);
        String token = base62(id);
        db.update("UPDATE access_tokens SET idbase62 = ? WHERE id = ?", token, id);
        return token;
    }

    /** Legacy buildMessage, digit by digit (0 name, 1 hashtag token, 2 brand, 3 catalog, 4 sub-catalog, 5 page line, 6 link, 7 code). */
    static String message(Product p, String sequence, Map<String, String> tokens) {
        StringBuilder sb = new StringBuilder(p.shortDescription());
        if (sequence.isEmpty()) {
            appendIfAbsent(sb, "\n" + LINK_PLACEHOLDER);
            return sb.toString().trim();
        }
        for (char c : sequence.toCharArray()) {
            switch (c) {
                case '0' -> { if (!p.name().isEmpty()) sb = new StringBuilder(p.name() + (sb.toString().isBlank() ? "" : "\n") + sb); }
                case '1' -> { if (!tokens.getOrDefault("1", "").isEmpty()) appendIfAbsent(sb, "\n" + tokens.get("1")); }
                case '2' -> { if (!p.brand().isEmpty()) appendIfAbsent(sb, " #" + hashtag(p.brand())); }
                case '3' -> { if (!p.catalog().isEmpty()) appendIfAbsent(sb, " #" + hashtag(p.catalog())); }
                case '4' -> { if (!p.subCatalog().isEmpty()) appendIfAbsent(sb, "\n#" + hashtag(p.subCatalog())); }
                case '5' -> { if (!tokens.getOrDefault("5", "").isEmpty()) appendIfAbsent(sb, "\n" + tokens.get("5")); }
                case '6' -> appendIfAbsent(sb, "\n" + LINK_PLACEHOLDER);
                case '7' -> { if (!p.code().isEmpty()) appendIfAbsent(sb, "\n" + p.code()); }
                default -> { }
            }
        }
        return sb.toString().trim();
    }

    /** Legacy productForRowIndex: even blocks in product order, remainder on the last products. */
    static <T> T productForRow(int rowIndex, int totalRows, List<T> products) {
        int productCount = Math.min(products.size(), Math.max(totalRows, 1));
        int base = totalRows / productCount, remainder = totalRows % productCount, cursor = 0;
        for (int i = 0; i < productCount; i++) {
            int count = base + (i >= productCount - remainder ? 1 : 0);
            if (rowIndex < cursor + count) return products.get(i);
            cursor += count;
        }
        return products.get(productCount - 1);
    }

    static String base62(long value) {
        if (value == 0) return "0";
        StringBuilder sb = new StringBuilder();
        long v = value;
        while (v > 0) { sb.append(BASE62.charAt((int) (v % 62))); v /= 62; }
        return sb.reverse().toString();
    }

    private static String productUrl(String tenant, Product p) {
        return p.path().isEmpty() ? "" : "https://" + tenant + "/san-pham/" + p.path();
    }

    private String tokenCampaignText(JdbcTemplate db, String tokenType) {
        return db.query("""
                SELECT marketingcampaign FROM tokentb WHERE tokentype = ? AND isvisible = true
                 ORDER BY createdtime DESC LIMIT 1
                """, (r, n) -> legacy(r.getString("marketingcampaign")), tokenType).stream().findFirst().orElse("");
    }

    private Product product(JdbcTemplate db, Integer id) {
        if (id == null) throw new IllegalArgumentException("Choose a product");
        List<Product> rows = db.query("""
                SELECT id, productname, productcode, path, productshortdes, productbrand, productcatalog,
                       productsubcatalog, productimageurl1, productvideoadd
                  FROM producttb WHERE id = ?
                """, (r, n) -> {
            // Legacy Product.getDailymotionVideoId(): parsed from the productVideoAdd URL.
            String video;
            try { video = PortalScheduleService.videoId(legacy(r.getString("productvideoadd"))); }
            catch (IllegalArgumentException notDailymotion) { video = ""; }
            return new Product(r.getInt("id"), legacy(r.getString("productname")), legacy(r.getString("productcode")),
                    legacy(r.getString("path")), legacy(r.getString("productshortdes")), legacy(r.getString("productbrand")),
                    legacy(r.getString("productcatalog")), legacy(r.getString("productsubcatalog")),
                    legacy(r.getString("productimageurl1")), video);
        }, id);
        if (rows.isEmpty()) throw new IllegalArgumentException("Product not found: " + id);
        Product p = rows.get(0);
        if (p.code().isEmpty()) throw new IllegalArgumentException("Product " + id + " has no product code");
        return p;
    }

    private static void appendIfAbsent(StringBuilder sb, String text) {
        if (!sb.toString().contains(text.trim())) sb.append(text);
    }
    private static String hashtag(String value) { return value.toLowerCase().replace(" ", "_"); }
    /** Legacy columns use "none" for empty and escape delete/update (Utilities.ValidateInputValue). */
    private static String legacy(String value) {
        String v = clean(value);
        if ("none".equalsIgnoreCase(v)) return "";
        return v.replace("del.ete_", "delete").replace("up.date_", "update");
    }
    private static ZoneId zone(String value) {
        String z = text(value, PortalScheduleService.DEFAULT_ZONE);
        try { return ZoneId.of(z); } catch (Exception e) { throw new IllegalArgumentException("Unknown time zone: " + z); }
    }
    private static Timestamp now() { return Timestamp.valueOf(LocalDateTime.now(ZoneOffset.UTC)); }
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
    record Product(int id, String name, String code, String path, String shortDescription, String brand, String catalog,
                   String subCatalog, String image, String video) {}

    public record MarketingGroup(String id, String name, int members) {}
    public record Campaign(String code, String name) {}
    public record Options(List<MarketingGroup> groups, List<Campaign> campaigns) {}
    public record Member(String username, String name, String groups) {}
    public record PreviewRequest(List<Integer> productIds, List<String> usernames, String sequence,
                                 LocalDateTime startAt, Integer intervalMinutes, String timezone) {}
    public record PreviewRow(String username, String name, int productId, String productCode, String productName,
                             LocalDateTime scheduledAt, String message) {}
    public record SaveRow(String username, Integer productId, LocalDateTime scheduledAt, String message) {}
    public record SaveRequest(String campaignCode, String timezone, List<SaveRow> rows) {}
    public record SaveResult(int saved) {}
    public record GroupPostView(long id, String productCode, String groupUrl, String message, LocalDateTime scheduledAt,
                                String timezone, String status, String lastError, String createdBy, int attempts) {}
}
