package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.Client;
import com.anhmedia.portalweb.legacy.entity.Language;
import com.anhmedia.portalweb.legacy.entity.WebMenu;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Ports of the remaining public GreetingController pages:
 * about() (/gioi-thieu.html, /about.html), contact() (/contact.html,
 * /lien-he.html), videos(), marine(), tinTuc(), contentPage() (policies,
 * knowledge center, guides), blog() (/bai-viet.html, /article.html,
 * /blog.html) and LoginPage() (/dang-nhap; the login itself is a POST and
 * stays on Portal 8080).
 *
 * All of these are GreetingController handlers, so its @ModelAttribute
 * language controls run first and seed the model.
 */
@Component
public class StaticPagesRenderer {
    private final LegacySite site;
    private final TenantDatabases databases;
    private final HomePageRenderer home;
    private final Path languagesXml;

    public StaticPagesRenderer(LegacySite site, TenantDatabases databases, HomePageRenderer home,
                               @Value("${portal.web.config-path:/opt/tuonghoa/portal/xml/config.xml}") String configXml) {
        this.site = site;
        this.databases = databases;
        this.home = home;
        this.languagesXml = Path.of(configXml).toAbsolutePath().normalize().resolveSibling("languages.xml");
    }

    private record Ctx(String domain, String tenant, LegacyContentService content, LegacyProductService products,
                       Map<String, Object> model) {}

    private Optional<Ctx> ctx(HttpServletRequest request, HttpSession session) {
        String domain = site.domainString(request);
        String tenant = site.resolveTenantId(domain);
        var db = databases.forTenant(tenant);
        if (db.isEmpty()) return Optional.empty();
        Map<String, Object> model = new LinkedHashMap<>(home.globalLanguageControls(request, session));
        return Optional.of(new Ctx(domain, tenant, new LegacyContentService(new LegacyContentRepository(db.get()), tenant),
                new LegacyProductService(new LegacyProductRepository(db.get()), tenant), model));
    }

    /** defaultLangMap: session language, else the page article's language (stored for the session). */
    private String sessionOr(HttpSession session, String fallback) {
        String mapped = site.languages().mappedLanguage(session);
        if (mapped != null) return mapped;
        session.setAttribute("lang", fallback);
        session.setAttribute(LegacyLanguage.MAPPED_LANG, fallback);
        return fallback;
    }

    private static List<Article> pages(LegacyContentService content, String tenant, String lang) {
        List<Article> pages = content.getAllDisplayedArticle("page").stream().filter(p -> !p.getLocked()).toList();
        for (Article p : pages) {
            p.setTenantString(tenant);
            p.setArticleLangCode(lang);
            p.getURLbyAticleLangCode();
        }
        return pages;
    }

    private static Optional<MenuPageRenderer.Page> page(String view, Map<String, Object> model) {
        return Optional.of(new MenuPageRenderer.Page(view, model));
    }

    // ---- about() ----

    public Optional<MenuPageRenderer.Page> about(String templateLink, HttpServletRequest request, HttpSession session) {
        Optional<Ctx> o = ctx(request, session);
        if (o.isEmpty()) return Optional.empty();
        Ctx c = o.get();
        Map<String, Object> m = c.model();
        m.put("activePage", "about");
        m.put("subpath", "");
        site.addTenantTemplateVariables(m, c.domain(), c.tenant());
        Article pageArticle = c.content().getArticleByLink(templateLink);
        String lang = sessionOr(session, pageArticle.getArticleLangCode());
        m.put("client", c.content().getClientByDomainAndLanguageCode(c.tenant(), lang).orElseGet(Client::new));
        m.put("cart", site.cart(session, c.tenant(), lang));
        m.put("partners", c.products().getAllPartner());
        m.put("page", pageArticle);
        m.put("brands", c.products().getAllProductCatalog()); // legacy puts the catalogs under "brands"
        m.put("projectMenuEntities", MenuPageRenderer.projectMenuEntities(c.content(), session));
        m.put("selectedHomeCatalogs", c.products().getAllProductCatalog());
        m.put("pages", pages(c.content(), c.tenant(), lang));
        return page(site.localizedViewName(c.domain(), c.tenant(), pageArticle.getArticleTemplate(), lang), m);
    }

    // ---- contact() / videos() ----

    public Optional<MenuPageRenderer.Page> contact(String templateLink, HttpServletRequest request, HttpSession session) {
        return contactLike(templateLink == null ? "contact.html" : templateLink, request, session, null);
    }

    public Optional<MenuPageRenderer.Page> videos(int page, String templateLink, HttpServletRequest request, HttpSession session) {
        return contactLike(templateLink == null ? "videos.html" : templateLink, request, session, page);
    }

    private Optional<MenuPageRenderer.Page> contactLike(String templateLink, HttpServletRequest request, HttpSession session,
                                                        Integer videosPage) {
        Optional<Ctx> o = ctx(request, session);
        if (o.isEmpty()) return Optional.empty();
        Ctx c = o.get();
        Map<String, Object> m = c.model();
        m.put("subpath", "");
        site.addTenantTemplateVariables(m, c.domain(), c.tenant());
        List<?> productsWithVideos = null;
        int currentPage = 0;
        int totalPages = 0;
        if (videosPage != null) {
            currentPage = Math.max(videosPage, 1);
            productsWithVideos = c.products().getProductsWithVideosByPage(currentPage - 1, 6);
            long total = c.products().repository().countProductsWithVideos();
            totalPages = (int) Math.ceil((double) total / 6);
        }
        m.put("activePage", "contact");
        Article pageArticle = c.content().getArticleByLink(templateLink);
        String lang = sessionOr(session, pageArticle.getArticleLangCode());
        m.put("client", c.content().getClientByDomainAndLanguageCode(c.tenant(), lang).orElseGet(Client::new));
        m.put("cart", site.cart(session, c.tenant(), lang));
        m.put("page", pageArticle);
        var catalogs = c.products().getAllProductCatalog();
        m.put("brands", catalogs);
        m.put("catalogs", catalogs);
        m.put("projectMenuEntities", MenuPageRenderer.projectMenuEntities(c.content(), session));
        m.put("selectedHomeCatalogs", c.products().getAllProductCatalog());
        m.put("pages", pages(c.content(), c.tenant(), lang));
        if (videosPage != null) {
            m.put("productsWithVideos", productsWithVideos);
            m.put("currentPage", currentPage);
            m.put("totalPages", totalPages);
        }
        return page(site.localizedViewName(c.domain(), c.tenant(), pageArticle.getArticleTemplate(), lang), m);
    }

    // ---- marine() / tinTuc() ----

    public Optional<MenuPageRenderer.Page> articleList(int page, String midpath, String pageLink,
                                                       HttpServletRequest request, HttpSession session) {
        Optional<Ctx> o = ctx(request, session);
        if (o.isEmpty()) return Optional.empty();
        Ctx c = o.get();
        Map<String, Object> m = c.model();
        String searchTerm = request.getParameter("searchTerm");
        site.addTenantTemplateVariables(m, c.domain(), c.tenant());
        m.put("activePage", "blog");
        m.put("subpath", "");
        m.put("midpath", midpath);
        List<Article> articles;
        long records;
        if (searchTerm != null && !searchTerm.isBlank()) {
            articles = c.content().findByCatalogOrSubCatalogWithPage(searchTerm, "article", page - 1, 12);
            records = c.content().countByCatalogOrSubCatalog("article", searchTerm);
            m.put("searchTerm", searchTerm);
        } else {
            articles = c.content().getAllDisplayedArticlWithPage("article", page - 1, 12);
            records = c.content().countArticlesByGroup("article");
        }
        m.put("currentPage", page);
        m.put("totalPages", (long) Math.ceil((double) records / 12));
        articles = sortedPublished(articles);
        for (Article a : articles) a.setArticleThumnailURL(a.getArticleThumnailURL());
        m.put("articles", articles);
        Article pageArticle = c.content().getArticleByLink(pageLink);
        String lang = sessionOr(session, pageArticle.getArticleLangCode());
        m.put("page", pageArticle);
        m.put("client", c.content().getClientByDomainAndLanguageCode(c.tenant(), lang).orElseGet(Client::new));
        m.put("cart", site.cart(session, c.tenant(), lang));
        m.put("pages", pages(c.content(), c.tenant(), lang));
        return page(site.localizedViewName(c.domain(), c.tenant(), "blog.html", lang), m);
    }

    private static List<Article> sortedPublished(List<Article> articles) {
        return articles.stream()
                .filter(a -> a.getArticleTime() != null && a.getArticleTime().isBefore(LocalDateTime.now()))
                .sorted(Comparator.comparing(Article::getArticleTime).reversed())
                .toList();
    }

    // ---- contentPage() ----

    public Optional<MenuPageRenderer.Page> contentPage(String templateName, String title, String description, String keywords,
                                                       HttpServletRequest request, HttpSession session) {
        Optional<Ctx> o = ctx(request, session);
        if (o.isEmpty()) return Optional.empty();
        Ctx c = o.get();
        Map<String, Object> m = c.model();
        site.addTenantTemplateVariables(m, c.domain(), c.tenant());
        String language = site.languages().resolveRequestedOrSessionLanguage(request, session);
        Article page = new Article(title, templateName, templateName, "page", language);
        page.setArticleDescription(description);
        page.setArticleKeyWord(keywords);
        page.setArticleContent(description);
        page.setArticleThumnailURLWithHost2("https://tuonghoa-imex.com/tuonghoa-imex.com/images/logo.png");
        m.put("page", page);
        m.put("activePage", "content");
        m.put("subpath", "");
        m.put("client", c.content().getClientByDomainAndLanguageCode(c.tenant(), language).orElseGet(Client::new));
        m.put("cart", site.cart(session, c.tenant(), language));
        m.put("projectMenuEntities", contentMenu(c.content(), language));
        return page(site.localizedViewName(c.domain(), c.tenant(), templateName, language), m);
    }

    /** addProjectMenuEntities: the session language's root menus, else the English ones. */
    private static List<WebMenu> contentMenu(LegacyContentService content, String language) {
        List<WebMenu> projects = content.getAllWebMenu();
        if (projects == null || projects.isEmpty()) return new ArrayList<>();
        if (projects.stream().noneMatch(p -> "root".equals(p.getMenuRootStringId()))) return new ArrayList<>();
        WebMenu.buildMenuTree(projects, "root");
        List<WebMenu> roots = projects.stream()
                .filter(p -> language.equals(p.getLanguage()) && "root".equals(p.getMenuRootStringId())).toList();
        if (roots.isEmpty()) {
            roots = projects.stream()
                    .filter(p -> LegacyLanguage.FALLBACK_FRONTEND_LANGUAGE.equals(p.getLanguage()) && "root".equals(p.getMenuRootStringId()))
                    .toList();
        }
        return roots;
    }

    // ---- blog() ----

    public Optional<MenuPageRenderer.Page> blog(int page, String midpath, String templateLink,
                                                HttpServletRequest request, HttpSession session) {
        Optional<Ctx> o = ctx(request, session);
        if (o.isEmpty()) return Optional.empty();
        Ctx c = o.get();
        Map<String, Object> m = c.model();
        String searchTerm = request.getParameter("searchTerm");
        m.put("activePage", "blog");
        var catalogs = c.products().getAllProductCatalog();
        var brands = c.products().getAllProductDisPlayedBrand();
        if (templateLink == null) templateLink = "blog.html";
        Article pageArticle = c.content().getArticleByLink(templateLink);
        String lang = sessionOr(session, pageArticle.getArticleLangCode());
        List<Article> articles = c.content().getAllDisplayedArticlWithPage("article", page - 1, 12);
        long records = c.content().countArticlesByGroup("article");
        if (searchTerm != null) {
            articles = c.content().findByCatalogOrSubCatalogWithPage(searchTerm, "article", page - 1, 12);
            records = c.content().countByCatalogOrSubCatalog("article", searchTerm);
            m.put("searchTerm", searchTerm);
        }
        m.put("currentPage", page);
        m.put("totalPages", (long) Math.ceil((double) records / 12));
        m.put("midpath", midpath == null ? "bai-viet" : midpath);
        articles = sortedPublished(articles);
        for (Article a : articles) a.setArticleThumnailURL(a.getArticleThumnailURL());
        m.put("products", c.products().getAllDisPlayedProduct());
        site.addTenantTemplateVariables(m, c.domain(), c.tenant());
        m.put("subpath", "../");
        m.put("client", c.content().getClientByDomainAndLanguageCode(c.tenant(), lang).orElseGet(Client::new));
        m.put("cart", site.cart(session, c.tenant(), lang));
        m.put("page", pageArticle);
        c.content().getTopTen("article"); // legacy stores it under "articles", then overwrites it below
        m.put("pages", pages(c.content(), c.tenant(), lang));
        m.put("catalogs", catalogs);
        m.put("articles", articles);
        m.put("brands", brands);
        Object sessionLang = session.getAttribute("lang");
        String languageCode = sessionLang == null ? "vi" : sessionLang.toString();
        List<Language> languages = parseLanguages();
        for (Language l : languages) l.setSelected(l.getLangId().equals(languageCode));
        if (request.getParameter("loaded") != null) {
            lang = request.getParameter("loaded");
            m.put("languages", languages);
        }
        m.put("projectMenuEntities", MenuPageRenderer.projectMenuEntities(c.content(), session));
        m.put("selectedHomeCatalogs", c.products().getAllProductCatalog());
        return page(site.localizedViewName(c.domain(), c.tenant(), pageArticle.getArticleTemplate(), lang), m);
    }

    // ---- instructionGallery() ----

    public Optional<MenuPageRenderer.Page> instructionGallery(String pageKey, Long mediaId, Integer slide,
                                                              HttpServletRequest request, HttpSession session) {
        Optional<Ctx> o = ctx(request, session);
        if (o.isEmpty()) return Optional.empty();
        Ctx c = o.get();
        Map<String, Object> m = c.model();
        LegacyLanguage languages = site.languages();
        Article pageArticle = c.content().getArticleByLink("instruction-gallery.html");
        String requested = languages.normalizeFrontendLanguageCode(request.getParameter("lang"));
        String lang = requested == null
                ? (pageArticle == null || pageArticle.getId() <= 0 ? LegacyLanguage.DEFAULT_LANGUAGE : pageArticle.getArticleLangCode())
                : requested;
        if (requested != null) {
            languages.setSessionLanguage(session, requested);
        } else {
            lang = ensurePublicLanguage(session, lang);
        }
        if (pageArticle == null || pageArticle.getId() <= 0) {
            pageArticle = new Article("AnhMedia Profile Gallery", "instruction-gallery.html", "instruction-gallery.html", "page", lang);
            pageArticle.setArticleDescription("Instruction gallery and digital profile media for AnhMedia tenant users.");
            pageArticle.setArticleKeyWord("instruction gallery, profile gallery, employee timeline, AnhMedia");
            pageArticle.setArticleThumnailURL("none");
        }
        populateInstructionGalleryPublicModel(c, m, session, lang, pageArticle);

        var repo = new LegacyContentRepository(databases.forTenant(c.tenant()).orElseThrow());
        var requestedMedia = mediaId == null || mediaId <= 0 ? null : repo.findVisibleInstructionMediaById(mediaId).orElse(null);
        if (requestedMedia != null && !requestedMedia.getPageKey().isBlank()) pageKey = requestedMedia.getPageKey();
        var instructionPages = repo.findVisibleInstructionPagesByLanguage(normalizeInstructionLanguage(lang));
        com.anhmedia.portalweb.legacy.entity.InstructionPage selected = null;
        if (pageKey != null && !pageKey.trim().isEmpty()) {
            String key = pageKey.trim();
            selected = instructionPages.stream().filter(p -> key.equals(p.getPageKey())).findFirst().orElse(null);
        }
        if (selected == null && !instructionPages.isEmpty()) selected = instructionPages.get(0);
        List<com.anhmedia.portalweb.legacy.entity.InstructionMediaItem> media = selected == null || selected.getPageKey() == null
                || selected.getPageKey().trim().isEmpty() ? new ArrayList<>()
                : repo.findVisibleInstructionMediaByPageKey(selected.getPageKey().trim());
        int selectedIndex = 0;
        if (requestedMedia != null) {
            for (int i = 0; i < media.size(); i++) {
                if (media.get(i).getId().equals(requestedMedia.getId())) {
                    selectedIndex = i;
                    break;
                }
            }
        }
        m.put("instructionPages", instructionPages);
        m.put("selectedInstructionPage", selected);
        m.put("instructionMediaItems", media);
        m.put("galleryPageKey", selected == null ? "" : selected.getPageKey());
        m.put("instructionGalleryTotalItems", media.size());
        m.put("selectedInstructionMediaId", requestedMedia == null ? "" : requestedMedia.getId().toString());
        m.put("selectedInstructionIndex", selectedIndex);
        m.put("selectedInstructionSlide", slide == null || slide < 0 ? 0 : slide);
        site.addFrontendTemplateControls(m, c.content(), "instruction-gallery.html", "instruction-gallery.html", lang);
        return page(site.viewName(c.domain(), c.tenant(), "instruction-gallery.html"), m);
    }

    /** ensurePublicLanguage: the session's mapped language, else store the fallback. */
    private String ensurePublicLanguage(HttpSession session, String fallback) {
        String lang = site.languages().normalizeFrontendLanguageCode(fallback);
        if (lang == null) lang = LegacyLanguage.DEFAULT_LANGUAGE;
        String mapped = site.languages().mappedLanguage(session);
        if (mapped != null) return mapped;
        site.languages().setSessionLanguage(session, lang);
        return lang;
    }

    /** InstructionExperienceService.normalizeLanguageCode. */
    private static String normalizeInstructionLanguage(String value) {
        String clean = value == null ? "" : value.trim().toLowerCase(java.util.Locale.ROOT).replace('_', '-');
        if (clean.isEmpty()) return "vi";
        int dash = clean.indexOf('-');
        return dash > 0 ? clean.substring(0, dash) : clean;
    }

    /** populateInstructionGalleryPublicModel. */
    private void populateInstructionGalleryPublicModel(Ctx c, Map<String, Object> m, HttpSession session, String lang, Article pageArticle) {
        m.put("activePage", "instruction-gallery");
        m.put("subpath", "");
        m.put("language", lang);
        site.addTenantTemplateVariables(m, c.domain(), c.tenant());
        m.put("cart", site.cart(session, c.tenant(), lang));
        m.put("client", c.content().getClientByDomainAndLanguageCode(c.tenant(), lang).orElseGet(Client::new));
        var catalogs = c.products().getAllProductCatalog();
        m.put("catalogs", catalogs);
        m.put("selectedHomeCatalogs", catalogs);
        m.put("brands", c.products().getAllProductDisPlayedBrand());
        m.put("products", new ArrayList<>());
        m.put("pages", pages(c.content(), c.tenant(), lang));
        List<WebMenu> projects = c.content().getAllWebMenu();
        List<WebMenu> menu = new ArrayList<>();
        if (projects.stream().anyMatch(p -> "root".equals(p.getMenuRootStringId()))) {
            WebMenu.buildMenuTree(projects, "root");
            String mapped = site.languages().mappedLanguage(session);
            String menuLang = mapped == null ? lang : mapped;
            menu = projects.stream().filter(p -> "root".equals(p.getMenuRootStringId()) && menuLang.equals(p.getLanguage())).toList();
            if (menu.isEmpty()) menu = projects.stream().filter(p -> "root".equals(p.getMenuRootStringId())).toList();
        }
        m.put("projectMenuEntities", menu);
        m.put("page", pageArticle);
    }

    // ---- LoginPage() ----

    public Optional<MenuPageRenderer.Page> login(HttpServletRequest request, HttpSession session) {
        Optional<Ctx> o = ctx(request, session);
        if (o.isEmpty()) return Optional.empty();
        Ctx c = o.get();
        Map<String, Object> m = c.model();
        session.setAttribute("tenant", c.tenant());
        m.put("subpath", "");
        site.addTenantTemplateVariables(m, c.domain(), c.tenant());
        String mapped = site.languages().mappedLanguage(session);
        String lang = mapped != null ? mapped : "vi";
        m.put("client", c.content().getClientByDomainAndLanguageCode(c.tenant(), lang).orElseGet(Client::new));
        return page(site.viewName(c.domain(), c.tenant(), "login-page.html"), m);
    }

    private List<Language> parseLanguages() {
        List<Language> languages = new ArrayList<>();
        try {
            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
            f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            NodeList nodes = f.newDocumentBuilder().parse(languagesXml.toFile()).getElementsByTagName("Language");
            for (int i = 0; i < nodes.getLength(); i++) {
                Element e = (Element) nodes.item(i);
                languages.add(new Language(e.getElementsByTagName("langId").item(0).getTextContent(),
                        e.getElementsByTagName("langName").item(0).getTextContent(),
                        e.getElementsByTagName("sequence").item(0).getTextContent()));
            }
        } catch (Exception ignored) {
            // legacy prints the stack trace and returns what it has
        }
        return languages;
    }
}
