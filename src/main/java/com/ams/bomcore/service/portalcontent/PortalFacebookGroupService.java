package com.ams.bomcore.service.portalcontent;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.net.URI;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Stores Facebook groups from pasted links, the way the legacy Portal models
 * them: one {@code usertb} row per Facebook group (username = the group URL,
 * which the Chrome add-on opens as {@code groupUrl}) that is a member of a
 * marketing group ({@code usergrouptb} / {@code marketinggrouptb}).
 *
 * <p>The rows are not login accounts: they are created disabled with a
 * password value that no encoder accepts.
 */
@Service
public class PortalFacebookGroupService {
    static final String GROUP_URL_PREFIX = "https://www.facebook.com/groups/";
    static final String NOT_A_LOGIN_PASSWORD = "!facebook-group-not-a-login";
    static final int MAX_LINKS = 200;
    private static final Pattern HOST = Pattern.compile("^(?:(?:www|m|web|mbasic|touch)\\.)?(?:facebook\\.com|fb\\.com)$");
    private static final Pattern SLUG = Pattern.compile("^[A-Za-z0-9._-]{1,128}$");
    private static final Pattern NUMERIC_ID = Pattern.compile("^[0-9]{6,25}$");

    private final PortalTenantDataSourceRegistry tenants;

    public PortalFacebookGroupService(PortalTenantDataSourceRegistry tenants) {
        this.tenants = tenants;
    }

    // ---- parsing ----

    /** One pasted line: the group link (or numeric group id) plus an optional display name around it. */
    static Parsed parseLine(String rawLine) {
        String line = rawLine == null ? "" : rawLine.strip();
        if (line.isEmpty()) return null;
        String token = null;
        for (String part : line.split("[\\s|]+")) {
            String p = part.replaceAll("^[<(\\[\"']+|[>)\\]\"',;.]+$", "");
            String lower = p.toLowerCase(Locale.ROOT);
            if (lower.contains("facebook.com/") || lower.contains("fb.com/") || lower.startsWith("groups/")
                    || NUMERIC_ID.matcher(p).matches()) { token = p; break; }
        }
        if (token == null) return new Parsed(line, null, null, "No Facebook group link found");
        String name = line.replace(token, " ").replaceAll("^[\\s|,;:<>()\\[\\]\"'\\-–—]+|[\\s|,;:<>()\\[\\]\"'\\-–—]+$", "")
                .replaceAll("\\s+", " ");
        if (name.length() > 120) name = name.substring(0, 120).strip();
        if (NUMERIC_ID.matcher(token).matches()) return new Parsed(line, token, name, null);
        String candidate = token.toLowerCase(Locale.ROOT).startsWith("groups/") ? "www.facebook.com/" + token : token;
        if (!candidate.matches("(?i)^https?://.*")) candidate = "https://" + candidate;
        URI uri;
        try { uri = URI.create(candidate); }
        catch (IllegalArgumentException bad) { return new Parsed(line, null, null, "Not a valid link"); }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!HOST.matcher(host).matches()) return new Parsed(line, null, null, "Not a Facebook link");
        String[] segments = (uri.getPath() == null ? "" : uri.getPath()).replaceAll("^/+", "").split("/+");
        if (segments.length >= 2 && segments[0].equalsIgnoreCase("share"))
            return new Parsed(line, null, null, "Share link: open it in the browser and copy the facebook.com/groups/... address");
        if (segments.length < 2 || !segments[0].equalsIgnoreCase("groups"))
            return new Parsed(line, null, null, "Not a group link (needs facebook.com/groups/...)");
        String slug = segments[1];
        if (!SLUG.matcher(slug).matches() || slug.equalsIgnoreCase("feed") || slug.equalsIgnoreCase("discover")
                || slug.equalsIgnoreCase("joins"))
            return new Parsed(line, null, null, "Cannot read the group id in this link");
        return new Parsed(line, slug, name, null);
    }

    static String groupUrl(String slug) { return GROUP_URL_PREFIX + slug; }

    /** Matches the stored username of the same group however it was written (with or without host prefix / slash). */
    static String sameGroupRegex(String slug) {
        String quoted = slug.toLowerCase(Locale.ROOT).replace(".", "\\.");
        String prefix = "(https?://)?((www|m|web|mbasic|touch)\\.)?(facebook|fb)\\.com/groups/";
        // A bare slug is only treated as the same group when it is a numeric id: a word could be a real person's username.
        return NUMERIC_ID.matcher(slug).matches() ? "^(" + prefix + ")?" + quoted + "$" : "^" + prefix + quoted + "$";
    }

    static String groupStringId(String name) {
        String ascii = Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "").replace('đ', 'd').replace('Đ', 'D')
                .toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("^-+|-+$", "");
        if (ascii.length() > 60) ascii = ascii.substring(0, 60).replaceAll("-+$", "");
        return ascii.isEmpty() ? "fb-" + System.currentTimeMillis() : "fb-" + ascii;
    }

    // ---- write ----

    public AddResult add(String tenantId, AddRequest request) {
        if (request == null) throw new IllegalArgumentException("Paste at least one Facebook group link");
        List<String> lines = (request.links() == null ? "" : request.links()).lines()
                .map(String::strip).filter(s -> !s.isEmpty()).toList();
        if (lines.isEmpty()) throw new IllegalArgumentException("Paste at least one Facebook group link");
        if (lines.size() > MAX_LINKS) throw new IllegalArgumentException("At most " + MAX_LINKS + " links at a time");
        List<Invalid> invalid = new ArrayList<>();
        Map<String, Parsed> bySlug = new LinkedHashMap<>();
        for (String line : lines) {
            Parsed p = parseLine(line);
            if (p.error() != null) invalid.add(new Invalid(line, p.error()));
            else bySlug.putIfAbsent(p.slug().toLowerCase(Locale.ROOT), p);
        }
        String existingGroup = clean(request.marketingGroupId());
        String newGroupName = clean(request.newGroupName());
        if (existingGroup.isEmpty() && newGroupName.isEmpty())
            throw new IllegalArgumentException("Choose a marketing group or type a new group name");
        if (newGroupName.length() > 120) throw new IllegalArgumentException("Marketing group name: at most 120 characters");
        if (bySlug.isEmpty()) return new AddResult(existingGroup, "", List.of(), List.of(), List.of(), invalid);

        DataSource source = tenants.dataSource(tenantId);
        JdbcTemplate db = new JdbcTemplate(source);
        TransactionTemplate tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        try {
            return tx.execute(status -> {
                MarketingGroupRow group = existingGroup.isEmpty() ? createGroup(db, newGroupName) : findGroup(db, existingGroup);
                UserInsert insert = new UserInsert(db);
                List<String> created = new ArrayList<>(), linked = new ArrayList<>(), already = new ArrayList<>();
                for (Parsed p : bySlug.values()) {
                    List<Map<String, Object>> found = db.queryForList(
                            "SELECT id, username FROM usertb WHERE lower(rtrim(username, '/')) ~ ? ORDER BY id LIMIT 1",
                            sameGroupRegex(p.slug()));
                    long userId;
                    String username;
                    boolean isNew = found.isEmpty();
                    if (isNew) {
                        username = groupUrl(p.slug());
                        String name = p.name() == null || p.name().isBlank() ? "Facebook group " + p.slug() : p.name();
                        userId = insert.insert(username, name);
                    } else {
                        userId = ((Number) found.get(0).get("id")).longValue();
                        username = String.valueOf(found.get(0).get("username"));
                    }
                    int added = db.update("""
                            INSERT INTO usergrouptb (userid, groupid, username, groupstringid, createdtime)
                            SELECT ?, ?, ?, ?, ?
                             WHERE NOT EXISTS (SELECT 1 FROM usergrouptb WHERE username = ? AND groupstringid = ?)
                            """, userId, group.id(), username, group.stringId(), now(), username, group.stringId());
                    (isNew ? created : added > 0 ? linked : already).add(username);
                }
                return new AddResult(group.stringId(), group.name(), created, linked, already, invalid);
            });
        } catch (DataAccessException exception) {
            throw new IllegalStateException("Cannot store Facebook groups (Portal database error, tenant "
                    + PortalTenantDataSourceRegistry.normalizeTenantId(tenantId) + ")", exception);
        }
    }

    private static MarketingGroupRow findGroup(JdbcTemplate db, String stringId) {
        return db.query("SELECT id, stringid, groupname FROM marketinggrouptb WHERE stringid = ?",
                        (r, n) -> new MarketingGroupRow(r.getLong("id"), r.getString("stringid"),
                                text(r.getString("groupname"), r.getString("stringid"))), stringId)
                .stream().findFirst().orElseThrow(() -> new IllegalArgumentException("Unknown marketing group: " + stringId));
    }

    private static MarketingGroupRow createGroup(JdbcTemplate db, String name) {
        List<MarketingGroupRow> sameName = db.query(
                "SELECT id, stringid, groupname FROM marketinggrouptb WHERE lower(groupname) = lower(?) ORDER BY id LIMIT 1",
                (r, n) -> new MarketingGroupRow(r.getLong("id"), r.getString("stringid"), r.getString("groupname")), name);
        if (!sameName.isEmpty()) return sameName.get(0);           // typing an existing name reuses that group
        String base = groupStringId(name), stringId = base;
        for (int i = 2; db.queryForObject("SELECT count(*) FROM marketinggrouptb WHERE stringid = ?", Integer.class, stringId) > 0; i++)
            stringId = base + "-" + i;
        Long id = db.queryForObject("INSERT INTO marketinggrouptb (stringid, groupname, createdtime) VALUES (?, ?, ?) RETURNING id",
                Long.class, stringId, name, now());
        return new MarketingGroupRow(id, stringId, name);
    }

    /**
     * Inserts a usertb row without knowing the exact production column set:
     * known columns get legacy values, any other NOT NULL column without a
     * default gets a neutral value for its type, and the id comes from the
     * column default or Hibernate's {@code hibernate_sequence}.
     */
    private static final class UserInsert {
        private final JdbcTemplate db;
        private final Map<String, Column> columns = new LinkedHashMap<>();
        private final boolean idFromSequence;

        UserInsert(JdbcTemplate db) {
            this.db = db;
            db.query("""
                    SELECT column_name, data_type, is_nullable, column_default
                      FROM information_schema.columns
                     WHERE table_schema = current_schema() AND table_name = 'usertb'
                    """, r -> {
                columns.put(r.getString("column_name").toLowerCase(Locale.ROOT), new Column(r.getString("data_type"),
                        "NO".equals(r.getString("is_nullable")), r.getString("column_default") != null));
            });
            if (columns.isEmpty()) throw new IllegalStateException("Portal database has no usertb table");
            Column id = columns.get("id");
            if (id != null && !id.hasDefault()) {
                Boolean sequence = db.queryForObject("SELECT to_regclass('hibernate_sequence') IS NOT NULL", Boolean.class);
                if (!Boolean.TRUE.equals(sequence))
                    throw new IllegalStateException("usertb.id has no default and hibernate_sequence is missing");
                idFromSequence = true;
            } else idFromSequence = false;
        }

        long insert(String username, String firstName) {
            Map<String, Object> values = new LinkedHashMap<>();
            if (idFromSequence) {
                long id = db.queryForObject("SELECT nextval('hibernate_sequence')", Long.class);
                if (db.queryForObject("SELECT count(*) FROM usertb WHERE id = ?", Integer.class, id) > 0)
                    throw new IllegalStateException("hibernate_sequence is behind usertb.id (" + id + ")");
                values.put("id", id);
            }
            Timestamp now = now();
            Map<String, Object> wanted = new LinkedHashMap<>();
            wanted.put("username", username);
            wanted.put("password", NOT_A_LOGIN_PASSWORD);
            wanted.put("firstname", firstName);
            wanted.put("lastname", "");
            wanted.put("email", "");
            wanted.put("avarta", "");
            wanted.put("isenabled", false);
            wanted.put("isallowmarketing", true);
            wanted.put("isaccountnonexpired", true);
            wanted.put("isaccountnonlocked", true);
            wanted.put("iscredentialsnonexpired", true);
            wanted.put("validationcode", "FACEBOOK_GROUP");
            wanted.put("titleandhonorific", "");
            wanted.put("phonenumber", "");
            wanted.put("leaderid", 0);
            wanted.put("createdtime", now);
            wanted.forEach((k, v) -> { if (columns.containsKey(k)) values.put(k, v); });
            columns.forEach((name, c) -> {
                if (!values.containsKey(name) && c.notNull() && !c.hasDefault() && !name.equals("id"))
                    values.put(name, neutral(c.type(), now));
            });
            String sql = "INSERT INTO usertb (" + String.join(", ", values.keySet()) + ") VALUES ("
                    + String.join(", ", values.keySet().stream().map(k -> "?").toList()) + ") RETURNING id";
            return db.queryForObject(sql, Long.class, values.values().toArray());
        }

        private static Object neutral(String type, Timestamp now) {
            String t = type == null ? "" : type.toLowerCase(Locale.ROOT);
            if (t.equals("boolean")) return false;
            if (t.contains("int") || t.equals("numeric") || t.contains("double") || t.equals("real")) return 0;
            if (t.startsWith("timestamp") || t.equals("date")) return now;
            return "";
        }

        private record Column(String type, boolean notNull, boolean hasDefault) {}
    }

    private static Timestamp now() { return Timestamp.valueOf(LocalDateTime.now()); }
    private static String clean(String value) { return value == null ? "" : value.strip(); }
    private static String text(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.strip(); }

    record Parsed(String line, String slug, String name, String error) {}
    private record MarketingGroupRow(long id, String stringId, String name) {}

    public record AddRequest(String links, String marketingGroupId, String newGroupName) {}
    public record Invalid(String line, String reason) {}
    /** created = new group rows; linked = already stored, now added to this marketing group; already = nothing to do. */
    public record AddResult(String marketingGroupId, String marketingGroupName, List<String> created, List<String> linked,
                            List<String> already, List<Invalid> invalid) {}

}
