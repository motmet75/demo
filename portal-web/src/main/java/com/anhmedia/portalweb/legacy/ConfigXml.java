package com.anhmedia.portalweb.legacy;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Read-only view of the legacy Portal xml/config.xml, with the exact lookup
 * semantics of the legacy Utilities.getConfig* helpers. The legacy code
 * re-parsed the file on every call; this parses once and reloads only when
 * the file's modification time changes.
 */
public final class ConfigXml {
    private static final Logger log = LoggerFactory.getLogger(ConfigXml.class);
    private static final String NON_PRINTABLE = "[^\\p{Print}]";

    private final Path file;
    private volatile Document document;
    private volatile FileTime loadedAt;

    public ConfigXml(Path file) {
        this.file = file.toAbsolutePath().normalize();
    }

    private Document doc() {
        try {
            FileTime modified = Files.getLastModifiedTime(file);
            Document current = document;
            if (current != null && modified.equals(loadedAt)) return current;
            synchronized (this) {
                if (document != null && modified.equals(loadedAt)) return document;
                DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
                factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
                factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
                factory.setXIncludeAware(false);
                factory.setExpandEntityReferences(false);
                try (InputStream in = Files.newInputStream(file)) {
                    document = factory.newDocumentBuilder().parse(in);
                }
                loadedAt = modified;
                return document;
            }
        } catch (Exception e) {
            log.error("Cannot read legacy config.xml at {}: {}", file, e.toString());
            return null;
        }
    }

    private NodeList nodes(String tag) {
        Document d = doc();
        return d == null ? null : d.getElementsByTagName(tag);
    }

    /** Utilities.getConfig: first &lt;config name=..&gt;, whole text, trimmed, non-printables removed; null if absent. */
    public String getConfig(String componentName) {
        NodeList configs = nodes("config");
        if (configs == null) return null;
        for (int i = 0; i < configs.getLength(); i++) {
            Element e = (Element) configs.item(i);
            if (e.getAttribute("name").equals(componentName)) {
                return e.getTextContent().trim().replaceAll(NON_PRINTABLE, "");
            }
        }
        return null;
    }

    /** Utilities.getConfigByTenantAndLang: "" when not found. */
    public String getConfigByTenantAndLang(String componentName, String tenantId, String langCode) {
        NodeList configs = nodes("config");
        String translation = null;
        if (configs != null) {
            for (int i = 0; i < configs.getLength(); i++) {
                Element e = (Element) configs.item(i);
                if (e.getAttribute("name").equals(componentName) && e.getAttribute("tenantId").equals(tenantId)) {
                    NodeList langs = e.getElementsByTagName("language");
                    for (int j = 0; j < langs.getLength(); j++) {
                        Element lang = (Element) langs.item(j);
                        if (lang.getAttribute("code").equals(langCode)) {
                            translation = lang.getTextContent().trim().replaceAll(NON_PRINTABLE, "");
                        }
                    }
                    break;
                }
            }
        }
        return translation == null ? "" : translation;
    }

    /** Utilities.getConfigListByTenant: tenant entry, else the "default" tenant entry. */
    public List<String> getConfigListByTenant(String componentName, String tenantId) {
        List<String> result = collect(componentName, tenantId);
        return result.isEmpty() ? collect(componentName, "default") : result;
    }

    private List<String> collect(String componentName, String tenantId) {
        List<String> result = new ArrayList<>();
        NodeList configs = nodes("config");
        if (configs == null) return result;
        for (int i = 0; i < configs.getLength(); i++) {
            Element e = (Element) configs.item(i);
            if (e.getAttribute("name").equals(componentName) && e.getAttribute("tenantId").equals(tenantId)) {
                NodeList langs = e.getElementsByTagName("language");
                for (int j = 0; j < langs.getLength(); j++) {
                    String value = langs.item(j).getTextContent().trim();
                    if (!value.isEmpty()) result.add(value);
                }
                break;
            }
        }
        return result;
    }

    /** Utilities.getConfigValueByLanguage: &lt;component name=..&gt;&lt;language code=..&gt;; null if absent. */
    public String getConfigValueByLanguage(String componentName, String languageCode) {
        NodeList components = nodes("component");
        if (components == null) return null;
        for (int i = 0; i < components.getLength(); i++) {
            Element e = (Element) components.item(i);
            if (e.getAttribute("name").equals(componentName)) {
                NodeList langs = e.getElementsByTagName("language");
                for (int j = 0; j < langs.getLength(); j++) {
                    Element lang = (Element) langs.item(j);
                    if (lang.getAttribute("code").equals(languageCode)) return lang.getTextContent();
                }
                return null;
            }
        }
        return null;
    }
}
