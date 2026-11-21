package com.ams.bomcore.service.portalcontent;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;

import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Lazy create end to end against a scratch Postgres shaped like the legacy
 * Portal tables and a fake Portal bridge. Opt-in via PORTAL_LAZY_IT_URL
 * (e.g. jdbc:postgresql://127.0.0.1:55432/lazytest).
 */
@EnabledIfEnvironmentVariable(named = "PORTAL_LAZY_IT_URL", matches = "jdbc:postgresql:.*")
class PortalLazyCreateServiceDbIT {
    private static final String TOKEN = "0123456789abcdef0123456789abcdef";
    @TempDir Path directory;
    private HttpServer bridge;
    private final List<String> calls = new ArrayList<>();
    private final List<String> bodies = new ArrayList<>();

    @AfterEach void stop() { if (bridge != null) bridge.stop(0); }

    private PortalLazyCreateService service(JdbcTemplate[] dbOut) throws Exception {
        bridge = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        bridge.createContext("/api/internal/lazy-create/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.ISO_8859_1);
            calls.add(exchange.getRequestURI().getPath() + " token=" + TOKEN.equals(exchange.getRequestHeaders().getFirst("X-Portal-Bridge-Token")));
            bodies.add(body);
            String reply = exchange.getRequestURI().getPath().endsWith("/media")
                    ? "{\"code\":\"ghe-sofa\",\"path\":\"ghe-sofa.html\",\"host\":\"https://shop.test\","
                      + "\"galleryUrls\":[\"https://shop.test/image/a.jpg\",\"https://shop.test/image/b.jpg\"],"
                      + "\"videoUrl\":\"https://geo.dailymotion.com/player.html?video=x9zz\","
                      + "\"queuedVideoRef\":\"server:/opt/tuonghoa/portal/youtube-queue-video/shop.test/ghe-sofa-1.mp4\",\"warning\":\"\"}"
                    : "{\"file\":\"ok\"}";
            byte[] bytes = reply.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        bridge.start();
        Files.writeString(directory.resolve("t.properties"), "id=shop.test\nurl=" + System.getenv("PORTAL_LAZY_IT_URL")
                + "\nusername=test\npassword=\n");
        var registry = new PortalTenantDataSourceRegistry(List.of(directory));
        dbOut[0] = new JdbcTemplate(registry.dataSource("shop.test"));
        for (String t : List.of("schedulelogtb", "appscheduletb", "access_tokens", "productgroupitemtb", "producttb"))
            dbOut[0].update("DELETE FROM " + t);
        return new PortalLazyCreateService(registry, new PortalContentService(registry), new PortalScheduleService(registry),
                "http://127.0.0.1:" + bridge.getAddress().getPort(), TOKEN);
    }

    private static PortalLazyCreateService.Form form(List<String> actions, boolean immediate, LocalDateTime at,
                                                     String fbMessage, boolean consent) {
        return new PortalLazyCreateService.Form("Ghế sofa", "noi-that", "hoa-phat", List.of("sale"), null, "",
                actions, immediate, at, "PAGE1", fbMessage, null, "", null, "PUBLIC_TO_EVERYONE", true, false, false,
                true, consent, "", null);
    }

    @Test
    void createsProductAndQueuesEveryPlatformLikeLegacy() throws Exception {
        JdbcTemplate[] dbRef = new JdbcTemplate[1];
        var service = service(dbRef);
        JdbcTemplate db = dbRef[0];
        var images = List.<org.springframework.web.multipart.MultipartFile>of(
                new MockMultipartFile("images", "a.jpg", "image/jpeg", new byte[]{1, 2, 3}),
                new MockMultipartFile("images", "b.jpg", "image/jpeg", new byte[]{4, 5}));
        var video = new MockMultipartFile("video", "v.mp4", "video/mp4", new byte[]{9, 9, 9, 9});
        LocalDateTime at = LocalDateTime.now(ZoneId.of("Asia/Ho_Chi_Minh")).plusHours(2).withSecond(0).withNano(0);

        var result = service.create("shop.test", form(List.of("post_facebook_multi_image", "post_facebook_video",
                "post_tiktok_image", "post_tiktok_video", "post_youtube_video"), false, at, "", true), images, null, video, "tester");

        assertEquals("ghe-sofa", result.code());
        assertEquals(5, result.postsQueued());
        assertTrue(calls.get(0).endsWith("/shop.test/media token=true"), calls.toString());
        assertTrue(bodies.get(0).contains("name=\"queueVideo\"\r\n\r\ntrue"));
        assertTrue(bodies.get(0).contains("filename=\"a.jpg\"") && bodies.get(0).contains("filename=\"v.mp4\""));
        assertTrue(calls.get(1).endsWith("/shop.test/youtube-idea token=true"), calls.toString());

        Map<String, Object> p = db.queryForMap("SELECT * FROM producttb");
        assertEquals("ghe-sofa.html", p.get("path"));
        assertEquals("https://shop.test/image/a.jpg\nhttps://shop.test/image/b.jpg", p.get("productimageurl1"));
        assertEquals("https://shop.test/image/a.jpg", p.get("productimagedesurl"));
        assertEquals("#hoa-phat", p.get("productsubcatalog"));
        assertEquals("<p>Ghế sofa</p>", p.get("productlongdes"));
        assertEquals(false, p.get("isapproved"));              // scheduled posts: approved later, as legacy
        assertEquals(1, db.queryForObject("SELECT count(*) FROM productgroupitemtb WHERE productcode='ghe-sofa'", Integer.class));

        List<Map<String, Object>> logs = db.queryForList("SELECT * FROM schedulelogtb ORDER BY id");
        assertEquals(List.of("Facebook", "Facebook", "TikTok", "TikTok", "YouTube"), logs.stream().map(l -> l.get("platform")).toList());
        Map<String, Object> fbImg = logs.get(0), fbVid = logs.get(1), ttVid = logs.get(3), yt = logs.get(4);
        assertEquals("facebook-page:PAGE1", fbImg.get("targetusername"));
        assertEquals("PAGE1", fbImg.get("targetaccountid"));
        assertEquals("https://shop.test/image/a.jpg\nhttps://shop.test/image/b.jpg", fbImg.get("imageurls"));
        assertTrue(((String) fbVid.get("videodmid")).startsWith("server:/opt/tuonghoa/portal/youtube-queue-video/"));
        assertEquals(java.sql.Timestamp.valueOf(at.plusMinutes(1)), fbVid.get("scheduledtime"));   // video 1 min after images
        String fbMsg = (String) fbImg.get("postmessage");
        assertTrue(fbMsg.startsWith("Ghế sofa\nHotline 0909\n#nncminhchau #hoa_phat\nhttps://shop.test/san-pham/ghe-sofa.html?t="), fbMsg);
        // digit 7 (code) is skipped: the tracked link already contains "ghe-sofa" (legacy appendSequencePart)
        assertTrue(fbMsg.matches("(?s).*\\?t=[0-9A-Za-z]+$"), fbMsg);
        assertEquals("PUBLIC_TO_EVERYONE", ttVid.get("tiktokprivacylevel"));
        assertEquals(true, logs.get(2).get("tiktokautoaddmusic"));
        assertEquals("Ghế sofa", yt.get("targetusername"));

        assertEquals(5, db.queryForObject("SELECT count(*) FROM appscheduletb WHERE scheduletype='SOCIAL_POST' AND isenable", Integer.class));
        assertEquals(List.of("post_facebook_multi_image", "post_facebook_video", "post_tiktok_image", "post_tiktok_video", "post_youtube_video"),
                db.queryForList("SELECT actionname FROM appscheduletb ORDER BY id", String.class));
        assertEquals(String.valueOf(fbImg.get("id")), db.queryForObject("SELECT actionvalue FROM appscheduletb ORDER BY id LIMIT 1", String.class));
        assertEquals("FB Images: Ghế sofa", db.queryForObject("SELECT schedulename FROM appscheduletb ORDER BY id LIMIT 1", String.class));
        // one tracking token per platform used (FB, TikTok, YouTube)
        assertEquals(List.of("LAZY_FB_TRACK", "LAZY_TT_TRACK", "LAZY_YT_TRACK"),
                db.queryForList("SELECT token_type FROM access_tokens ORDER BY id", String.class));
    }

    @Test
    void typedMessageMarkersAndImmediateApproval() throws Exception {
        JdbcTemplate[] dbRef = new JdbcTemplate[1];
        var service = service(dbRef);
        var images = List.<org.springframework.web.multipart.MultipartFile>of(new MockMultipartFile("images", "a.jpg", "image/jpeg", new byte[]{1}));
        service.create("shop.test", form(List.of("post_facebook_multi_image"), true, null,
                "Mua ngay {{PRODUCT_CODE}} tại {{TRACKED_URL}}", true), images, null, null, "tester");
        String msg = dbRef[0].queryForObject("SELECT postmessage FROM schedulelogtb", String.class);
        assertTrue(msg.matches("Mua ngay ghe-sofa tại https://shop\\.test/san-pham/ghe-sofa\\.html\\?t=[0-9A-Za-z]+"), msg);
        assertEquals(true, dbRef[0].queryForObject("SELECT isapproved FROM producttb", Boolean.class));
    }

    @Test
    void legacyValidationRunsBeforeAnyUpload() throws Exception {
        JdbcTemplate[] dbRef = new JdbcTemplate[1];
        var service = service(dbRef);
        LocalDateTime past = LocalDateTime.now().minusHours(1);
        var img = List.<org.springframework.web.multipart.MultipartFile>of(new MockMultipartFile("images", "a.jpg", "image/jpeg", new byte[]{1}));
        assertThrows(IllegalArgumentException.class, () -> service.create("shop.test",
                form(List.of("post_facebook_multi_image"), false, LocalDateTime.now().plusHours(1), "", true), List.of(), null, null, "t"));
        assertThrows(IllegalArgumentException.class, () -> service.create("shop.test",
                form(List.of("post_facebook_video"), false, LocalDateTime.now().plusHours(1), "", true), img, null, null, "t"));
        assertThrows(IllegalArgumentException.class, () -> service.create("shop.test",
                form(List.of("post_facebook_multi_image"), false, past, "", true), img, null, null, "t"));
        assertThrows(IllegalArgumentException.class, () -> service.create("shop.test",
                form(List.of("post_tiktok_image"), true, null, "", false), img, null, null, "t"));
        var notImage = List.<org.springframework.web.multipart.MultipartFile>of(new MockMultipartFile("images", "a.exe", "application/x-msdownload", new byte[]{1}));
        assertThrows(IllegalArgumentException.class, () -> service.create("shop.test",
                form(List.of(), true, null, "", true), notImage, null, null, "t"));
        assertEquals(List.of(), calls);
        assertEquals(0, dbRef[0].queryForObject("SELECT count(*) FROM producttb", Integer.class));
    }
}
