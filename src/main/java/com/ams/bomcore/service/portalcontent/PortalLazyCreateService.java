package com.ams.bomcore.service.portalcontent;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.multipart.MultipartFile;

import javax.sql.DataSource;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.SequenceInputStream;
import java.io.UncheckedIOException;
import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * "Lazy create": one form creates a Portal product and queues its social
 * posts, ported from legacy Portal {@code AdminLazyCreateProductController#submit}
 * (the portal-live "schedule-product" page).
 *
 * <p>Media upload, unique code generation and the YouTube idea file need
 * Portal's own credentials/filesystem, so they go through the token-protected
 * loopback bridge {@code /api/internal/lazy-create} on Portal 8080
 * (LazyCreateMediaBridgeController). Everything else is written here, into the
 * same rows the legacy form writes: producttb (+ group membership),
 * access_tokens (LAZY_*_TRACK), schedulelogtb + appscheduletb (SOCIAL_POST),
 * which the legacy Portal dispatcher posts.
 */
@Service
public class PortalLazyCreateService {
    static final String TRACKED_URL = "{{TRACKED_URL}}";
    static final String PRODUCT_CODE = "{{PRODUCT_CODE}}";
    private static final String ZONE = PortalScheduleService.DEFAULT_ZONE;
    private static final Set<String> ACTIONS = Set.of("post_facebook_multi_image", "post_facebook_video",
            "post_tiktok_image", "post_tiktok_video", "post_youtube_video");
    private static final List<String> TIKTOK_PRIVACY =
            List.of("PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY");

    private final PortalTenantDataSourceRegistry tenants;
    private final PortalContentService content;
    private final PortalScheduleService schedules;
    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final String bridgeUrl;
    private final String bridgeToken;

    public PortalLazyCreateService(PortalTenantDataSourceRegistry tenants, PortalContentService content,
            PortalScheduleService schedules,
            @Value("${portal.lazy-create.bridge-url:http://127.0.0.1:8080}") String bridgeUrl,
            @Value("${portal.lazy-create.bridge-token:${customs.tariff.bridge-token:${DEMO_PORTAL_BRIDGE_TOKEN:}}}") String bridgeToken) {
        this.tenants = tenants;
        this.content = content;
        this.schedules = schedules;
        this.bridgeUrl = Objects.toString(bridgeUrl, "").replaceAll("/+$", "");
        this.bridgeToken = Objects.toString(bridgeToken, "").trim();
    }

    public Result create(String tenantId, Form form, List<MultipartFile> images, MultipartFile thumbnail,
                         MultipartFile video, String actor) {
        String tenant = PortalTenantDataSourceRegistry.normalizeTenantId(tenantId);
        String createdBy = text(actor, "admin");
        if (form == null) throw new IllegalArgumentException("Form is required");
        String name = text(form.name(), "");
        if (name.isEmpty()) throw new IllegalArgumentException("Vui lòng nhập tên sản phẩm.");
        if (name.length() > 255) throw new IllegalArgumentException("Tên sản phẩm tối đa 255 ký tự.");
        List<String> actions = form.actions() == null ? List.of() : form.actions().stream().distinct().toList();
        for (String a : actions) if (!ACTIONS.contains(a)) throw new IllegalArgumentException("Unsupported platform: " + a);

        for (String typed : new String[]{form.facebookMessage(), form.tiktokMessage(), form.youtubeDescription()})
            if (typed != null && typed.length() > 4500) throw new IllegalArgumentException("Nội dung bài đăng tối đa 4500 ký tự.");

        // ---- legacy validation, same order and messages ----
        boolean wantsImages = actions.stream().anyMatch(a -> a.endsWith("_image"));
        boolean wantsVideo = actions.stream().anyMatch(a -> a.endsWith("_video"));
        boolean wantsFacebook = actions.stream().anyMatch(a -> a.startsWith("post_facebook"));
        boolean wantsTikTok = actions.stream().anyMatch(a -> a.startsWith("post_tiktok"));
        List<MultipartFile> imageFiles = images == null ? List.of() : images.stream().filter(f -> f != null && !f.isEmpty()).toList();
        boolean hasThumbnail = thumbnail != null && !thumbnail.isEmpty();
        boolean hasVideoFile = video != null && !video.isEmpty();
        String dmAddress = text(form.dailymotionVideoAddress(), "");
        // Portal reads uploads fully into memory (legacy getBytes()); keep them bounded on this 4 GB host.
        if (imageFiles.size() > 35) throw new IllegalArgumentException("Tối đa 35 ảnh mỗi sản phẩm.");
        for (MultipartFile f : imageFiles) { requireType(f, "image/", "Ảnh"); requireSize(f, 20, "Ảnh"); }
        if (hasThumbnail) { requireType(thumbnail, "image/", "Ảnh bìa"); requireSize(thumbnail, 20, "Ảnh bìa"); }
        if (hasVideoFile) { requireType(video, "video/", "Video"); requireSize(video, 250, "Video"); }
        if (wantsImages && imageFiles.isEmpty() && !hasThumbnail)
            throw new IllegalArgumentException("Vui lòng tải ảnh trước khi chọn đăng ảnh.");
        if (wantsVideo && !hasVideoFile && dmAddress.isEmpty())
            throw new IllegalArgumentException("Vui lòng chọn video trước khi chọn đăng video.");
        ZoneId zone = ZoneId.of(ZONE);
        LocalDateTime now = LocalDateTime.now(zone);
        LocalDateTime scheduleAt = form.immediate() ? now.plusMinutes(1).withSecond(0).withNano(0)
                : form.scheduledAt() == null ? null : form.scheduledAt().withNano(0);
        if (!actions.isEmpty() && !form.immediate() && (scheduleAt == null || !scheduleAt.isAfter(now)))
            throw new IllegalArgumentException("Vui lòng chọn giờ đăng trong tương lai.");
        String pageId = text(form.facebookPageId(), "");
        if (wantsFacebook && schedules.facebookPages(tenant).stream().noneMatch(p -> p.pageId().equals(pageId)))
            throw new IllegalArgumentException("Vui lòng chọn Facebook Page đã kết nối.");
        String privacy = text(form.tiktokPrivacy(), "");
        if (wantsTikTok) {
            if (!TIKTOK_PRIVACY.contains(privacy)) throw new IllegalArgumentException("Vui lòng chọn quyền riêng tư TikTok.");
            if (!form.tiktokMusicConsent())
                throw new IllegalArgumentException("Vui lòng xác nhận yêu cầu sử dụng nhạc/nội dung TikTok.");
        }
        String catalogCode = text(form.catalog(), "");
        String brandCode = text(form.brand(), "");
        String catalogName = catalogCode.isEmpty() ? "" : nameOf(content.catalogs(tenant), catalogCode, "Danh mục");
        String brandName = brandCode.isEmpty() ? "" : nameOf(content.brands(tenant), brandCode, "Thương hiệu");
        List<String> groupCodes = form.groupCodes() == null ? List.of() : form.groupCodes();
        if (!groupCodes.isEmpty()) {
            Set<String> known = new java.util.HashSet<>(content.groups(tenant).stream().map(PortalContentService.CodeName::code).toList());
            for (String g : groupCodes) if (!known.contains(g)) throw new IllegalArgumentException("Nhóm không tồn tại: " + g);
        }

        // ---- 1. Portal bridge: unique code + Drive images + queued video + Dailymotion ----
        Media media = uploadMedia(tenant, name, createdBy, imageFiles, thumbnail, video, dmAddress, wantsVideo);
        String scheduleVideoRef = !media.queuedVideoRef().isEmpty() ? media.queuedVideoRef() : media.videoUrl();
        if (wantsVideo && scheduleVideoRef.isEmpty())
            throw new IllegalArgumentException("Không tìm thấy video dùng để đăng bài. Vui lòng tải lại tệp.");

        // ---- 2. product (legacy buildProduct) ----
        boolean approved = form.immediate() || actions.isEmpty();
        List<String> gallery = media.galleryUrls();
        String subCatalog = brandCode.isEmpty() ? name : "#" + brandCode.toLowerCase().replace(" ", "_");
        PortalContentService.ProductView product = content.createProduct(tenant, new PortalContentService.ProductWrite(
                name, media.code(), catalogCode, subCatalog, brandCode, "available", name, "<p>" + escapeHtml(name) + "</p>",
                gallery.isEmpty() ? "none" : String.join("\n", gallery), gallery.isEmpty() ? "" : gallery.get(0),
                media.videoUrl().isEmpty() ? "none" : media.videoUrl(),
                form.price() == null ? BigDecimal.ZERO : form.price(), BigDecimal.ZERO, "VND", "vi", media.path(),
                groupCodes, true, approved, false, true));

        if (actions.isEmpty()) return new Result(product.id(), product.code(), product.path(), media.host(), 0, media.warning());

        // ---- 3. tracked links + messages + schedules, one transaction ----
        String productUrl = media.host() + "/san-pham/" + product.code() + ".html";
        DataSource source = tenants.dataSource(tenant);
        JdbcTemplate db = new JdbcTemplate(source);
        TransactionTemplate tx = new TransactionTemplate(new DataSourceTransactionManager(source));
        List<Long> youtubeLogs = new ArrayList<>();
        String[] youtubeMessage = new String[1]; // per request; set inside the transaction
        try {
            Integer queued = tx.execute(status -> {
                String hashtag = tokenCampaignText(db, "hashtag_token");
                String pageLine = tokenCampaignText(db, "facebook_page_access_token");
                Post post = new Post(db, tenant, product, gallery, scheduleVideoRef, createdBy);
                int count = 0;
                if (wantsFacebook) {
                    String url = trackedUrl(db, productUrl, name, "LAZY_FB_TRACK", createdBy);
                    String msg = message(form.facebookMessage(), form.facebookSequence(), "51267", name, product.code(), url, catalogName, brandName, hashtag, pageLine);
                    boolean img = actions.contains("post_facebook_multi_image") && !gallery.isEmpty();
                    if (img) count += post.insert("post_facebook_multi_image", "Facebook", "multi_image", msg, scheduleAt,
                            "facebook-page:" + pageId, pageId, null);
                    if (actions.contains("post_facebook_video")) count += post.insert("post_facebook_video", "Facebook", "video", msg,
                            img ? scheduleAt.plusMinutes(1) : scheduleAt, "facebook-page:" + pageId, pageId, null);
                }
                if (wantsTikTok) {
                    String url = trackedUrl(db, productUrl, name, "LAZY_TT_TRACK", createdBy);
                    String msg = message(form.tiktokMessage(), form.tiktokSequence(), "127", name, product.code(), url, catalogName, brandName, hashtag, pageLine);
                    TikTok tt = new TikTok(privacy, form.tiktokAllowComment(), form.tiktokAllowDuet(), form.tiktokAllowStitch(), form.tiktokAutoAddMusic());
                    boolean img = actions.contains("post_tiktok_image") && !gallery.isEmpty();
                    if (img) count += post.insert("post_tiktok_image", "TikTok", "multi_image", msg, scheduleAt,
                            tiktokPhotoTitle(msg, name), "", tt);
                    if (actions.contains("post_tiktok_video")) count += post.insert("post_tiktok_video", "TikTok", "video", msg,
                            img ? scheduleAt.plusMinutes(1) : scheduleAt, cut(msg, 255), "", tt);
                }
                if (actions.contains("post_youtube_video")) {
                    String url = trackedUrl(db, productUrl, name, "LAZY_YT_TRACK", createdBy);
                    String msg = message(form.youtubeDescription(), form.youtubeSequence(), "5127", name, product.code(), url, catalogName, brandName, hashtag, pageLine);
                    count += post.insert("post_youtube_video", "YouTube", "video", msg, scheduleAt, cut(name, 255), "", null);
                    youtubeLogs.add(post.lastLogId);
                    youtubeMessage[0] = msg;
                }
                return count;
            });
            String warning = media.warning();
            for (Long logId : youtubeLogs) {
                try {
                    bridgeJson(tenant, "/youtube-idea", Map.of("scheduleLogId", String.valueOf(logId), "productCode", product.code(),
                            "scheduledAt", String.valueOf(scheduleAt), "source", scheduleVideoRef, "title", name,
                            "description", youtubeMessage[0] == null ? "" : youtubeMessage[0]));
                } catch (RuntimeException e) {
                    warning = (warning.isEmpty() ? "" : warning + " ") + "YouTube idea file not written: " + e.getMessage();
                }
            }
            return new Result(product.id(), product.code(), product.path(), media.host(), queued == null ? 0 : queued, warning);
        } catch (DataAccessException | IllegalArgumentException e) {
            throw new IllegalStateException("Đã tạo sản phẩm \"" + name + "\" (mã " + product.code()
                    + ") nhưng chưa lên lịch đăng bài: " + e.getMessage(), e);
        }
    }

    // ---- messages (legacy buildSequenceMessage / resolveSequenceMarkers) ----

    static String message(String typed, String sequence, String defaultSequence, String name, String code, String trackedUrl,
                          String catalogName, String brandName, String hashtag, String pageLine) {
        String msg = typed == null || typed.isBlank()
                ? sequenceMessage(name, code, trackedUrl, sequence == null ? defaultSequence : sequence,
                        catalogName, brandName, hashtag, pageLine)
                : typed;
        msg = msg.replace(TRACKED_URL, trackedUrl == null ? "" : trackedUrl).replace(PRODUCT_CODE, code == null ? "" : code);
        if (msg.length() > 5000) throw new IllegalArgumentException("Nội dung bài đăng tối đa 5000 ký tự.");
        return msg;
    }

    static String sequenceMessage(String name, String code, String trackedUrl, String sequence,
                                  String catalogName, String brandName, String hashtag, String pageLine) {
        StringBuilder m = new StringBuilder(name == null ? "" : name.trim());
        for (char c : (sequence == null ? "" : sequence.replaceAll("[^0-7]", "")).toCharArray()) {
            switch (c) {
                case '1' -> append(m, hashtag, true);
                case '2' -> append(m, socialTag(brandName), false);
                case '3' -> append(m, socialTag(catalogName), false);
                case '5' -> append(m, pageLine, true);
                case '6' -> append(m, trackedUrl, true);
                case '7' -> append(m, code, true);
                default -> { } // '0': product name is always the base; '4' unused in lazy create
            }
        }
        return m.toString().trim();
    }

    private static String socialTag(String value) {
        return value == null || value.isBlank() ? "" : "#" + value.trim().replaceAll("\\s+", "_").toLowerCase();
    }

    private static void append(StringBuilder m, String value, boolean newLine) {
        if (value == null || value.isBlank()) return;
        String part = value.trim();
        if (m.toString().contains(part)) return;
        if (m.length() > 0) m.append(newLine ? '\n' : ' ');
        m.append(part);
    }

    static String tiktokPhotoTitle(String description, String productName) {
        String t = description != null && !description.isBlank() ? description : productName;
        if (t == null || t.isBlank()) t = "Product photos";
        t = t.trim();
        return t.length() > 90 ? t.substring(0, 90) : t;
    }

    // ---- db writes ----

    /** Legacy createTrackingToken: a new LAZY_*_TRACK token per platform; link gets ?t=base62(id). */
    private String trackedUrl(JdbcTemplate db, String productUrl, String name, String type, String actor) {
        LocalDateTime now = LocalDateTime.now();
        Long id = db.queryForObject("""
                INSERT INTO access_tokens
                    (idbase62, username, token_type, place_id, place_type, place_description, access_count,
                     lastclicktime, createdtime, expiredtime, enable, visible, campaign_string_id)
                VALUES ('none', ?, ?, ?, 'PRODUCT', ?, 0, ?, ?, ?, true, true, '')
                RETURNING id
                """, Long.class, actor, type, productUrl, cut("LazyCreate[" + type + "] - " + name, 255),
                Timestamp.valueOf(now), Timestamp.valueOf(now), Timestamp.valueOf(now.plusYears(2)));
        String token = PortalGroupPostService.base62(id);
        db.update("UPDATE access_tokens SET idbase62 = ? WHERE id = ?", token, id);
        return productUrl + "?t=" + token;
    }

    private record TikTok(String privacy, boolean allowComment, boolean allowDuet, boolean allowStitch, boolean autoAddMusic) {}

    /** One schedulelogtb + appscheduletb pair, the shape legacy buildScheduleLog/saveAppSchedule write. */
    private static final class Post {
        final JdbcTemplate db; final String tenant; final PortalContentService.ProductView product;
        final List<String> gallery; final String videoRef; final String createdBy;
        long lastLogId;
        Post(JdbcTemplate db, String tenant, PortalContentService.ProductView product, List<String> gallery,
             String videoRef, String createdBy) {
            this.db = db; this.tenant = tenant; this.product = product; this.gallery = gallery;
            this.videoRef = videoRef; this.createdBy = createdBy;
        }

        int insert(String action, String platform, String mediaType, String message, LocalDateTime at,
                   String target, String accountId, TikTok tt) {
            boolean image = "multi_image".equals(mediaType);
            LocalDateTime utc = at.atZone(ZoneId.of(ZONE)).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
            Timestamp now = Timestamp.valueOf(LocalDateTime.now(ZoneOffset.UTC));
            lastLogId = db.queryForObject("""
                    INSERT INTO schedulelogtb
                        (relatedpath, relatedcode, relatedtype, platform, mediatype, targetusername, targetaccountid,
                         postmessage, imageurls, videodmid, scheduledtime, scheduledtimeutc, timezone, status,
                         createdby, attemptcount, lasterror, createdtime, modifiedtime, visible,
                         tiktokautoaddmusic, tiktokallowrepost, tiktokallowcomment, tiktokallowduet,
                         tiktokallowstitch, tiktokprivacylevel)
                    VALUES (?, ?, 'product', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, 0, '', ?, ?, true, ?, false, ?, ?, ?, ?)
                    RETURNING id
                    """, Long.class,
                    product.path(), product.code(), platform, mediaType, cut(target, 255), accountId, message,
                    image ? String.join("\n", gallery) : "", image ? "" : videoRef,
                    Timestamp.valueOf(at), Timestamp.valueOf(utc), ZONE, createdBy, now, now,
                    tt != null && tt.autoAddMusic(), tt == null || tt.allowComment(), tt != null && tt.allowDuet(),
                    tt != null && tt.allowStitch(), tt == null ? "SELF_ONLY" : tt.privacy());
            String label = (platform.equals("Facebook") ? "FB" : platform) + " " + (image ? "Images" : "Video") + ": " + product.name();
            db.update("""
                    INSERT INTO appscheduletb
                        (schedulename, schedulecode, schedulestringid, scheduletype, relatedcode, actionname,
                         actionvalue, repeatingrange, recure, recurevalue, starttime, endtime, createdtime,
                         modifiedtime, isenable, islocked, isvisible, timezone, starttimeutc, endtimeutc)
                    VALUES (?, 'none', ?, 'SOCIAL_POST', ?, ?, ?, 'none', 0, 'none', ?, ?, ?, ?, true, false, true, ?, ?, ?)
                    """, cut(label, 255), tenant, product.code(), action, String.valueOf(lastLogId),
                    Timestamp.valueOf(at), Timestamp.valueOf(at), now, now, ZONE, Timestamp.valueOf(utc), Timestamp.valueOf(utc));
            return 1;
        }
    }

    private String tokenCampaignText(JdbcTemplate db, String tokenType) {
        return db.query("""
                SELECT marketingcampaign FROM tokentb WHERE tokentype = ? AND isvisible = true
                 ORDER BY createdtime DESC LIMIT 1
                """, (r, n) -> {
            String v = r.getString("marketingcampaign");
            v = v == null ? "" : v.trim();
            return "none".equalsIgnoreCase(v) ? "" : v.replace("del.ete_", "delete").replace("up.date_", "update");
        }, tokenType).stream().findFirst().orElse("");
    }

    // ---- Portal bridge client ----

    record Media(String code, String path, String host, List<String> galleryUrls, String videoUrl,
                 String queuedVideoRef, String warning) {}

    private Media uploadMedia(String tenant, String name, String actor, List<MultipartFile> images, MultipartFile thumbnail,
                              MultipartFile video, String dmAddress, boolean queueVideo) {
        String boundary = "----demo-lazy-" + UUID.randomUUID();
        List<InputStream> parts = new ArrayList<>();
        try {
            field(parts, boundary, "name", name);
            field(parts, boundary, "actor", actor);
            field(parts, boundary, "dailymotionVideoAddress", dmAddress);
            field(parts, boundary, "queueVideo", String.valueOf(queueVideo));
            for (MultipartFile image : images) file(parts, boundary, "images", image);
            if (thumbnail != null && !thumbnail.isEmpty()) file(parts, boundary, "thumbnail", thumbnail);
            if (video != null && !video.isEmpty()) file(parts, boundary, "video", video);
            parts.add(bytes("--" + boundary + "--\r\n"));
        } catch (IOException e) { throw new UncheckedIOException(e); }
        HttpRequest request = bridgeRequest(tenant, "/media")
                .timeout(Duration.ofMinutes(15))
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofInputStream(() -> new SequenceInputStream(Collections.enumeration(parts))))
                .build();
        Map<String, Object> body = send(request);
        @SuppressWarnings("unchecked") List<Object> urls = (List<Object>) body.getOrDefault("galleryUrls", List.of());
        String code = text((String) body.get("code"), "");
        if (code.isEmpty()) throw new IllegalStateException("Portal did not return a product code");
        return new Media(code, text((String) body.get("path"), code + ".html"), text((String) body.get("host"), "https://" + tenant),
                urls.stream().map(String::valueOf).toList(), text((String) body.get("videoUrl"), ""),
                text((String) body.get("queuedVideoRef"), ""), text((String) body.get("warning"), ""));
    }

    private void bridgeJson(String tenant, String path, Map<String, String> payload) {
        try {
            send(bridgeRequest(tenant, path).timeout(Duration.ofSeconds(30)).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(payload))).build());
        } catch (IOException e) { throw new UncheckedIOException(e); }
    }

    private HttpRequest.Builder bridgeRequest(String tenant, String path) {
        if (bridgeUrl.isEmpty() || bridgeToken.length() < 24)
            throw new IllegalStateException("Portal lazy-create bridge is not configured on Demo (portal.lazy-create.bridge-token).");
        return HttpRequest.newBuilder(URI.create(bridgeUrl + "/api/internal/lazy-create/"
                        + URLEncoder.encode(tenant, StandardCharsets.UTF_8) + path))
                .header("X-Portal-Bridge-Token", bridgeToken).header("Accept", "application/json");
    }

    private Map<String, Object> send(HttpRequest request) {
        try {
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            Map<String, Object> body = response.body() == null || response.body().isBlank() ? Map.of()
                    : mapper.readValue(response.body(), new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
            if (response.statusCode() / 100 != 2)
                throw new IllegalStateException("Portal: " + body.getOrDefault("message", "HTTP " + response.statusCode()));
            return body;
        } catch (IOException e) {
            throw new IllegalStateException("Không kết nối được Portal để tải media: " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while uploading media", e);
        }
    }

    private static void field(List<InputStream> parts, String boundary, String name, String value) {
        parts.add(bytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"\r\n\r\n"
                + (value == null ? "" : value) + "\r\n"));
    }

    private static void file(List<InputStream> parts, String boundary, String name, MultipartFile file) throws IOException {
        String filename = text(file.getOriginalFilename(), name).replaceAll("[\"\\r\\n\\\\]", "_");
        parts.add(bytes("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + name + "\"; filename=\""
                + filename + "\"\r\nContent-Type: " + text(file.getContentType(), "application/octet-stream") + "\r\n\r\n"));
        parts.add(file.getInputStream());
        parts.add(bytes("\r\n"));
    }

    private static InputStream bytes(String s) { return new ByteArrayInputStream(s.getBytes(StandardCharsets.UTF_8)); }

    // ---- small helpers ----

    private static void requireType(MultipartFile f, String prefix, String label) {
        String type = f.getContentType() == null ? "" : f.getContentType().toLowerCase();
        if (!type.startsWith(prefix)) throw new IllegalArgumentException(label + " không đúng định dạng: " + f.getOriginalFilename());
    }

    private static void requireSize(MultipartFile f, int maxMb, String label) {
        if (f.getSize() > maxMb * 1024L * 1024L)
            throw new IllegalArgumentException(label + " tối đa " + maxMb + " MB: " + f.getOriginalFilename());
    }

    private static String nameOf(List<PortalContentService.CodeName> list, String code, String label) {
        return list.stream().filter(c -> c.code().equals(code)).map(PortalContentService.CodeName::name).findFirst()
                .orElseThrow(() -> new IllegalArgumentException(label + " không tồn tại: " + code));
    }

    private static String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
    private static String cut(String s, int max) { return s == null ? "" : s.length() > max ? s.substring(0, max) : s; }
    private static String text(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }

    public record Form(String name, String catalog, String brand, List<String> groupCodes, BigDecimal price,
                       String dailymotionVideoAddress, List<String> actions, boolean immediate, LocalDateTime scheduledAt,
                       String facebookPageId, String facebookMessage, String facebookSequence,
                       String tiktokMessage, String tiktokSequence, String tiktokPrivacy, boolean tiktokAllowComment,
                       boolean tiktokAllowDuet, boolean tiktokAllowStitch, boolean tiktokAutoAddMusic,
                       boolean tiktokMusicConsent, String youtubeDescription, String youtubeSequence) {}
    public record Result(int productId, String code, String path, String host, int postsQueued, String warning) {}
}
