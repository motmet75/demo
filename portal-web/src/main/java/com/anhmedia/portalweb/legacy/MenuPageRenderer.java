package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.Client;
import com.anhmedia.portalweb.legacy.entity.WebMenu;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Port of GreetingController.MenuController#returnPageofMenu: menu listing
 * pages (paginated articles) and article detail pages ("*.html").
 *
 * Not ported yet (Phase 2, product data): the links "products.html" and
 * "index.html". For those, {@link #render} returns empty so the caller
 * answers 404 and Nginx serves the page from Portal 8080.
 */
@Component
public class MenuPageRenderer {
    private final LegacySite site;
    private final TenantDatabases databases;

    public MenuPageRenderer(LegacySite site, TenantDatabases databases) {
        this.site = site;
        this.databases = databases;
    }

    public record Page(String view, Map<String, Object> model) {}

    public Optional<Page> render(String menuPathForBlogPage, String menuPathForHtmlPage, String link,
                                 HttpServletRequest request, HttpSession session) {
        if ("products.html".equals(link) || "index.html".equals(link)) return Optional.empty();

        String domainString = site.domainString(request);
        String tenantId = site.resolveTenantId(domainString);
        var db = databases.forTenant(tenantId);
        if (db.isEmpty()) return Optional.empty();
        LegacyContentService content = new LegacyContentService(new LegacyContentRepository(db.get()), tenantId);
        LegacyLanguage languages = site.languages();

        Map<String, Object> context = new LinkedHashMap<>();
        site.addTenantTemplateVariables(context, domainString, tenantId);

        Article currentPageArticle = content.getArticleByLinkwithTime(link);
        currentPageArticle.setArticleThumnailURL(currentPageArticle.getArticleThumnailURL());

        String defaultLang = languages.resolveRequestedOrSessionLanguage(request, session);
        context.put("cart", site.cart(session, tenantId, defaultLang));

        List<Article> pages = content.getAllDisplayedArticle("page");
        pages = pages.stream().filter(p -> !p.getLocked()).toList();
        for (Article page : pages) {
            page.setTenantString(tenantId);
            page.setArticleLangCode(defaultLang);
            page.getURLbyAticleLangCode();
        }

        if (!link.contains(".html")) {
            context.put("page", currentPageArticle);
            context.put("subpath", "../");
            context.put("midpath", menuPathForBlogPage);

            int page = 1;
            try {
                String pageParam = request.getParameter("page");
                if (pageParam != null) page = Integer.parseInt(pageParam);
            } catch (NumberFormatException e) {
                page = 1;
            }
            // Legacy passes page-1 straight to PageRequest.of(); a page below 1
            // throws there and the request fails. Keep that out of Portal Web.
            if (page < 1) return Optional.empty();

            List<Article> articles = content.getAllDisplayedArticleWithPageWithMenu("article", link, page - 1, 12);
            long records = content.countArticlesByGroupAndMenu("article", currentPageArticle.getArticleLink());
            long totalPages = (long) Math.ceil((double) records / 12);
            context.put("currentPage", page);
            context.put("totalPages", totalPages);

            articles = articles.stream()
                    .filter(a -> a.getArticleTime() != null && a.getArticleTime().isBefore(LocalDateTime.now()))
                    .sorted(Comparator.comparing(Article::getArticleTime).reversed())
                    .toList();
            for (Article art : articles) art.setArticleThumnailURL(art.getArticleThumnailURL());
            context.put("articles", articles);
            context.put("spotlightArticles", content.getSpotlightArticle("article"));
        } else {
            context.put("article", currentPageArticle);
            context.put("articleAiSummary", content.findApprovedSummary(currentPageArticle, defaultLang));
            context.put("articleAiSummaryTitle", LegacyContentService.aiSummaryTitle(defaultLang));
            context.put("subpath", "../");
            context.put("midpath", menuPathForHtmlPage);
            List<Article> spotlight = content.getSpotlightArticle("article");
            context.put("articles", content.getTopTen("article"));
            context.put("spotlightArticles", spotlight);
        }

        context.put("pages", pages);

        Optional<Client> client = content.getClientByDomainAndLanguageCode(tenantId, defaultLang);
        context.put("client", client.orElseGet(Client::new));

        context.put("projectMenuEntities", projectMenuEntities(content, session));

        site.addFrontendTemplateControls(context, content, link, currentPageArticle.getArticleTemplate(), defaultLang);
        String view = site.localizedViewName(domainString, tenantId, currentPageArticle.getArticleTemplate(), defaultLang);
        return Optional.of(new Page(view, context));
    }

    /** The menu block shared by returnHomePage and returnPageofMenu. */
    static List<WebMenu> projectMenuEntities(LegacyContentService content, HttpSession session) {
        List<WebMenu> projects = content.getAllWebMenu();
        boolean hasRoot = projects.stream().anyMatch(p -> p.getMenuRootStringId().equals("root"));
        if (!hasRoot) return new ArrayList<>();
        WebMenu.buildMenuTree(projects, "root");
        String mapped = (String) session.getAttribute(LegacyLanguage.MAPPED_LANG);
        String lang = mapped != null ? mapped : "en";
        return projects.stream()
                .filter(p -> p.getLanguage().equals(lang) & p.getMenuRootStringId().equals("root"))
                .toList();
    }
}
