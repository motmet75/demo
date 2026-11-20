package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.Cart;
import com.anhmedia.portalweb.legacy.entity.Client;
import com.anhmedia.portalweb.legacy.entity.Product;
import com.anhmedia.portalweb.legacy.entity.ProductColor;
import com.anhmedia.portalweb.legacy.entity.ProductPrice;
import com.anhmedia.portalweb.legacy.entity.ProductSize;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Ports of GreetingController.ProductDynamicController (/product/{endpoint})
 * and SanPhamDynamicController (/san-pham/{endpoint}), both rendering
 * single-product.html. These are separate controller beans in legacy, so
 * GreetingController's @ModelAttribute language controls do NOT run for
 * them: the language is the session's, or else the product's own, and
 * ?lang= is ignored.
 */
@Component
public class ProductPageRenderer {
    private final LegacySite site;
    private final TenantDatabases databases;
    private final LegacyGlobalState global;

    public ProductPageRenderer(LegacySite site, TenantDatabases databases, LegacyGlobalState global) {
        this.site = site;
        this.databases = databases;
        this.global = global;
    }

    private record Ctx(String domainString, String tenantId, LegacyContentService content, LegacyProductService products) {}

    private Optional<Ctx> context(HttpServletRequest request) {
        String domainString = site.domainString(request);
        String tenantId = site.resolveTenantId(domainString);
        var db = databases.forTenant(tenantId);
        if (db.isEmpty()) return Optional.empty();
        return Optional.of(new Ctx(domainString, tenantId,
                new LegacyContentService(new LegacyContentRepository(db.get()), tenantId),
                new LegacyProductService(new LegacyProductRepository(db.get()), tenantId, global)));
    }

    /** defaultLangMap lookup; on a first visit the product's language becomes the session language. */
    private String sessionOrProductLanguage(HttpSession session, Product product) {
        String mapped = site.languages().mappedLanguage(session);
        if (mapped != null) return mapped;
        String lang = product.getLanguage();
        session.setAttribute("lang", lang);
        session.setAttribute(LegacyLanguage.MAPPED_LANG, lang);
        return lang;
    }

    private static String endpoint(String endpoint) {
        int q = endpoint.indexOf('?');
        return q == -1 ? endpoint : endpoint.substring(0, q);
    }

    // ---- /product/{endpoint} ----

    public Optional<MenuPageRenderer.Page> productPage(String rawEndpoint, HttpServletRequest request, HttpSession session) {
        Optional<Ctx> ctx = context(request);
        if (ctx.isEmpty()) return Optional.empty();
        Ctx c = ctx.get();
        LegacyLanguage languages = site.languages();
        Map<String, Object> mav = new LinkedHashMap<>();

        var catalogs = c.products().getAllProductCatalog();
        var brands = c.products().getAllProductDisPlayedBrand();
        Product product = c.products().getProductByPath(endpoint(rawEndpoint));

        mav.put("subpath", "../");
        String defaultLang = sessionOrProductLanguage(session, product);
        String selected = languages.normalizeFrontendLanguageCode(defaultLang);
        if (selected == null) selected = LegacyLanguage.FALLBACK_FRONTEND_LANGUAGE;
        String view = site.localizedViewName(c.domainString(), c.tenantId(), "single-product.html", selected);
        mav.put("language", selected);
        mav.put("languages", languages.getLanguagesForModel(selected));
        mav.put("languageOptions", languages.getLanguageOptionsForModel(selected));
        mav.put("selectedLanguageCode", selected);
        mav.put("selectedLanguageName", languages.displayLanguageName(selected));
        mav.put("selectedLanguageFlagUrl", languages.flagUrlForLanguage(selected));
        mav.put("cart", site.cart(session, c.tenantId(), defaultLang));

        if (product.getId() > 0) {
            product.formatPrice(c.tenantId());
            List<ProductPrice> prices = product.getPriceList();
            List<ProductColor> colors = product.getColorList();
            String color = request.getParameter("color");
            if (color != null) {
                global.colorRequeString = color;
                if (global.currentColorString.equals(color)) {
                    global.currentColorString = "none";
                } else {
                    global.currentColorString = color;
                    if (colors.stream().anyMatch(b -> b.getColorCode().equals(color))) {
                        for (ProductColor pc : colors) {
                            global.colorDisplay(c.tenantId(), pc, pc.getColorCode().equals(color) ? "" : "none");
                        }
                    }
                }
            }
            if (colors != null) mav.put("colors", colors);
            String requested = global.colorRequeString;
            if (product.getColorList().size() > 1) {
                if (product.getPriceList().isEmpty()) product.getPriceList().add(new ProductPrice("none"));
            } else if (product.getColorList().size() == 1) {
                Optional<ProductPrice> price = prices.stream().filter(p -> p.getColorCode().equals(requested)).findFirst();
                if (price.isPresent()) product.setSeletedPrice(price.get());
                else if (product.getPriceList().isEmpty()) product.getPriceList().add(new ProductPrice("not-yet-set-price"));
            } else if (product.getPriceList().isEmpty()) {
                product.getPriceList().add(new ProductPrice("allcolor"));
            }
            mav.put("product", product);
            mav.put("imageURLs", product.getImageList());
        }

        mav.put("domainsingle", LegacySite.MINH_MAP_RESOURCE_FOLDER);
        site.addTenantTemplateVariables(mav, c.domainString(), c.tenantId());
        mav.put("domaintf", LegacySite.MINH_MAP_RESOURCE_FOLDER);
        mav.put("client", c.content().getClientByDomainAndLanguageCode(c.tenantId(), defaultLang).orElseGet(Client::new));
        mav.put("projectMenuEntities", MenuPageRenderer.projectMenuEntities(c.content(), session));
        mav.put("catalogs", catalogs);
        mav.put("brands", brands);
        return Optional.of(new MenuPageRenderer.Page(view, mav));
    }

    // ---- /san-pham/{endpoint} ----

    public Optional<MenuPageRenderer.Page> sanPhamPage(String rawEndpoint, HttpServletRequest request, HttpSession session) {
        Optional<Ctx> ctx = context(request);
        if (ctx.isEmpty()) return Optional.empty();
        Ctx c = ctx.get();
        Map<String, Object> model = new LinkedHashMap<>(); // implicit Model
        Map<String, Object> mav = new LinkedHashMap<>();

        model.put("activePage", "none");
        var catalogs = c.products().getAllProductCatalog();
        var brands = c.products().getAllProductDisPlayedBrand();
        Product product = c.products().getProductByPath(endpoint(rawEndpoint));
        model.put("pHtmls", c.products().repository().getProductHtmlByGroup("rightofgallery", product.getProductCode()));

        String defaultLang = sessionOrProductLanguage(session, product);
        List<Product> relatedProducts = c.products().getRelatedProduct(product, 0, 5);

        String view = site.localizedViewName(c.domainString(), c.tenantId(), "single-product.html", defaultLang);
        mav.putAll(languageControls(request, session, defaultLang));
        Object existing = session.getAttribute("portalweb.cart");
        Cart cart = site.cart(session, c.tenantId(), defaultLang);
        if (existing != null) {
            cart.setLanguage(defaultLang);
            cart.setTenantId(c.tenantId());
        }
        mav.put("cart", cart);
        mav.put("subpath", "../");

        ProductColor requestedColor = new ProductColor();
        List<ProductColor> colors = product.getColorList();
        List<ProductSize> sizes = product.getSizeList();
        String color = request.getParameter("color");
        if (color != null) {
            global.colorRequeString = color;
            if (colors.stream().anyMatch(b -> b.getColorCode().equals(color) && b.getProductCode().equals(product.getProductCode()))) {
                for (ProductColor pc : colors) {
                    if (pc.getColorCode().equals(color) && pc.getProductCode().equals(product.getProductCode())) {
                        global.colorDisplay(c.tenantId(), pc, "");
                        requestedColor = pc;
                    } else {
                        global.colorDisplay(c.tenantId(), pc, "none");
                    }
                }
            }
        }
        ProductSize requestedSize = new ProductSize();
        String size = request.getParameter("size");
        if (size != null) {
            global.sizeRequeString = size;
            if (sizes.stream().anyMatch(b -> b.getSizeCode().equals(size) && b.getProductCode().equals(product.getProductCode()))) {
                for (ProductSize ps : sizes) {
                    if (ps.getSizeCode().equals(size) && ps.getProductCode().equals(product.getProductCode())) {
                        global.sizeDisplay(c.tenantId(), ps, "");
                        requestedSize = ps;
                    } else {
                        global.sizeDisplay(c.tenantId(), ps, "none");
                    }
                }
            }
        }

        if (product.getId() > 0) {
            product.formatPrice(c.tenantId());
            List<ProductPrice> prices = product.getPriceList();
            String requestedColorCode = global.colorRequeString;
            String requestedSizeCode = global.sizeRequeString;
            if (size == null || product.getSizeList().isEmpty()) {
                Optional<ProductPrice> price = prices.stream().filter(p -> p.getColorCode().equals(requestedColorCode)).findFirst();
                if (price.isPresent()) {
                    price.get().setSelectedColor(requestedColor);
                    product.setSeletedPrice(price.get());
                }
            } else {
                Optional<ProductPrice> price = prices.stream()
                        .filter(p -> p.getColorCode().equals(requestedColorCode) && p.getSizeCode().equals(requestedSizeCode))
                        .findFirst();
                if (price.isPresent()) {
                    price.get().setSelectedColor(requestedColor);
                    price.get().setSelectedSize(requestedSize);
                    product.setSeletedPrice(price.get());
                }
            }
            if (colors != null) mav.put("colors", colors);
            mav.put("subpath", "../");
            if (product.getColorList().size() > 1) {
                if (product.getPriceList().isEmpty()) product.getPriceList().add(new ProductPrice("none"));
            } else if (product.getColorList().size() == 1) {
                Optional<ProductPrice> price = prices.stream().filter(p -> p.getColorCode().equals(requestedColorCode)).findFirst();
                if (price.isPresent()) product.setSeletedPrice(price.get());
                else if (product.getPriceList().isEmpty()) product.getPriceList().add(new ProductPrice("not-yet-set-price"));
            } else if (!product.getPriceList().isEmpty()) {
                ProductPrice first = prices.get(0);
                global.allColorPrice(c.tenantId(), first, product.getProductImageDesUrl());
                product.setSeletedPrice(first);
            }
            mav.put("imageURLs", product.getImageList());
        }

        mav.put("projectMenuEntities", MenuPageRenderer.projectMenuEntities(c.content(), session));
        mav.put("domainsingle", LegacySite.MINH_MAP_RESOURCE_FOLDER);
        site.addTenantTemplateVariables(mav, c.domainString(), c.tenantId());
        mav.put("product", product);
        mav.put("domaintf", LegacySite.MINH_MAP_RESOURCE_FOLDER);
        mav.put("client", c.content().getClientByDomainAndLanguageCode(c.tenantId(), defaultLang).orElseGet(Client::new));
        mav.put("catalogs", catalogs);
        mav.put("brands", brands);

        List<Article> pages = c.content().getAllDisplayedArticle("page").stream().filter(p -> !p.getLocked()).toList();
        for (Article page : pages) {
            page.setTenantString(c.tenantId());
            page.setArticleLangCode(defaultLang);
            page.getURLbyAticleLangCode();
        }
        mav.put("pages", pages);
        mav.put("relatedProducts", relatedProducts);

        model.putAll(mav);
        return Optional.of(new MenuPageRenderer.Page(view, model));
    }

    /** The private addGlobalLanguageControls(mav, request, session, selectedLanguage) overload. */
    private Map<String, Object> languageControls(HttpServletRequest request, HttpSession session, String lang) {
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
