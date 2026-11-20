package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Cart;
import com.anhmedia.portalweb.legacy.entity.TemplateImage;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * GreetingController's per-request tenant plumbing: host -> domain string ->
 * tenant id -> template folder -> (localized) view name, plus the shared
 * model attributes every public page receives.
 */
@Component
public class LegacySite {
    public static final String MINH_MAP_RESOURCE_FOLDER = "minhmapshop.com";
    private static final String CART = "portalweb.cart";

    private final LegacyLanguage languages;
    private final Path packagedTemplates;

    public LegacySite(LegacyLanguage languages,
                      @Value("${portal.web.config-path:/opt/tuonghoa/portal/xml/config.xml}") String configXml,
                      @Value("${portal.web.legacy-resources-root:/opt/tuonghoa/portal/src/main/resources}") String legacyRoot) {
        this.languages = languages;
        // Templates packaged in the legacy Portal JAR: localizedViewName() only
        // switches to a "-en"/"-vi" file when it exists there.
        this.packagedTemplates = Path.of(legacyRoot, "templates").toAbsolutePath().normalize();
        Utilities.init(new ConfigXml(Path.of(configXml)));
    }

    public LegacyLanguage languages() { return languages; }

    /** getDemoPathContext() without the /demo prefix branch (never routed here). */
    public String domainString(HttpServletRequest request) {
        String configured = Utilities.getConfig(request.getServerName());
        return configured == null ? "" : configured.trim();
    }

    public String resolveTenantId(String domainString) {
        String tenantId = Utilities.getConfig(domainString);
        if (tenantId == null || tenantId.isBlank()) return domainString == null ? "" : domainString.trim();
        return tenantId.trim();
    }

    public String resolveTemplateFolder(String domainString, String tenantId) {
        String templateFolder = configuredTemplateFolder(tenantId);
        if ((templateFolder == null || templateFolder.isBlank()) && domainString != null && !domainString.equals(tenantId)) {
            templateFolder = configuredTemplateFolder(domainString);
        }
        if (templateFolder == null || templateFolder.isBlank()) templateFolder = tenantId;
        if (templateFolder == null || templateFolder.isBlank()) templateFolder = domainString;
        return normalizeTemplateFolder(templateFolder);
    }

    private String configuredTemplateFolder(String tenantId) {
        if (tenantId == null || tenantId.isBlank()) return null;
        return Utilities.getConfigListByTenant("templateFolder", tenantId).stream()
                .filter(v -> v != null && !v.isBlank()).findFirst().orElse(null);
    }

    private static String normalizeTemplateFolder(String templateFolder) {
        if (templateFolder == null) return "";
        String normalized = templateFolder.trim().replace('\\', '/');
        while (normalized.startsWith("/")) normalized = normalized.substring(1);
        while (normalized.endsWith("/")) normalized = normalized.substring(0, normalized.length() - 1);
        return normalized;
    }

    public String viewName(String domainString, String tenantId, String templateName) {
        String t = templateName == null ? "" : templateName.trim();
        while (t.startsWith("/")) t = t.substring(1);
        return resolveTemplateFolder(domainString, tenantId) + "/" + t;
    }

    private String resolveLocalizedTemplateName(String templateName, String languageCode) {
        String t = templateName == null ? "" : templateName.trim();
        String lang = languages.normalizeFrontendLanguageCode(languageCode);
        if (lang == null || LegacyLanguage.DEFAULT_LANGUAGE.equals(lang) || t.isBlank()) return t;
        int dot = t.lastIndexOf(".html");
        if (dot < 0) return t;
        String base = t.substring(0, dot);
        if (base.endsWith("-" + lang)) return t;
        return base + "-" + lang + ".html";
    }

    public String localizedViewName(String domainString, String tenantId, String templateName, String languageCode) {
        String localizedTemplate = resolveLocalizedTemplateName(templateName, languageCode);
        String localizedView = viewName(domainString, tenantId, localizedTemplate);
        if (!localizedTemplate.equals(templateName) && packaged(localizedView)) return localizedView;
        String selected = languages.normalizeFrontendLanguageCode(languageCode);
        if (selected != null && !LegacyLanguage.FALLBACK_FRONTEND_LANGUAGE.equals(selected)) {
            String englishTemplate = resolveLocalizedTemplateName(templateName, LegacyLanguage.FALLBACK_FRONTEND_LANGUAGE);
            String englishView = viewName(domainString, tenantId, englishTemplate);
            if (!englishTemplate.equals(templateName) && packaged(englishView)) return englishView;
        }
        return viewName(domainString, tenantId, templateName);
    }

    /** new ClassPathResource("templates/" + view).exists() against the legacy resource tree. */
    private boolean packaged(String view) {
        Path candidate = packagedTemplates.resolve(view).normalize();
        return candidate.startsWith(packagedTemplates) && Files.isRegularFile(candidate);
    }

    public void addTenantTemplateVariables(Map<String, Object> model, String domainString, String tenantId) {
        String templateFolder = resolveTemplateFolder(domainString, tenantId);
        model.put("domain", templateFolder);
        model.put("domainString", domainString);
        model.put("tenantId", tenantId);
        model.put("templateFolder", templateFolder);
        model.put("staticFolder", templateFolder);
        model.put("domaintf", MINH_MAP_RESOURCE_FOLDER);
        model.put("domainsingle", MINH_MAP_RESOURCE_FOLDER);
    }

    public void addFrontendTemplateControls(Map<String, Object> model, LegacyContentService content,
                                            String templateLink, String templateName, String languageCode) {
        String selected = languages.normalizeFrontendLanguageCode(languageCode);
        if (selected == null) selected = LegacyLanguage.FALLBACK_FRONTEND_LANGUAGE;
        model.put("language", selected);
        model.put("languages", languages.getLanguagesForModel(selected));
        model.put("languageOptions", languages.getLanguageOptionsForModel(selected));
        model.put("selectedLanguageCode", selected);
        model.put("selectedLanguageName", languages.displayLanguageName(selected));
        model.put("selectedLanguageFlagUrl", languages.flagUrlForLanguage(selected));
        List<TemplateImage> images = content.getTemplateImages(templateLink, templateName, selected);
        model.put("templateImages", images);
        Map<String, TemplateImage> byId = new LinkedHashMap<>();
        for (TemplateImage image : images) byId.put(image.getStringId(), image);
        model.put("templateImageMap", byId);
    }

    /** cartList.get(session.getId()), created on first use with that request's language. */
    public Cart cart(HttpSession session, String tenantId, String language) {
        Object existing = session.getAttribute(CART);
        if (existing instanceof Cart cart) return cart;
        Cart cart = new Cart(tenantId, language);
        session.setAttribute(CART, cart);
        return cart;
    }
}
