package com.anhmedia.portalweb;

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
    private final Path configXml;
    private final Path liveTemplates;

    public ThemeRegistry(@Value("${portal.web.config-path:/opt/tuonghoa/portal/xml/config.xml}") String xml,
                         @Value("${portal.live.root:/opt/portal-live}") String liveRoot) {
        this.configXml = Path.of(xml).toAbsolutePath().normalize();
        this.liveTemplates = Path.of(liveRoot, "templates").toAbsolutePath().normalize();
    }

    public Optional<Theme> findForHost(String host) {
        String domain = normalizeHost(host);
        if (!domain.matches("[a-z0-9.-]+") || !Files.isRegularFile(configXml)) return Optional.empty();
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
            if (folder == null) return Optional.empty();
            Path index = liveTemplates.resolve(folder).resolve("index.html").normalize();
            Path root = liveTemplates.resolve(folder + ".html").normalize();
            if (index.startsWith(liveTemplates) && Files.isRegularFile(index)) {
                return Optional.of(new Theme(domain, tenant, folder, folder + "/index"));
            }
            if (root.startsWith(liveTemplates) && Files.isRegularFile(root)) {
                return Optional.of(new Theme(domain, tenant, folder, folder));
            }
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
