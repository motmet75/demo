package com.anhmedia.portalweb;

import com.anhmedia.portalweb.legacy.HomePageRenderer;
import com.anhmedia.portalweb.legacy.LegacyLanguage;
import com.anhmedia.portalweb.legacy.MenuPageRenderer;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Initial public-theme renderer. Model defaults prevent legacy home templates
 * from throwing on missing attributes while real tenant-aware read-only
 * content APIs are migrated. Defaults are NOT customer/product data.
 */
@Controller
public class PublicWebsiteController {
    private final ThemeRegistry themes;
    private final PublicContentBridge content;
    private final LegacyLanguage languages;
    private final HomePageRenderer homePages;

    @Autowired
    public PublicWebsiteController(ThemeRegistry themes, PublicContentBridge content, LegacyLanguage languages,
                                   HomePageRenderer homePages) {
        this.themes = themes;
        this.content = content;
        this.languages = languages;
        this.homePages = homePages;
    }

    /** Without direct database access (tests, bridge-only setups) home pages use the Demo bridge snapshot. */
    PublicWebsiteController(ThemeRegistry themes, PublicContentBridge content, LegacyLanguage languages) {
        this(themes, content, languages, null);
    }

    @GetMapping("/healthz")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("portal-web:ok");
    }

    /** GreetingController.rootPage. */
    @GetMapping("/")
    public String root() {
        return "redirect:home";
    }

    /** GreetingController.home / index: Vietnamese visitors get /trang-chu.html. */
    @GetMapping({"/home", "/index.html"})
    public String homeRoute(HttpServletRequest request, HttpSession session, Model model) {
        Map<String, Object> implicit = implicitLanguageModel(request, session);
        String lang = languages.resolveRequestedOrSessionLanguage(request, session);
        if (LegacyLanguage.DEFAULT_LANGUAGE.equals(lang)) {
            languages.setSessionLanguage(session, LegacyLanguage.DEFAULT_LANGUAGE);
            return "redirect:/trang-chu.html";
        }
        return renderHome("home", implicit, request, session, model, lang);
    }

    /** GreetingController.homeTrangChu: any other ?lang= goes back to /home. */
    @GetMapping("/trang-chu.html")
    public String trangChu(HttpServletRequest request, HttpSession session, Model model) {
        Map<String, Object> implicit = implicitLanguageModel(request, session);
        String lang = languages.normalizeFrontendLanguageCode(request.getParameter("lang"));
        if (lang != null && !LegacyLanguage.DEFAULT_LANGUAGE.equals(lang)) {
            languages.setSessionLanguage(session, lang);
            return "redirect:/home?lang=" + lang;
        }
        languages.setSessionLanguage(session, LegacyLanguage.DEFAULT_LANGUAGE);
        return renderHome("trang-chu.html", implicit, request, session, model, LegacyLanguage.DEFAULT_LANGUAGE);
    }

    /** GreetingController's @ModelAttribute language controls run before the handler body. */
    private Map<String, Object> implicitLanguageModel(HttpServletRequest request, HttpSession session) {
        return homePages == null ? Map.of() : homePages.globalLanguageControls(request, session);
    }

    private String renderHome(String pageLink, Map<String, Object> implicit, HttpServletRequest request,
                              HttpSession session, Model model, String lang) {
        if (homePages == null) return home(request, model, lang);
        Optional<MenuPageRenderer.Page> page = homePages.render(pageLink, implicit, request, session);
        if (page.isEmpty()) {
            // No tenant database configured for this host: Nginx serves it from Portal 8080.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Home page not served by Portal Web for this host");
        }
        model.addAllAttributes(page.get().model());
        return page.get().view();
    }

    /** GreetingController.setLanguage. */
    @GetMapping("/setLanguage")
    public String setLanguage(@RequestParam("lang") String languageCode,
                              @RequestParam(value = "redirect", required = false) String redirectPath,
                              HttpSession session) {
        return "redirect:" + languages.setLanguageRedirect(languageCode, redirectPath, session);
    }

    /**
     * Home content still comes from the Demo bridge snapshot (Phase 2 ports
     * returnHomePage exactly). The snapshot only knows "vi" and "en".
     */
    private String home(HttpServletRequest request, Model model, String resolvedLanguage) {
        ThemeRegistry.Theme theme = themes.findForHost(request.getServerName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No live Portal theme mapped for host"));

        String lang = "vi".equals(resolvedLanguage) ? "vi" : "en";
        String flag = "/img/languageflags/" + lang + ".png";
        model.addAttribute("tenant", theme.tenant());
        model.addAttribute("tenantId", theme.tenant());
        // Old GreetingController uses the theme folder as "domain" for
        // /<folder>/css URLs. The hostname remains in domainString.
        model.addAttribute("domain", theme.folder());
        model.addAttribute("domainString", theme.host());
        model.addAttribute("staticFolder", theme.folder());
        model.addAttribute("subpath", "");
        model.addAttribute("activePage", "home");
        model.addAttribute("templateFolder", theme.folder());
        model.addAttribute("companynameshort", theme.tenant());
        model.addAttribute("companywelcometext", "");

        // The original templates expect these model names. Use explicit empty
        // collections until tenant-isolated content services are available.
        // Never invent products, prices, contacts, articles or media.
        model.addAttribute("client", new ClientMetadata(theme.tenant()));
        model.addAttribute("pages", List.of());
        model.addAttribute("brands", List.of());
        model.addAttribute("productGroups", List.of());
        model.addAttribute("topCatalogs", List.of());
        model.addAttribute("productofActiveCatalog", List.of());
        model.addAttribute("products", List.of());
        model.addAttribute("productsWithVideos", List.of());
        model.addAttribute("catalogs", List.of());
        model.addAttribute("selectedHomeCatalogs", List.of());
        model.addAttribute("articles", List.of());
        model.addAttribute("spotlightArticles", List.of());
        model.addAttribute("partners", List.of());
        model.addAttribute("projectMenuEntities", List.of());
        model.addAttribute("templateImageMap", Map.of());
        model.addAttribute("templateImages", List.of());
        model.addAttribute("heroVideo", null);
        model.addAttribute("secondImage", null);
        model.addAttribute("cart", null);

        model.addAttribute("language", lang);
        model.addAttribute("selectedLanguageCode", lang);
        model.addAttribute("selectedLanguageName", "vi".equals(lang) ? "Tiếng Việt" : "English");
        model.addAttribute("selectedLanguageFlagUrl", flag);
        model.addAttribute("languageOptions", List.of(
                new LanguageOption("vi", "Tiếng Việt", "/img/languageflags/vi.png", "vi".equals(lang)),
                new LanguageOption("en", "English", "/img/languageflags/en.png", "en".equals(lang))));

        model.addAttribute("page", new PageMetadata(theme.tenant()));
        if (!content.enabled()) {
            // Standalone compatibility-only mode: no DB passwords or guessed
            // content, but template rendering can still be tested.
            return themes.viewForPage(theme, "index.html", lang);
        }

        // Once the bridge is enabled, NEVER silently fall back to empty
        // lists when the data service fails: surface the error for operators.
        Map<String,Object> snapshot;
        try {
            snapshot = content.homepage(theme, lang).orElseThrow();
        } catch (RuntimeException ex) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY,
                    "Tenant public content service unavailable", ex);
        }

        // Pass real public model values from Demo (8081). Preserve the trusted
        // theme/host/language attributes above.
        for (String key : List.of("client", "page", "products", "productsWithVideos",
                "catalogs", "selectedHomeCatalogs", "topCatalogs", "productofActiveCatalog",
                "articles", "spotlightArticles", "pages", "brands", "productGroups",
                "partners", "projectMenuEntities", "secondImage")) {
            if (snapshot.containsKey(key)) model.addAttribute(key, normalized(snapshot.get(key)));
        }

        Object suppliedSlots = snapshot.get("templateImages");
        List<TemplateSlot> slots = new ArrayList<>();
        if (suppliedSlots instanceof List<?> entries) {
            for (Object value : entries) {
                if (value instanceof Map<?,?> raw) slots.add(new TemplateSlot(raw));
            }
        }
        Map<String,TemplateSlot> slotById = new LinkedHashMap<>();
        for (TemplateSlot slot : slots) slotById.put(slot.getStringId(), slot);
        model.addAttribute("templateImages", slots);
        model.addAttribute("templateImageMap", slotById);
        return themes.viewForPage(theme, string(snapshot.get("homeTemplate")), lang);
    }

    private static String string(Object value) {
        return value == null ? "" : value.toString();
    }

    private static Object normalized(Object value) {
        if (value instanceof List<?> list) {
            return list.stream().map(PublicWebsiteController::normalized).toList();
        }
        if (value instanceof Map<?,?> source) {
            Map<String,Object> copy = new LinkedHashMap<>();
            for (var entry : source.entrySet()) {
                String key = string(entry.getKey());
                Object nested = normalized(entry.getValue());
                if ("articleTime".equals(key) && nested instanceof String date) {
                    try {
                        nested = date.isBlank() ? null : LocalDateTime.parse(date);
                    } catch (java.time.format.DateTimeParseException ignored) {
                        nested = null;
                    }
                }
                copy.put(key, nested);
            }
            return copy;
        }
        return value;
    }

    /** JavaBean methods used by the existing configurable video/image sections. */
    public static final class TemplateSlot {
        private final Map<?,?> data;
        public TemplateSlot(Map<?,?> data) { this.data = data; }
        private String get(String key) { return string(data.get(key)); }
        public String getStringId() { return get("stringId"); }
        public String getMediaType() { return get("mediaType"); }
        public String getImageUrl() { return get("imageUrl"); }
        public String getMediaUrl() { return get("mediaUrl"); }
        public String getEmbedUrl() { return get("embedUrl"); }
        public String getRemark() { return get("remark"); }
        public String getImageWidth() { return get("imageWidth"); }
        public String getImageHeight() { return get("imageHeight"); }
        public int getImageSequence() {
            Object v = data.get("imageSequence");
            if (v instanceof Number n) return n.intValue();
            try { return Integer.parseInt(string(v)); } catch (NumberFormatException ex) { return 0; }
        }
        public boolean hasImageUrl() { return getImageUrl().length() > 6; }
        public boolean hasMediaUrl() { return getMediaUrl().length() > 6 || hasImageUrl(); }
        public boolean hasEmbedUrl() { return getEmbedUrl().length() > 6; }
        public boolean isImage() { return "image".equalsIgnoreCase(getMediaType()); }
        public boolean isNativeVideo() { return "video".equalsIgnoreCase(getMediaType()); }
        public boolean isYouTube() { return getMediaType().toLowerCase().startsWith("youtube"); }
        public boolean isFacebook() { return "facebook".equalsIgnoreCase(getMediaType()); }
        public boolean isTikTok() { return "tiktok".equalsIgnoreCase(getMediaType()); }
        public String getDisplayMediaUrl() { return getMediaUrl().isBlank() ? getImageUrl() : getMediaUrl(); }
        public String getWidthCss() { return getImageWidth().isBlank() ? "100%" : getImageWidth(); }
        public String getHeightCss() { return getImageHeight().isBlank() ? "auto" : getImageHeight(); }
        public String getTikTokVideoId() {
            String url = getDisplayMediaUrl();
            int index = url.indexOf("/video/");
            if (index < 0) return "";
            String id = url.substring(index + 7).split("[?&#/]", 2)[0];
            return id.matches("[0-9]+") ? id : "";
        }
    }

    /** Compatibility object, not a replacement for tenant-specific client data. */
    public static final class ClientMetadata {
        private final String name;

        public ClientMetadata(String name) {
            this.name = name;
        }
        public String getClientName() { return name; }
        public String getClientBanner() { return ""; }
        public String getClientBannerText() { return ""; }
        public String getClientAddress() { return ""; }
        public String getClientPhone() { return ""; }
        public String getClientMail() { return ""; }
        public String getClientDescription() { return ""; }
    }

    public static final class LanguageOption {
        private final String code;
        private final String name;
        private final String flagUrl;
        private final boolean selected;

        public LanguageOption(String code, String name, String flagUrl, boolean selected) {
            this.code = code;
            this.name = name;
            this.flagUrl = flagUrl;
            this.selected = selected;
        }
        public String getCode() { return code; }
        public String getName() { return name; }
        public String getFlagUrl() { return flagUrl; }
        public boolean isSelected() { return selected; }
    }

    /** Minimal SEO metadata until the original site article service is ported. */
    public static final class PageMetadata {
        private final String title;
        public PageMetadata(String title) { this.title = title; }
        public String getArticleTitle() { return title; }
        public String getArticleKeyWord() { return ""; }
        public String getArticleLink() { return ""; }
        public String getArticleDescription() { return ""; }
        public String getArticleContent() { return ""; }
        public String getArticleThumnailURL() { return ""; }
        public String getArticleThumnailURLWithHost2() { return ""; }
    }
}
