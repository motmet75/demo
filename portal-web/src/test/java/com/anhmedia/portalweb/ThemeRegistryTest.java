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
