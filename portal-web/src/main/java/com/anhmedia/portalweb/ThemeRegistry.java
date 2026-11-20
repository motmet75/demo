package com.anhmedia.portalweb;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Optional;

/**
 * Reads the existing Portal hostname -> tenant -> templateFolder entries.
 * Never resolves a browser-supplied arbitrary path or accesses tenant credential files.
 */
@Component
public class ThemeRegistry {
    private static final Logger log = LoggerFactory.getLogger(ThemeRegistry.class);
    private final Path configXml;
    private final Path liveTemplates;
    private final Path legacyTemplates;

    @Autowired
    public ThemeRegistry(@Value("${portal.web.config-path:/opt/tuonghoa/portal/xml/config.xml}") String xml,
                         @Value("${portal.live.root:/opt/portal-live}") String liveRoot,
                         @Value("${portal.web.legacy-resources-root:/opt/tuonghoa/portal/src/main/resources}") String legacyResourcesRoot) {
        this.configXml = Path.of(xml).toAbsolutePath().normalize();
        this.liveTemplates = Path.of(liveRoot, "templates").toAbsolutePath().normalize();
        this.legacyTemplates = Path.of(legacyResourcesRoot, "templates").toAbsolutePath().normalize();
    }

    // Retained for existing unit tests and direct use outside Spring.
    ThemeRegistry(String xml, String liveRoot) {
        this(xml, liveRoot, "/opt/tuonghoa/portal/src/main/resources");
    }

    public Optional<Theme> findForHost(String host) {
        String domain = normalizeHost(host);
        if (!domain.matches("[a-z0-9.-]+")) {
            log.warn("Portal web tenant: rejected invalid hostname '{}'", domain);
            return Optional.empty();
        }
        if (!Files.isRegularFile(configXml)) {
            log.error("Portal web tenant config missing: {}", configXml);
            return Optional.empty();
        }
        try (InputStream stream = Files.newInputStream(configXml)) {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            Document document = factory.newDocumentBuilder().parse(new InputSource(stream));
            NodeList configs = document.getElementsByTagName("config");

            String tenant = null;
            for (int i = 0; i < configs.getLength(); i++) {
                Element element = (Element) configs.item(i);
                if (domain.equals(element.getAttribute("name"))) {
                    String candidate = languageValue(element);
                    if (isSafeName(candidate)) { tenant = candidate; break; }
                }
            }
            if (tenant == null) tenant = domain;
            String folder = null;
            for (int i = 0; i < configs.getLength(); i++) {
                Element element = (Element) configs.item(i);
                if ("templateFolder".equals(element.getAttribute("name"))
                        && tenant.equals(element.getAttribute("tenantId"))) {
                    String candidate = languageValue(element);
                    if (isSafeName(candidate)) { folder = candidate; break; }
                }
            }
            // A tenant not registered in xml/config.xml is never served, even
            // if an unrelated directory with the same name happens to exist.
            if (folder == null) {
                log.warn("Portal web tenant has no templateFolder: host={}, tenant={}, config={}",
                        domain, tenant, configXml);
                return Optional.empty();
            }
            // A live theme ALWAYS takes priority. The original Portal source
            // is a read-only fallback for themes/fragments not yet copied to live.
            Path liveIndex = liveTemplates.resolve(folder).resolve("index.html").normalize();
            Path liveRoot = liveTemplates.resolve(folder + ".html").normalize();
            Path originalIndex = legacyTemplates.resolve(folder).resolve("index.html").normalize();
            Path originalRoot = legacyTemplates.resolve(folder + ".html").normalize();
            if (liveIndex.startsWith(liveTemplates) && Files.isRegularFile(liveIndex)) {
                return Optional.of(new Theme(domain, tenant, folder, folder + "/index"));
            }
            if (liveRoot.startsWith(liveTemplates) && Files.isRegularFile(liveRoot)) {
                return Optional.of(new Theme(domain, tenant, folder, folder));
            }
            if (originalIndex.startsWith(legacyTemplates) && Files.isRegularFile(originalIndex)) {
                log.info("Using legacy read-only theme for host={}, folder={}", domain, folder);
                return Optional.of(new Theme(domain, tenant, folder, folder + "/index"));
            }
            if (originalRoot.startsWith(legacyTemplates) && Files.isRegularFile(originalRoot)) {
                log.info("Using legacy read-only root theme for host={}, folder={}", domain, folder);
                return Optional.of(new Theme(domain, tenant, folder, folder));
            }
            log.warn("Portal web tenant template missing: host={}, tenant={}, folder={}, live={}, legacy={}",
                    domain, tenant, folder, liveTemplates, legacyTemplates);
            return Optional.empty();
        } catch (Exception ex) {
            throw new IllegalStateException("Unable to resolve the Portal theme configuration", ex);
        }
    }

    static String normalizeHost(String raw) {
        String value = raw == null ? "" : raw.trim().toLowerCase(Locale.ROOT);
        if (value.startsWith("www.")) value = value.substring(4);
        return value.endsWith(".") ? value.substring(0, value.length() - 1) : value;
    }

    private static String languageValue(Element element) {
        NodeList values = element.getElementsByTagName("language");
        for (int i = 0; i < values.getLength(); i++) {
            Element language = (Element) values.item(i);
            if ("en".equalsIgnoreCase(language.getAttribute("code"))) {
                return language.getTextContent().trim();
            }
        }
        return values.getLength() == 0 ? "" : values.item(0).getTextContent().trim();
    }

    private static boolean isSafeName(String value) {
        return value != null && value.matches("[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*")
                && !value.contains("..");
    }

    public record Theme(String host, String tenant, String folder, String viewName) {}
}
