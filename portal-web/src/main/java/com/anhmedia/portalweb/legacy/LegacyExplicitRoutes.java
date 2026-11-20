package com.anhmedia.portalweb.legacy;

import org.springframework.http.server.PathContainer;
import org.springframework.web.util.pattern.PathPattern;
import org.springframework.web.util.pattern.PathPatternParser;

import java.util.List;

/**
 * Every explicit GET route of the legacy Portal (all 36 controllers plus the
 * Vaadin servlet). In Portal 8080 these beat the catch-all /{path} menu
 * routes. Portal Web must not answer them from its own catch-all routes,
 * or it would render a menu page where 8080 renders e.g. the cart. A match
 * here means "not ported": answer 404 and let Nginx fall back to 8080.
 *
 * Routes that Portal Web does implement are handled by their own
 * controller methods and never reach the catch-all.
 */
public final class LegacyExplicitRoutes {
    private static final List<String> PATTERNS = List.of(
            // GreetingController
            "/ads.txt", "/greeting", "/tariffapp", "/trang-ca-nhan", "/trang-ca-nhan/bao-gia",
            "/check-loading-status", "/login-user", "/login-status-2", "/trang-thai-don-hang",
            "/dang-nhap", "/dang-nhap/**", "/register", "/tariff", "/docs", "/messagebox", "/login",
            "/order", "/profile", "/vietnamse-import-chart", "/forgotpassword", "/3dwarehouse",
            "/dang-xuat", "/topselling", "/article-search", "/single-product.html",
            "/productfilter", "/productpage", "/contact.html", "/videos.html",
            "/marine.html", "/tin-tuc.html", "/one-product", "/san-pham.html", "/privacy-policy.html",
            "/terms-of-service.html", "/shipping-policy.html", "/return-policy.html",
            "/knowledge-center.html", "/guides/how-to-choose-marine-diesel-engine.html",
            "/guides/mitsubishi-vs-yanmar-marine-engines.html",
            "/guides/used-marine-engine-inspection-checklist.html",
            "/guides/marine-engine-maintenance-schedule.html", "/guides/import-used-machinery-vietnam.html",
            "/guides/engine-specifications-explained.html", "/instruction-gallery.html", "/bai-viet.html",
            "/article.html", "/blog.html", "/gioi-thieu.html", "/about.html",
            "/gio-hang", "/dat-hang", "/don-hang-cua-toi", "/dat-hang-thanh-cong", "/lien-he.html",
            "/document", "/minhmapshop/", "/minhmapshop/product.html", "/business-profile/{endpoint}",
            "/image/{endpoint}", "/file/{endpoint}", "/files/{endpoint}", "/preview/{endpoint}",
            "/company/{endpoint}", "/article/{endpoint}", "/bai-viet/{endpoint}", "/blog/{endpoint}",
            "/doc/{endpoint}", "/api/**", "/cart/**",
            // other controllers
            "/FAQ", "/admin/**", "/doc-sach", "/facebook/**", "/facebookmedia/**", "/facebookpost/**",
            "/hello", "/instagram/**", "/linkedin/**", "/mfa-verify", "/oauth2/**", "/login/oauth2/**",
            "/open2job/**", "/pagenotfound", "/policies", "/product/download-video/{id}",
            "/products-admin.html", "/products-admin/search", "/profile-editor", "/profile-preview/{code}",
            "/profile/{slug}", "/send", "/threads/**", "/threadspost/**", "/validate", "/validation",
            "/viettelpost/**", "/youtube/**",
            // Vaadin servlet (vaadin.urlMapping=/app/*) and its resources
            "/app/**", "/VAADIN/**", "/HEARTBEAT/**", "/sw.js", "/offline.html", "/manifest.webmanifest");

    private static final List<PathPattern> PARSED;

    static {
        PathPatternParser parser = new PathPatternParser();
        PARSED = PATTERNS.stream().map(parser::parse).toList();
    }

    private LegacyExplicitRoutes() {}

    public static boolean ownedByLegacy(String requestPath) {
        String path = requestPath == null || requestPath.isEmpty() ? "/" : requestPath;
        // Legacy (Spring 5) matched with or without a trailing slash.
        String trimmed = path.length() > 1 && path.endsWith("/") ? path.substring(0, path.length() - 1) : path;
        for (PathPattern pattern : PARSED) {
            if (pattern.matches(PathContainer.parsePath(path)) || pattern.matches(PathContainer.parsePath(trimmed))) {
                return true;
            }
        }
        return false;
    }
}
