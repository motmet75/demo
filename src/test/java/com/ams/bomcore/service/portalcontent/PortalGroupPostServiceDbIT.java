package com.ams.bomcore.service.portalcontent;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Runs the group post SQL against a scratch Postgres shaped like the legacy
 * Portal tables. Only runs when PORTAL_GROUP_POST_IT_URL points at such a
 * database (e.g. jdbc:postgresql://127.0.0.1:55432/portaltest).
 */
@EnabledIfEnvironmentVariable(named = "PORTAL_GROUP_POST_IT_URL", matches = "jdbc:postgresql:.*")
class PortalGroupPostServiceDbIT {
    @TempDir Path directory;

    @Test
    void previewSaveListCancelAgainstLegacyShapedTables() throws Exception {
        Files.writeString(directory.resolve("t.properties"), "id=shop.test\nurl=" + System.getenv("PORTAL_GROUP_POST_IT_URL")
                + "\nusername=" + System.getenv().getOrDefault("PORTAL_GROUP_POST_IT_USER", "test") + "\npassword=\n");
        var registry = new PortalTenantDataSourceRegistry(List.of(directory));
        var service = new PortalGroupPostService(registry);
        var db = new JdbcTemplate(registry.dataSource("shop.test"));
        db.update("DELETE FROM schedulelogtb"); db.update("DELETE FROM access_tokens");

        var options = service.options("shop.test");
        assertEquals(2, options.groups().size());
        assertEquals("CAMP11", options.campaigns().get(0).code());
        assertEquals(3, service.members("shop.test", List.of()).size());          // 444 is in no marketing group
        assertEquals(2, service.members("shop.test", List.of("G2")).size());

        List<String> groups = List.of("https://facebook.com/groups/111", "https://facebook.com/groups/222",
                "https://facebook.com/groups/333");
        LocalDateTime start = LocalDateTime.now().plusDays(1).withSecond(0).withNano(0);
        var rows = service.preview("shop.test", new PortalGroupPostService.PreviewRequest(
                List.of(1, 2), groups, "51267", start, 15, null));
        assertEquals(3, rows.size());
        assertEquals(List.of("SP001", "SP002", "SP002"), rows.stream().map(PortalGroupPostService.PreviewRow::productCode).toList());
        assertEquals(start.plusMinutes(30), rows.get(2).scheduledAt());
        assertEquals("Ghe dep gia tot\nHotline 0909 123 456\n#nncminhchau #hoa_phat\n{{link}}\nSP001", rows.get(0).message());
        assertEquals("Hoi Noi that", rows.get(0).name());

        var save = rows.stream().map(r -> new PortalGroupPostService.SaveRow(r.username(), r.productId(), r.scheduledAt(), r.message())).toList();
        assertEquals(3, service.save("shop.test", new PortalGroupPostService.SaveRequest("CAMP11", null, save, null), "tester").saved());

        List<Map<String, Object>> logs = db.queryForList("SELECT * FROM schedulelogtb ORDER BY id");
        assertEquals(3, logs.size());
        Map<String, Object> first = logs.get(0);
        assertEquals("Facebook", first.get("platform"));
        assertEquals("group_post", first.get("mediatype"));
        assertEquals("pending", first.get("status"));
        assertEquals("https://facebook.com/groups/111", first.get("targetusername"));
        assertEquals("x8abc12", first.get("videodmid"));
        assertEquals("ghe-sofa-sp001.html", first.get("relatedpath"));
        String msg = (String) first.get("postmessage");
        assertTrue(msg.contains("https://shop.test/san-pham/ghe-sofa-sp001.html?t="), msg);
        assertTrue(!msg.contains("{{link}}"));

        // one tracking token per (group, product URL, campaign), id base62 stored and used in the link
        List<Map<String, Object>> tokens = db.queryForList("SELECT * FROM access_tokens ORDER BY id");
        assertEquals(3, tokens.size());
        assertEquals("GROUP_POST_TRACK", tokens.get(0).get("token_type"));
        assertEquals("Thang 11 - Ghe sofa", tokens.get(0).get("place_description"));
        assertTrue(msg.endsWith("?t=" + tokens.get(0).get("idbase62") + "\nSP001"), msg);

        // saving again reuses the same tokens
        service.save("shop.test", new PortalGroupPostService.SaveRequest("CAMP11", null, save, null), "tester");
        assertEquals(3, db.queryForObject("SELECT count(*) FROM access_tokens", Integer.class));

        var recent = service.recent("shop.test");
        assertEquals(6, recent.size());
        long id = recent.get(0).id();
        service.cancel("shop.test", id);
        assertEquals("cancelled", db.queryForObject("SELECT status FROM schedulelogtb WHERE id = ?", String.class, id));
        assertThrows(IllegalArgumentException.class, () -> service.cancel("shop.test", id));

        // a username that is not a marketing group member is refused
        var bad = List.of(new PortalGroupPostService.SaveRow("https://facebook.com/groups/444", 1, start, "hi"));
        assertThrows(IllegalArgumentException.class,
                () -> service.save("shop.test", new PortalGroupPostService.SaveRequest("CAMP11", null, bad, null), "tester"));
    }
}
