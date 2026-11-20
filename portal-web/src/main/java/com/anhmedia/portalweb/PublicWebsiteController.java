package com.anhmedia.portalweb;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

/**
 * Initial isolated public-theme renderer. This intentionally does NOT expose
 * Portal's old admin routes or pretend to support dynamic product/cart pages.
 * Dynamic page models must migrate before production domain cutover.
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
        model.addAttribute("tenant", theme.tenant());
        model.addAttribute("tenantId", theme.tenant());
        model.addAttribute("domain", theme.host());
        model.addAttribute("templateFolder", theme.folder());
        model.addAttribute("companynameshort", theme.tenant());
        model.addAttribute("companywelcometext", "");
        model.addAttribute("products", List.of());
        model.addAttribute("articles", List.of());
        model.addAttribute("page", new PageMetadata(theme.tenant()));
        return theme.viewName();
    }

    /** Minimal metadata only. Rebuild old GreetingController models before public cutover. */
    public static final class PageMetadata {
        private final String title;
        public PageMetadata(String title) { this.title = title; }
        public String getArticleTitle() { return title; }
        public String getArticleKeyWord() { return ""; }
        public String getArticleLink() { return ""; }
        public String getArticleDescription() { return ""; }
        public String getArticleThumnailURL() { return ""; }
    }
}
