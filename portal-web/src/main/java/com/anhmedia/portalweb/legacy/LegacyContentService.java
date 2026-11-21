package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.Client;
import com.anhmedia.portalweb.legacy.entity.TemplateImage;
import com.anhmedia.portalweb.legacy.entity.WebMenu;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.safety.Safelist;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Legacy service-layer behaviour (ArticleService, TemplateImageService,
 * ClientService, WebMenuService, ArticleAiSummaryService) for ONE tenant.
 * Post-query filtering, sorting and entity side effects are kept as-is.
 */
public class LegacyContentService {
    private static final Logger log = LoggerFactory.getLogger(LegacyContentService.class);
    private static final Safelist SUMMARY_HTML = new Safelist().addTags("p", "ul", "ol", "li", "strong", "em", "br");

    private final LegacyContentRepository repo;
    private final String tenant;

    public LegacyContentService(LegacyContentRepository repo, String tenant) {
        this.repo = repo;
        this.tenant = tenant;
    }

    // ---- ArticleService ----

    public List<Article> getTopTen(String type) {
        List<Article> list = repo.getAllDisplayArticleByTypeAndPage(type + "%", 0, 10);
        for (Article a : list) {
            a.setHostString(tenant);
            a.setArticleThumnailURL(a.getArticleThumnailURL());
        }
        return list;
    }

    public List<Article> getSpotlightArticle(String type) {
        List<Article> list = repo.getSpotlightArticle(type + "%", "%spotlight%", 0, 5);
        for (Article a : list) {
            a.setHostString(tenant);
            a.setArticleThumnailURL(a.getArticleThumnailURL());
        }
        return list.stream().sorted(Comparator.comparing(Article::getIndex)).toList();
    }

    /** getAllArticle(type + "%"): the legacy cache never hits (types map is never written). */
    private List<Article> getAllArticle(String typePattern) {
        List<Article> list = repo.getAllArticleByType(typePattern + "%");
        for (Article a : list) {
            a.setHostString(tenant);
            a.setArticleThumnailURL(a.getArticleThumnailURL());
        }
        return list;
    }

    public List<Article> getAllDisplayedArticle(String type) {
        List<Article> list = getAllArticle(type + "%");
        if (list.isEmpty()) return Collections.emptyList();
        return list.stream()
                .filter(a -> a.getApproved() && a.getVisible() && !a.getLocked())
                .sorted(Comparator.comparing(Article::getIndex, Comparator.naturalOrder()))
                .toList();
    }

    public List<Article> getAllDisplayedArticleWithPageWithMenu(String type, String pageLink, int page, int size) {
        List<Article> list = repo.getAllDisplayedArticleWithPageWithMenu(type + "%", "%" + pageLink + "%", page, size);
        for (Article a : list) a.setHostString(tenant);
        return list;
    }

    /** getAllDisplayedArticlWithPage (sets the host only; no thumbnail recompute). */
    public List<Article> getAllDisplayedArticlWithPage(String type, int page, int size) {
        List<Article> list = repo.getAllDisplayArticleByTypeAndPage(type + "%", page, size);
        for (Article a : list) a.setHostString(tenant);
        return list;
    }

    public long countArticlesByGroup(String type) { return repo.countArticlesByGroup(type + "%"); }

    /** findByCatalogOrSubCatalogWithPage: note the catalog is passed WITHOUT a trailing '%'. */
    public List<Article> findByCatalogOrSubCatalogWithPage(String searchTerm, String catalog, int page, int size) {
        List<Article> list = repo.findArticlesByCatalogOrSubCatalogPageable(catalog, searchTerm, page, size);
        if (list.isEmpty()) return Collections.emptyList();
        for (Article a : list) {
            a.setTenantString(tenant);
            a.setHostString(tenant);
            a.setArticleThumnailURL(a.getArticleThumnailURL());
        }
        return list.stream().filter(a -> a.getApproved() && a.getVisible() && !a.getLocked())
                .sorted(Comparator.comparing(Article::getModifiedTime)).toList();
    }

    /** countByCatalogOrSubCatalog(type, searchTerm): type + "%". */
    public long countByCatalogOrSubCatalog(String type, String searchTerm) {
        return repo.countArticlesByCatalogOrSubCatalog(type + "%", searchTerm);
    }

    public long countArticlesByGroupAndMenu(String type, String pageLink) {
        return repo.countArticlesByGroupAndMenu(type + "%", "%" + pageLink + "%");
    }

    /** getArticleByLinkwithTime: hidden, unapproved, locked or future articles become an empty Article. */
    public Article getArticleByLinkwithTime(String link) {
        Article a = repo.findArticleByUrl(link == null ? "" : link.trim().toLowerCase(java.util.Locale.ROOT));
        if (a == null || !a.getVisible() || !a.getApproved() || a.getLocked()
                || a.getArticleTime().isAfter(LocalDateTime.now())) {
            return new Article();
        }
        a.setHostString(tenant);
        return a;
    }

    /** getArticleByLink (used by home pages). */
    public Article getArticleByLink(String link) {
        Article a = repo.findArticleByUrl(link == null ? "" : link.trim().toLowerCase(java.util.Locale.ROOT));
        if (a == null) return new Article();
        a.setArticleThumnailURL(a.getArticleThumnailURL());
        return a;
    }

    // ---- ClientService / WebMenuService ----

    public Optional<Client> getClientByDomainAndLanguageCode(String domain, String lang) {
        return repo.getClientByDomainAndLanguageCode(domain, lang);
    }

    public List<WebMenu> getAllWebMenu() {
        return new ArrayList<>(repo.getAllWebMenu());
    }

    // ---- TemplateImageService ----

    public List<TemplateImage> getTemplateImages(String templateLink, String templateName, String langCode) {
        try {
            String lang = normalizeTemplateLang(langCode);
            List<TemplateImage> images = firstAvailable(templateLink, lang);
            if (images.isEmpty() && hasText(templateName) && !same(templateName, templateLink)) {
                images = firstAvailable(templateName, lang);
            }
            if (images.isEmpty() && !"vi".equals(lang)) {
                images = firstAvailable(templateLink, "vi");
                if (images.isEmpty() && hasText(templateName) && !same(templateName, templateLink)) {
                    images = firstAvailable(templateName, "vi");
                }
            }
            return images;
        } catch (Exception e) {
            log.warn("template image query failed for tenant {}: {}", tenant, e.getMessage());
            return new ArrayList<>();
        }
    }

    private List<TemplateImage> firstAvailable(String templateLink, String lang) {
        if (!hasText(templateLink)) return new ArrayList<>();
        return repo.findVisibleTemplateImages(templateLink.trim(), lang);
    }

    /** TemplateImageService.normalizeLang. */
    static String normalizeTemplateLang(String value) {
        if (!hasText(value)) return "vi";
        String code = value.trim().toLowerCase().replace('_', '-');
        if (code.startsWith("zh") || code.startsWith("cn")) return "cn";
        if (code.startsWith("ko") || code.endsWith("-kr")) return "ko";
        if (code.startsWith("ja") || code.endsWith("-jp")) return "ja";
        if (code.startsWith("es")) return "es";
        if (code.startsWith("dv") || code.endsWith("-mv")) return "dv";
        if (code.startsWith("ms") || code.endsWith("-my")) return "ms";
        if (code.startsWith("id") || code.startsWith("in")) return "id";
        if (code.startsWith("en")) return "en";
        // Legacy: every other language (tw, ar, fr, ur, fil, ...) falls back to "vi".
        return "vi";
    }

    // ---- ArticleAiSummaryService ----

    public String findApprovedSummary(Article article, String language) {
        if (article == null || article.getId() == null || article.getId() <= 0) return "";
        try {
            String lang = language;
            if (lang == null || lang.isBlank()) lang = article.getArticleLangCode();
            lang = lang == null || lang.isBlank() ? "en" : lang.trim().toLowerCase();
            return repo.findLatestApprovedSummaryHtml(article.getId(), lang, article.getArticleContent())
                    .map(LegacyContentService::sanitize).orElse("");
        } catch (RuntimeException e) {
            log.warn("Could not load approved AI summary for article {} in tenant {}: {}",
                    article.getId(), tenant, e.getMessage());
            return "";
        }
    }

    public static String aiSummaryTitle(String language) {
        String lang = language == null || language.isBlank() ? "en" : language.trim().toLowerCase();
        return lang.startsWith("vi") ? "Tóm tắt biên tập" : "Editorial summary";
    }

    private static String sanitize(String html) {
        if (html == null || html.isBlank()) return "";
        Document.OutputSettings settings = new Document.OutputSettings().prettyPrint(false);
        return Jsoup.clean(html, "", SUMMARY_HTML, settings).trim();
    }

    private static boolean same(String a, String b) { return a != null && b != null && a.equalsIgnoreCase(b); }
    private static boolean hasText(String v) { return v != null && !v.trim().isEmpty(); }
}
