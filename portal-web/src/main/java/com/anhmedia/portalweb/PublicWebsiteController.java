package com.anhmedia.portalweb;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

/**
 * Initial public-theme renderer. Model defaults prevent legacy home templates
 * from throwing on missing attributes while real tenant-aware read-only
 * content APIs are migrated. Defaults are NOT customer/product data.
 */
@Controller
public class PublicWebsiteController {
    private final ThemeRegistry themes;

    public PublicWebsiteController(ThemeRegistry themes) {
        this.themes = themes;
    }

    @GetMapping("/healthz")
    public ResponseEntity<String> health() {
        return ResponseEntity.ok("portal-web:ok");
    }

    @GetMapping({"/", "/home"})
    public String home(HttpServletRequest request, Model model) {
        ThemeRegistry.Theme theme = themes.findForHost(request.getServerName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "No live Portal theme mapped for host"));

        String lang = "vi".equalsIgnoreCase(request.getParameter("lang")) ? "vi" : "en";
        String flag = "/img/languageflags/" + lang + ".png";
        model.addAttribute("tenant", theme.tenant());
        model.addAttribute("tenantId", theme.tenant());
        model.addAttribute("domain", theme.host());
        model.addAttribute("domainString", theme.host());
        model.addAttribute("templateFolder", theme.folder());
        model.addAttribute("companynameshort", theme.tenant());
        model.addAttribute("companywelcometext", "");

        // The original templates expect these model names. Use explicit empty
        // collections until tenant-isolated content services are available.
        // Never invent products, prices, contacts, articles or media.
        model.addAttribute("client", new ClientMetadata(theme.tenant()));
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
        return theme.viewName();
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
        public String getArticleThumnailURL() { return ""; }
        public String getArticleThumnailURLWithHost2() { return ""; }
    }
}
