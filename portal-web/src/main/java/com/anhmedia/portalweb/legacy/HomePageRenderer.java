package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.Client;
import com.anhmedia.portalweb.legacy.entity.Partner;
import com.anhmedia.portalweb.legacy.entity.Product;
import com.anhmedia.portalweb.legacy.entity.ProductBrand;
import com.anhmedia.portalweb.legacy.entity.ProductCatalog;
import com.anhmedia.portalweb.legacy.entity.ProductGroup;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Port of GreetingController.returnHomePage (the /home, /index.html and
 * /trang-chu.html pages), including its ?keyword= / ?catalog= / ?group= /
 * ?page= product search branches.
 *
 * The final model is what Spring MVC renders for a ModelAndView handler: the
 * implicit Model (the @ModelAttribute language controls, "partners") merged
 * with the ModelAndView's own objects, which win on equal keys.
 * Portal Web has no login, so the anonymous variant is always rendered
 * (legacy adds "name"/"email" only for a logged-in OAuth user).
 */
@Component
public class HomePageRenderer {
    private final LegacySite site;
    private final TenantDatabases databases;

    public HomePageRenderer(LegacySite site, TenantDatabases databases) {
        this.site = site;
        this.databases = databases;
    }

    /** @ModelAttribute addGlobalLanguageControls (runs before every GreetingController handler). */
    public Map<String, Object> globalLanguageControls(HttpServletRequest request, HttpSession session) {
        LegacyLanguage languages = site.languages();
        String selected = languages.resolveRequestedOrSessionLanguage(request, session);
        Map<String, Object> model = new LinkedHashMap<>();
        model.put("language", selected);
        model.put("languages", languages.getLanguagesForModel(selected));
        model.put("languageOptions", languages.getLanguageOptionsForModel(selected));
        model.put("selectedLanguageCode", selected);
        model.put("selectedLanguageName", languages.displayLanguageName(selected));
        model.put("selectedLanguageFlagUrl", languages.flagUrlForLanguage(selected));
        model.put("languageRedirectPath", currentRootRelativeRequestPath(request));
        return model;
    }

    static String currentRootRelativeRequestPath(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (uri == null || uri.isBlank()) uri = "/trang-chu.html";
        String contextPath = request.getContextPath();
        if (contextPath != null && !contextPath.isBlank() && uri.startsWith(contextPath)) uri = uri.substring(contextPath.length());
        if (!uri.startsWith("/")) uri = "/" + uri;
        String query = stripLanguageQueryParameter(request.getQueryString());
        return query.isBlank() ? uri : uri + "?" + query;
    }

    private static String stripLanguageQueryParameter(String queryString) {
        if (queryString == null || queryString.isBlank()) return "";
        StringBuilder result = new StringBuilder();
        for (String part : queryString.split("&")) {
            if (part == null || part.isBlank() || part.equals("lang") || part.startsWith("lang=")) continue;
            if (result.length() > 0) result.append('&');
            result.append(part);
        }
        return result.toString();
    }

    public Optional<MenuPageRenderer.Page> render(String pageLink, Map<String, Object> implicitModel,
                                                  HttpServletRequest request, HttpSession session) {
        String domainString = site.domainString(request);
        if (domainString.isBlank()) return Optional.empty(); // legacy: empty ModelAndView
        String tenantId = site.resolveTenantId(domainString);
        var db = databases.forTenant(tenantId);
        if (db.isEmpty()) return Optional.empty();
        LegacyContentService content = new LegacyContentService(new LegacyContentRepository(db.get()), tenantId);
        LegacyProductService products = new LegacyProductService(new LegacyProductRepository(db.get()), tenantId);

        Map<String, Object> model = new LinkedHashMap<>(implicitModel); // the implicit Model
        Map<String, Object> mav = new LinkedHashMap<>();                 // the ModelAndView

        Article pageArticle = content.getArticleByLink(pageLink);
        String homeTemplate = normalizeHomeTemplateName(pageArticle == null ? null : pageArticle.getArticleTemplate());
        mav.put("page", pageArticle);

        String defaultLang = site.languages().resolveRequestedOrSessionLanguage(request, session);

        List<Partner> partners = products.getAllPartner();
        if (partners != null) model.put("partners", partners);
        else model.put("page", new ArrayList<Partner>());

        mav.put("subpath", "");
        mav.put("activePage", "home");
        mav.put("cart", site.cart(session, tenantId, defaultLang));

        List<Article> pages = content.getAllDisplayedArticle("page");
        pages = pages.stream().filter(p -> !p.getLocked()).toList();
        for (Article article : pages) {
            article.setTenantString(tenantId);
            article.setArticleLangCode(defaultLang);
            article.getURLbyAticleLangCode();
        }
        mav.put("pages", pages);

        List<Product> productList = "minhmapshop.com".equals(tenantId)
                ? products.getProductsByPage("", 0, 10)
                : products.getNewProducts();
        List<Product> productsWithVideos = products.getProductsWithVideosByPage(0, 6);
        List<ProductCatalog> catalogs = products.getAllProductCatalog();
        List<ProductBrand> brands = products.getAllProductDisPlayedBrand();
        List<Article> articles = content.getTopTen("article");
        List<Article> spotlightArticles = content.getSpotlightArticle("article");

        String secondImage = null;
        List<ProductCatalog> selectedHomeCatalogs = new ArrayList<>();
        List<ProductCatalog> topCatalogs = products.getTopProductCatalogs(3);
        final List<Product> newProducts = productList;
        for (ProductCatalog catalog : catalogs) {
            boolean hasProduct = newProducts.stream()
                    .anyMatch(p -> p.getProductCategory().getCatalogCode().equals(catalog.getCatalogCode()));
            if (hasProduct) {
                catalog.setProducts(products.getProductsByPage(catalog.getCatalogCode(), 0, 5));
                selectedHomeCatalogs.add(catalog);
            }
            if (secondImage == null && catalog.getCatalogImageDesUrl().length() > 6) {
                secondImage = catalog.getCatalogImageDesUrl();
            }
        }
        mav.put("selectedHomeCatalogs", selectedHomeCatalogs);
        if (topCatalogs != null && !topCatalogs.isEmpty()) {
            topCatalogs.get(0).setHtmlClassString("active");
            mav.put("topCatalogs", topCatalogs);
            List<String> catList = new ArrayList<>();
            catList.add(topCatalogs.get(0).getCatalogCode());
            mav.put("productofActiveCatalog", products.findProductsByCategoryCode(null, catList, 0, 5));
        }

        mav.put("products", productList);
        mav.put("productsWithVideos", productsWithVideos);
        site.addTenantTemplateVariables(mav, domainString, tenantId);
        mav.put("language", defaultLang);
        mav.put("languages", site.languages().getLanguagesForModel(defaultLang));
        String view = site.localizedViewName(domainString, tenantId, homeTemplate, defaultLang);
        site.addFrontendTemplateControls(mav, content, pageLink, homeTemplate, defaultLang);

        Optional<Client> client = content.getClientByDomainAndLanguageCode(tenantId, defaultLang);
        if (client.isPresent()) {
            mav.put("client", client.get());
            mav.put("secondImage", secondImage != null ? secondImage : client.get().getClientBanner());
        } else {
            mav.put("client", new Client());
        }
        mav.put("catalogs", catalogs);
        mav.put("brands", brands);
        mav.put("articles", articles);
        mav.put("spotlightArticles", spotlightArticles);
        mav.put("projectMenuEntities", MenuPageRenderer.projectMenuEntities(content, session));

        mav.put("productGroups", productGroups(products, request, tenantId));

        model.putAll(mav);
        return Optional.of(new MenuPageRenderer.Page(view, model));
    }

    static String normalizeHomeTemplateName(String templateName) {
        if (templateName == null || templateName.isBlank()
                || "home".equalsIgnoreCase(templateName.trim()) || "home.html".equalsIgnoreCase(templateName.trim())) {
            return "index.html";
        }
        return templateName.trim();
    }

    /** The product-group / search section at the end of returnHomePage (page size 10). */
    private List<ProductGroup> productGroups(LegacyProductService products, HttpServletRequest request, String tenantId) {
        List<ProductGroup> productGroups = products.getAllProductGroup();
        String catalogCode = request.getParameter("catalog") == null ? "" : request.getParameter("catalog").toLowerCase();
        String searchTerm = request.getParameter("keyword") == null
                ? "" : LegacyText.replaceUnitCode(request.getParameter("keyword")).toLowerCase();
        String groupParam = request.getParameter("group");
        String pageParam = request.getParameter("page");

        if (!searchTerm.isEmpty()) {
            boolean byCatalog = !"0".equals(catalogCode);
            List<String> groupIds = byCatalog
                    ? products.findGroupStringsByCatalogOrSubCatalog(catalogCode, searchTerm)
                    : products.findGroupStringsBySearchTerm(searchTerm);
            // (legacy also reassigns its local "products" here; that list is already in the model, so it has no effect)
            List<ProductGroup> returnGroups = matchGroups(productGroups, LegacyProductService.searchGroupCodes(groupIds));
            if (groupParam != null) {
                if (pageParam != null) {
                    int page = Integer.valueOf(pageParam);
                    returnGroups.stream().filter(g -> g.getStringId().equals(groupParam)).findAny().ifPresent(g -> {
                        List<Product> found = byCatalog
                                ? products.findByCatalogOrSubCatalog(groupParam, catalogCode, searchTerm, page - 1, 10)
                                : products.findBySearchTerm(groupParam, searchTerm, page - 1, 10);
                        products.formatProductsForResultImages(found);
                        g.setProducts(found, (int) (byCatalog
                                ? products.countByCatalogOrSubCatalog(groupParam, catalogCode, searchTerm)
                                : products.countBySearchTerm(groupParam, searchTerm)));
                        g.getPageItems(page, tenantId);
                    });
                }
            } else {
                for (ProductGroup g : returnGroups) {
                    List<Product> found = byCatalog
                            ? products.findByCatalogOrSubCatalog(g.getStringId(), catalogCode, searchTerm, 0, 10)
                            : products.findBySearchTerm(g.getStringId(), searchTerm, 0, 10);
                    products.formatProductsForResultImages(found);
                    g.setProducts(found, (int) (byCatalog
                            ? products.countByCatalogOrSubCatalog(g.getStringId(), catalogCode, searchTerm)
                            : products.countBySearchTerm(g.getStringId(), searchTerm)));
                }
            }
            returnGroups.sort(Comparator.comparing(ProductGroup::getProductGroupCode));
            return returnGroups;
        }

        if (!catalogCode.equals("0") && !catalogCode.isEmpty()) {
            List<String> groupIds = products.findGroupStringsByCatalogOrSubCatalog(List.of(catalogCode));
            List<ProductGroup> returnGroups = matchGroups(productGroups, LegacyProductService.searchGroupCodes(groupIds));
            if (groupParam != null) {
                if (pageParam != null) {
                    int page = Integer.valueOf(pageParam);
                    returnGroups.stream().filter(g -> g.getStringId().equals(groupParam)).findAny().ifPresent(g -> {
                        List<Product> found = products.findProductsByCategoryCode(groupParam, List.of(catalogCode), page - 1, 10);
                        products.formatProductsForResultImages(found);
                        g.setProducts(found, (int) products.countProductsByCategoryCode(groupParam, List.of(catalogCode)));
                        g.getPageItems(page, tenantId);
                    });
                }
            } else {
                for (ProductGroup g : returnGroups) {
                    List<Product> found = products.findProductsByCategoryCode(g.getStringId(), List.of(catalogCode), 0, 10);
                    products.formatProductsForResultImages(found);
                    g.setProducts(found, (int) products.countProductsByCategoryCode(g.getStringId(), List.of(catalogCode)));
                }
            }
            returnGroups.sort(Comparator.comparing(ProductGroup::getProductGroupCode));
            return returnGroups;
        }

        if (groupParam != null) {
            if (pageParam != null) {
                int page = Integer.valueOf(pageParam);
                productGroups.stream().filter(g -> g.getStringId().equals(groupParam)).findAny().ifPresent(g -> {
                    List<Product> found = products.getProductsByGroupByPage(groupParam, page - 1, 10);
                    products.formatProductsForResultImages(found);
                    g.setProducts(found, (int) products.countProductsByGroup(groupParam));
                    g.getPageItems(page, tenantId);
                });
            }
        } else {
            for (ProductGroup g : productGroups) {
                List<Product> found = products.getProductsByGroupByPage(g.getStringId(), 0, 10);
                products.formatProductsForResultImages(found);
                g.setProducts(found, (int) products.countProductsByGroup(g.getStringId()));
                g.getPageItems(1, tenantId);
            }
        }
        return productGroups;
    }

    private static List<ProductGroup> matchGroups(List<ProductGroup> all, Set<String> codes) {
        List<ProductGroup> result = new LinkedList<>();
        for (String code : codes) {
            all.stream().filter(g -> g.getStringId().equals(code)).findAny().ifPresent(result::add);
        }
        return result;
    }
}
