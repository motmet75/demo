package com.anhmedia.portalweb;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.mock.web.MockHttpServletRequest;
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
        PublicWebsiteController controller = new PublicWebsiteController(registry, bridge);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/");
        request.setServerName("nncminhchau.vn");
        ExtendedModelMap model = new ExtendedModelMap();

        assertEquals("nncminhchau.vn/index", controller.home(request, model));
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
}
