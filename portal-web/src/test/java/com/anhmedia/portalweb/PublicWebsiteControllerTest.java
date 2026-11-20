package com.anhmedia.portalweb;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import com.anhmedia.portalweb.legacy.LegacyLanguage;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.ui.ExtendedModelMap;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PublicWebsiteControllerTest {
    @TempDir Path temp;

    @Test
    void suppliesTheModelAttributesExpectedByExistingHomepageFragments() throws Exception {
        Path live = temp.resolve("portal-live");
        Path legacy = temp.resolve("original-resources");
        Files.createDirectories(live.resolve("templates/nncminhchau.vn"));
        Files.createDirectories(legacy.resolve("templates"));
        Files.writeString(live.resolve("templates/nncminhchau.vn/index.html"), "<html>Test</html>");
        Path xml = temp.resolve("config.xml");
        Files.writeString(xml, """
                <configs><config name="templateFolder" tenantId="nncminhchau.vn">
                  <language code="en">nncminhchau.vn</language>
                </config></configs>
                """);

        ThemeRegistry registry = new ThemeRegistry(xml.toString(), live.toString(), legacy.toString());
        PublicContentBridge bridge = new PublicContentBridge(
                "http://127.0.0.1:8081/sapi/internal/portal-public", "");
        PublicWebsiteController controller = new PublicWebsiteController(registry, bridge, new LegacyLanguage(false));
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/home");
        request.setServerName("nncminhchau.vn");
        request.setParameter("lang", "en");
        ExtendedModelMap model = new ExtendedModelMap();

        assertEquals("nncminhchau.vn/index", controller.homeRoute(request, new MockHttpSession(), model));
        assertEquals("nncminhchau.vn", model.get("tenantId"));
        assertEquals("", ((PublicWebsiteController.ClientMetadata) model.get("client")).getClientBanner());
        assertEquals(List.of(), model.get("catalogs"));
        assertEquals(List.of(), model.get("productsWithVideos"));
        assertEquals("/img/languageflags/en.png", model.get("selectedLanguageFlagUrl"));
        assertEquals("", ((PublicWebsiteController.PageMetadata) model.get("page"))
                .getArticleThumnailURLWithHost2());
        assertNotNull(model.get("templateImageMap"));
        assertNotNull(model.get("languageOptions"));
    }

    @Test
    void homeRoutesFollowTheLegacyRedirects() {
        PublicWebsiteController controller = new PublicWebsiteController(null,
                new PublicContentBridge("http://127.0.0.1:8081/sapi/internal/portal-public", ""),
                new LegacyLanguage(false));
        assertEquals("redirect:home", controller.root());

        MockHttpSession session = new MockHttpSession();
        MockHttpServletRequest vi = new MockHttpServletRequest("GET", "/home");
        vi.setParameter("lang", "vi");
        assertEquals("redirect:/trang-chu.html", controller.homeRoute(vi, session, new ExtendedModelMap()));
        assertEquals("vi", session.getAttribute("lang"));

        MockHttpServletRequest ja = new MockHttpServletRequest("GET", "/trang-chu.html");
        ja.setParameter("lang", "ja-JP");
        assertEquals("redirect:/home?lang=ja", controller.trangChu(ja, session, new ExtendedModelMap()));
        assertEquals("ja", session.getAttribute("lang"));

        assertEquals("redirect:/trang-chu.html?lang=vi", controller.setLanguage("vi", null, session));
        assertEquals("redirect:/home?lang=fr", controller.setLanguage("fr-FR", null, session));
        assertEquals("redirect:/tin-tuc-su-kien/?page=2&lang=en",
                controller.setLanguage("en", "/tin-tuc-su-kien/?page=2", session));
        // Open-redirect attempts are ignored, exactly like legacy sanitizeLanguageRedirectPath.
        assertEquals("redirect:/home?lang=en", controller.setLanguage("en", "//evil.example", session));
    }
}
