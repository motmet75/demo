package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.WebMenu;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class LegacyPortTest {
    @TempDir Path temp;

    @BeforeEach
    void config() throws Exception {
        Path xml = temp.resolve("config.xml");
        Files.writeString(xml, """
                <configs>
                  <config name="nncminhchau.vn">
                      <language code="en">nncminhchau.vn</language>
                  </config>
                  <config name="templateFolder" tenantId="nncminhchau.vn">
                      <language code="en">nncminhchau.vn</language>
                  </config>
                  <config name="tin-tuc.html" tenantId="nncminhchau.vn">
                      <language code="en">news.html</language>
                      <language code="vi">tin-tuc.html</language>
                  </config>
                  <component name="currencyDisplay"><language code="vi">VND</language></component>
                </configs>
                """);
        Utilities.init(new ConfigXml(xml));
    }

    @Test
    void explicitLegacyRoutesAreLeftToPortal8080() {
        for (String owned : List.of("/gio-hang", "/gio-hang/", "/dang-nhap", "/dang-nhap/oauth2/code/google",
                "/contact.html", "/about.html", "/article/x.html", "/san-pham/abc.html", "/product/abc.html",
                "/api/anything/deep", "/app/login", "/admin/products", "/products.html", "/VAADIN/build/x.js")) {
            assertTrue(LegacyExplicitRoutes.ownedByLegacy(owned), owned);
        }
        for (String dynamic : List.of("/tin-tuc-su-kien", "/tin-tuc-su-kien/", "/news",
                "/van-ban-phap-luat/phu-luc.html", "/a/b/c.html", "/a/b/c/d.html")) {
            assertFalse(LegacyExplicitRoutes.ownedByLegacy(dynamic), dynamic);
        }
    }

    @Test
    void configLookupsMatchLegacySemantics() {
        assertEquals("nncminhchau.vn", Utilities.getConfig("nncminhchau.vn"));
        assertNull(Utilities.getConfig("unknown.example"));
        assertEquals("news.html", Utilities.getConfigByTenantAndLang("tin-tuc.html", "nncminhchau.vn", "en"));
        assertEquals("", Utilities.getConfigByTenantAndLang("tin-tuc.html", "nncminhchau.vn", "ja"));
        assertEquals(List.of("nncminhchau.vn"), Utilities.getConfigListByTenant("templateFolder", "nncminhchau.vn"));
        assertEquals("VND", Utilities.getConfigValueByLanguage("currencyDisplay", "vi"));
    }

    @Test
    void articleGettersKeepLegacyQuirks() {
        Article a = new Article("Thông báo update giá", "tin-tuc.html", "blog-single.html", "article", "en");
        // stored with the legacy "up.date_" escape, read back decoded and upper-cased
        assertEquals("THÔNG BÁO UPDATE GIÁ", a.getArticleTitle());
        assertEquals("Thông báo update giá", a.getNormalArticleTitle());
        a.setHostString("nncminhchau.vn");
        assertEquals("news.html", a.getURLbyAticleLangCode());
        a.setArticleLangCode("ja");
        assertEquals("tin-tuc.html", a.getURLbyAticleLangCode());
        a.setArticleThumnailURL("anh.jpg");
        assertEquals("https://nncminhchau.vn/image/anh.jpg", a.getArticleThumnailURLWithHost2());
        a.setArticleTime(null);
        assertTrue(a.getArticleTime().getYear() < java.time.LocalDate.now().getYear() - 40);
        assertEquals("0", new Article().getIndex().replace("none", "0"));
    }

    @Test
    void menuTreeAndTemplateLanguageFallback() {
        assertEquals("vi", LegacyContentService.normalizeTemplateLang("fr"));
        assertEquals("cn", LegacyContentService.normalizeTemplateLang("zh-TW"));
        assertEquals("en", LegacyContentService.normalizeTemplateLang("en_US"));
        assertEquals("vi", LegacyContentService.normalizeTemplateLang(null));
        assertEquals(List.of(), WebMenu.buildMenuTree(List.of(), "root"));
    }

    @Test
    void languageNormalisationAndFlags() {
        LegacyLanguage l = new LegacyLanguage(false);
        assertEquals("tw", l.normalizeFrontendLanguageCode("zh-Hant-TW"));
        assertEquals("id", l.normalizeFrontendLanguageCode("in"));
        assertNull(l.normalizeFrontendLanguageCode("xx"));
        assertEquals("/img/languageflags/ae.svg", l.flagUrlForLanguage("ar"));
        assertEquals(14, l.getLanguagesForModel("vi").size());
        assertEquals("VN", LegacyLanguage.jsonString("{\"countryName\":\"Vietnam\",\"countryCode\":\"VN\"}", "countryCode"));
        assertEquals("undefined", LegacyLanguage.jsonString("{}", "countryCode"));
    }

    @Test
    void staticContentTypes() {
        assertEquals("text/css", MenuRouteController.detectContentType("style.css"));
        assertEquals("application/octet-stream", MenuRouteController.detectContentType("x.bin"));
    }
}
