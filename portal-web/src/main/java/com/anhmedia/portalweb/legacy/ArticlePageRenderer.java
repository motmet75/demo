package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.Client;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Port of GreetingController.ArticleController (/article/{x}),
 * BaiVietController (/bai-viet/{x}) and BlogController (/blog/{x}): one
 * article rendered with blog-single.html. They differ only in "midpath"
 * ("article" for /article/, "bai-viet" for both /bai-viet/ and /blog/ - a
 * legacy copy-paste kept for parity). Separate legacy controller beans, so
 * no @ModelAttribute language controls: the language is the session's, or
 * else the article's own.
 */
@Component
public class ArticlePageRenderer {
    private final LegacySite site;
    private final TenantDatabases databases;

    public ArticlePageRenderer(LegacySite site, TenantDatabases databases) {
        this.site = site;
        this.databases = databases;
    }

    public Optional<MenuPageRenderer.Page> render(String endpoint, String midpath, HttpServletRequest request, HttpSession session) {
        String domainString = site.domainString(request);
        String tenant = site.resolveTenantId(domainString);
        var db = databases.forTenant(tenant);
        if (db.isEmpty()) return Optional.empty();
        LegacyContentService content = new LegacyContentService(new LegacyContentRepository(db.get()), tenant);

        Map<String, Object> model = new LinkedHashMap<>(); // implicit Model
        site.addTenantTemplateVariables(model, domainString, tenant);
        Map<String, Object> mav = new LinkedHashMap<>();

        Article article = content.getArticleByLinkwithTime(endpoint);
        article.setArticleThumnailURL(article.getArticleThumnailURL());
        mav.put("subpath", "../");
        mav.put("midpath", midpath);

        String defaultLang = article.getArticleLangCode();
        String mapped = site.languages().mappedLanguage(session);
        if (mapped != null) {
            defaultLang = mapped;
        } else {
            session.setAttribute("lang", defaultLang);
            session.setAttribute(LegacyLanguage.MAPPED_LANG, defaultLang);
        }
        String view = site.localizedViewName(domainString, tenant, "blog-single.html", defaultLang);
        mav.putAll(languageControls(request, session, defaultLang));
        mav.put("cart", site.cart(session, tenant, defaultLang));
        mav.put("articleAiSummary", content.findApprovedSummary(article, defaultLang));
        mav.put("articleAiSummaryTitle", LegacyContentService.aiSummaryTitle(defaultLang));
        mav.put("article", article);

        List<Article> pages = content.getAllDisplayedArticle("page").stream().filter(p -> !p.getLocked()).toList();
        for (Article page : pages) {
            page.setTenantString(tenant);
            page.setArticleLangCode(defaultLang);
            page.getURLbyAticleLangCode();
        }
        mav.put("pages", pages);
        mav.put("client", content.getClientByDomainAndLanguageCode(tenant, defaultLang).orElseGet(Client::new));
        mav.put("projectMenuEntities", MenuPageRenderer.projectMenuEntities(content, session));

        model.putAll(mav);
        return Optional.of(new MenuPageRenderer.Page(view, model));
    }

    /** addGlobalLanguageControls(mav, request, session, selectedLanguage). */
    Map<String, Object> languageControls(HttpServletRequest request, HttpSession session, String lang) {
        LegacyLanguage languages = site.languages();
        String normalized = languages.normalizeFrontendLanguageCode(lang);
        if (normalized == null) normalized = languages.resolveRequestedOrSessionLanguage(request, session);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("language", normalized);
        m.put("languages", languages.getLanguagesForModel(normalized));
        m.put("languageOptions", languages.getLanguageOptionsForModel(normalized));
        m.put("selectedLanguageCode", normalized);
        m.put("selectedLanguageName", languages.displayLanguageName(normalized));
        m.put("selectedLanguageFlagUrl", languages.flagUrlForLanguage(normalized));
        m.put("languageRedirectPath", HomePageRenderer.currentRootRelativeRequestPath(request));
        return m;
    }
}
