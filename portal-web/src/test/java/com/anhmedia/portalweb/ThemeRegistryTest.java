package com.anhmedia.portalweb;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ThemeRegistryTest {
    @TempDir Path temp;

    @Test
    void resolvesAliasAndThemeFolderToLiveIndex() throws Exception {
        Path root = temp.resolve("portal-live");
        Files.createDirectories(root.resolve("templates/site-theme"));
        Files.writeString(root.resolve("templates/site-theme/index.html"), "<html>OK</html>");
        Path xml = temp.resolve("config.xml");
        Files.writeString(xml, """
                <configs>
                  <config name="example.vn"><language code="en">example.vn</language></config>
                  <config name="templateFolder" tenantId="example.vn">
                    <language code="en">site-theme</language>
                  </config>
                </configs>
                """);
        ThemeRegistry registry = new ThemeRegistry(xml.toString(), root.toString());
        ThemeRegistry.Theme theme = registry.findForHost("WWW.EXAMPLE.VN").orElseThrow();
        assertEquals("example.vn", theme.host());
        assertEquals("example.vn", theme.tenant());
        assertEquals("site-theme", theme.folder());
        assertEquals("site-theme/index", theme.viewName());
        assertTrue(registry.findForHost("unregistered.vn").isEmpty());
    }

    @Test
    void resolvesLegacyIndexWhenLiveThemeMissingWithoutChangingMapping() throws Exception {
        Path root = temp.resolve("portal-live");
        Path legacy = temp.resolve("old-portal-resources");
        Files.createDirectories(root.resolve("templates"));
        Files.createDirectories(legacy.resolve("templates/tuonghoa-imex.com"));
        Files.writeString(legacy.resolve("templates/tuonghoa-imex.com/index.html"), "<html>Original theme</html>");
        Path xml = temp.resolve("config.xml");
        Files.writeString(xml, """
                <configs>
                  <config name="templateFolder" tenantId="tuonghoa-imex.com">
                    <language code="en">tuonghoa-imex.com</language>
                  </config>
                </configs>
                """);
        ThemeRegistry registry = new ThemeRegistry(xml.toString(), root.toString(), legacy.toString());
        assertEquals("tuonghoa-imex.com/index",
                registry.findForHost("tuonghoa-imex.com").orElseThrow().viewName());

        // A newer live root must take precedence over the legacy index.
        Files.writeString(root.resolve("templates/tuonghoa-imex.com.html"), "<html>Live</html>");
        assertEquals("tuonghoa-imex.com",
                registry.findForHost("tuonghoa-imex.com").orElseThrow().viewName());
    }

    @Test
    void resolvesDifferentTenantAndTemplateFolderNamesFromXml() throws Exception {
        Path root = temp.resolve("portal-live");
        Files.createDirectories(root.resolve("templates/nlsjsc-yanmar"));
        Files.writeString(root.resolve("templates/nlsjsc-yanmar/index.html"), "<html>Theme</html>");
        Path xml = temp.resolve("config.xml");
        Files.writeString(xml, """
                <configs>
                  <config name="templateFolder" tenantId="nlsjsc.com">
                    <language code="en">nlsjsc-yanmar</language>
                  </config>
                </configs>
                """);
        ThemeRegistry registry = new ThemeRegistry(xml.toString(), root.toString());
        assertEquals("nlsjsc-yanmar/index",
                registry.findForHost("www.nlsjsc.com").orElseThrow().viewName());
    }

    @Test
    void rejectsUnsafeThemeFolderAndUnknownHost() throws Exception {
        Path root = temp.resolve("portal-live");
        Files.createDirectories(root.resolve("templates"));
        Path xml = temp.resolve("config.xml");
        Files.writeString(xml, """
                <configs>
                  <config name="templateFolder" tenantId="example.vn">
                    <language code="en">../../secrets</language>
                  </config>
                </configs>
                """);
        ThemeRegistry registry = new ThemeRegistry(xml.toString(), root.toString());
        assertTrue(registry.findForHost("example.vn").isEmpty());
        assertTrue(registry.findForHost("localhost:8083").isEmpty());
    }

    @Test
    void fallsBackToLegacyRootTemplate() throws Exception {
        Path root = temp.resolve("portal-live");
        Files.createDirectories(root.resolve("templates"));
        Files.writeString(root.resolve("templates/landing.html"), "<html>OK</html>");
        Path xml = temp.resolve("config.xml");
        Files.writeString(xml, """
                <configs><config name="templateFolder" tenantId="example.vn">
                  <language code="en">landing</language>
                </config></configs>
                """);
        ThemeRegistry registry = new ThemeRegistry(xml.toString(), root.toString());
        assertEquals("landing", registry.findForHost("example.vn").orElseThrow().viewName());
    }
}
