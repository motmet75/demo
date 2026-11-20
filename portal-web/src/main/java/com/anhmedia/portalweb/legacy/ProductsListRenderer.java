package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.CategoryAttribute;
import com.anhmedia.portalweb.legacy.entity.Client;
import com.anhmedia.portalweb.legacy.entity.Language;
import com.anhmedia.portalweb.legacy.entity.Product;
import com.anhmedia.portalweb.legacy.entity.ProductAttribute;
import com.anhmedia.portalweb.legacy.entity.ProductAttributeValue;
import com.anhmedia.portalweb.legacy.entity.ProductBrand;
import com.anhmedia.portalweb.legacy.entity.ProductCatalog;
import com.anhmedia.portalweb.legacy.entity.ProductColor;
import com.anhmedia.portalweb.legacy.entity.ProductGroup;
import com.anhmedia.portalweb.legacy.entity.ProductPrice;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Port of GreetingController.products() (/products.html) with its result
 * filters (brandFilter, minPrice/maxPrice, attributeMin_/attributeMax_ ranges,
 * keyword, catalog, group/page, productpath/color).
 */
@Component
public class ProductsListRenderer {
    private final LegacySite site;
    private final TenantDatabases databases;
    private final LegacyGlobalState global;
    private final HomePageRenderer home;
    private final Path languagesXml;

    public ProductsListRenderer(LegacySite site, TenantDatabases databases, LegacyGlobalState global, HomePageRenderer home,
                                @Value("${portal.web.config-path:/opt/tuonghoa/portal/xml/config.xml}") String configXml) {
        this.site = site;
        this.databases = databases;
        this.global = global;
        this.home = home;
        this.languagesXml = Path.of(configXml).toAbsolutePath().normalize().resolveSibling("languages.xml");
    }

    public Optional<MenuPageRenderer.Page> render(HttpServletRequest request, HttpSession session) {
        String domainString = site.domainString(request);
        String tenant = site.resolveTenantId(domainString);
        var db = databases.forTenant(tenant);
        if (db.isEmpty()) return Optional.empty();
        LegacyContentService content = new LegacyContentService(new LegacyContentRepository(db.get()), tenant);
        LegacyProductService products = new LegacyProductService(new LegacyProductRepository(db.get()), tenant, global);
        Attributes attributes = new Attributes(products.repository());

        // @ModelAttribute addGlobalLanguageControls runs first (Model is a plain model here).
        Map<String, Object> model = new LinkedHashMap<>(home.globalLanguageControls(request, session));

        String pageLink = request.getParameter("pageLink"); // unannotated String handler argument
        if (pageLink == null) pageLink = "products.html";
        model.put("activePage", "products");
        model.put("subpath", "");

        Article pageArticle = content.getArticleByLink(pageLink);
        String defaultLang = pageArticle.getArticleLangCode();
        String mapped = site.languages().mappedLanguage(session);
        if (mapped != null) {
            defaultLang = mapped;
        } else {
            session.setAttribute("lang", defaultLang);
            session.setAttribute(LegacyLanguage.MAPPED_LANG, defaultLang);
        }
        model.put("cart", site.cart(session, tenant, defaultLang));

        List<ProductCatalog> catalogs = products.getAllProductCatalog();
        List<ProductBrand> brands = products.getAllProductDisPlayedBrand();
        List<Product> productList = new ArrayList<>();

        List<String> requestCatalogCodes = parseDelimitedFilterCodes(request.getParameter("catalog"));
        List<String> selectedCatalogCodes = requestCatalogCodes.stream().filter(c -> !"0".equals(c)).collect(Collectors.toList());
        boolean hasCatalogFilter = !selectedCatalogCodes.isEmpty();
        model.put("selectedHomeCatalogs", catalogs);

        List<ProductGroup> productGroups = products.getAllProductGroup();
        String catalogCode = hasCatalogFilter ? selectedCatalogCodes.get(0) : (requestCatalogCodes.isEmpty() ? "" : "0");
        String searchTerm = request.getParameter("keyword") == null ? ""
                : LegacyText.replaceUnitCode(request.getParameter("keyword")).toLowerCase();
        String rawKeyword = request.getParameter("keyword") == null ? "" : request.getParameter("keyword");
        Set<String> selectedBrands = selectedProductBrandFilters(request);
        BigDecimal minPrice = parsePrice(request.getParameter("minPrice"));
        BigDecimal maxPrice = parsePrice(request.getParameter("maxPrice"));
        Map<String, BigDecimal> minRanges = rangeFilters(request, "attributeMin_");
        Map<String, BigDecimal> maxRanges = rangeFilters(request, "attributeMax_");
        String requestedGroup = request.getParameter("group");
        model.put("requestedProductGroup", requestedGroup == null ? "" : requestedGroup);
        boolean resultFilterVisible = !searchTerm.isEmpty() || (!catalogCode.isEmpty() && !"0".equals(catalogCode));
        List<Product> sourceProducts = new ArrayList<>();

        if (!searchTerm.isEmpty() || (!catalogCode.equals("0") && !catalogCode.isEmpty())) {
            sourceProducts = findMatchingProductsForGroups(products, productGroups, catalogCode, searchTerm);
            List<ProductGroup> groups = buildFilteredProductGroups(products, attributes, productGroups, request, catalogCode,
                    searchTerm, selectedBrands, minPrice, maxPrice, minRanges, maxRanges);
            groups.sort(Comparator.comparing(ProductGroup::getProductGroupCode));
            model.put("productGroups", groups);
        } else {
            String productPath = request.getParameter("productpath");
            if (productPath != null) {
                Product p = products.getProductByPath(productPath);
                if (p.getId() > 0) {
                    p.formatPrice(tenant);
                    List<ProductPrice> prices = p.getPriceList();
                    List<ProductColor> colors = p.getColorList();
                    String color = request.getParameter("color");
                    if (color != null) {
                        global.colorRequeString = color;
                        if (global.currentColorString.equals(color)) {
                            global.currentColorString = "none";
                        } else {
                            global.currentColorString = color;
                            if (colors.stream().anyMatch(b -> b.getColorCode().equals(color))) {
                                for (ProductColor pc : colors) global.colorDisplay(tenant, pc, pc.getColorCode().equals(color) ? "" : "none");
                            }
                        }
                    }
                    if (colors != null) p.setColorList(colors);
                    if (p.getSizeList().isEmpty()) {
                        String requested = global.colorRequeString;
                        prices.stream().filter(x -> x.getColorCode().equals(requested)).findFirst().ifPresent(p::setSeletedPrice);
                    }
                    persist(p, productList);
                }
            }
            for (Product p : productList) {
                if (Utilities.returnTenants(tenant, p.getProductImageDesUrl())) {
                    p.setProductImageDesUrl(Utilities.appendResolutionToFilename(p.getProductImageDesUrl(), "_rslt_300x300"));
                }
            }
            model.put("products", productList);

            int requestedPage = 0;
            if (request.getParameter("page") != null) {
                try {
                    requestedPage = Math.max(Integer.parseInt(request.getParameter("page")) - 1, 0);
                } catch (NumberFormatException ignored) {
                    requestedPage = 0;
                }
            }
            for (ProductGroup g : productGroups) {
                g.setPageSize(12);
                boolean isRequested = requestedGroup != null && g.getStringId().equals(requestedGroup);
                boolean load = requestedGroup == null || isRequested;
                int pageIndex = isRequested ? requestedPage : 0;
                List<Product> found = load ? products.getProductsByGroupByPage(g.getStringId(), pageIndex, 12) : new ArrayList<>();
                if (load) products.formatProductsForResultImages(found);
                g.setProducts(found, (int) products.countProductsByGroup(g.getStringId()));
                if (isRequested) g.setActivePage(pageIndex);
            }
            model.put("productGroups", productGroups);
        }

        addResultFilterAttributes(model, attributes, resultFilterVisible, sourceProducts, brands, selectedBrands, minPrice,
                maxPrice, rawKeyword, catalogCode, tenant, minRanges, maxRanges, defaultLang);
        model.put("domaintf", LegacySite.MINH_MAP_RESOURCE_FOLDER);
        site.addTenantTemplateVariables(model, domainString, tenant);
        model.put("projectMenuEntities", MenuPageRenderer.projectMenuEntities(content, session));
        model.put("client", content.getClientByDomainAndLanguageCode(tenant, defaultLang).orElseGet(Client::new));
        model.put("page", pageArticle);
        model.put("catalogs", catalogs);
        List<Article> pages = content.getAllDisplayedArticle("page").stream().filter(p -> !p.getLocked()).toList();
        for (Article page : pages) {
            page.setTenantString(tenant);
            page.setArticleLangCode(defaultLang);
            page.getURLbyAticleLangCode();
        }
        model.put("pages", pages);
        model.put("brands", brands);

        Object sessionLang = session.getAttribute("lang");
        String languageCode = sessionLang == null ? "vi" : sessionLang.toString();
        List<Language> languages = parseLanguages();
        for (Language language : languages) language.setSelected(language.getLangId().equals(languageCode));
        if (request.getParameter("loaded") != null) {
            defaultLang = request.getParameter("loaded");
            model.put("languages", languages);
        }
        String view = site.localizedViewName(domainString, tenant, pageArticle.getArticleTemplate(), defaultLang);
        return Optional.of(new MenuPageRenderer.Page(view, model));
    }

    // ---- request parsing ----

    private static String normalizeFilterCode(String value) {
        return value == null ? "" : Utilities.ValidateInputValue(value).trim().toLowerCase();
    }

    private static Set<String> selectedProductBrandFilters(HttpServletRequest request) {
        Set<String> selected = new HashSet<>();
        String[] values = request.getParameterValues("brandFilter");
        if (values == null) return selected;
        for (String value : values) {
            if (value == null) continue;
            for (String part : value.split(",")) {
                String n = normalizeFilterCode(part);
                if (!n.isBlank()) selected.add(n);
            }
        }
        return selected;
    }

    static List<String> parseDelimitedFilterCodes(String value) {
        List<String> codes = new ArrayList<>();
        if (value == null || value.isBlank()) return codes;
        for (String part : Utilities.ValidateInputValue(value).split(";")) {
            String n = part == null ? "" : part.trim().toLowerCase();
            if (!n.isBlank()) codes.add(n);
        }
        return codes;
    }

    static BigDecimal parsePrice(String value) {
        if (value == null || value.trim().isEmpty()) return null;
        String s = value.replace(",", "").replace(" ", "").trim();
        if (s.isEmpty()) return null;
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Map<String, BigDecimal> rangeFilters(HttpServletRequest request, String prefix) {
        Map<String, BigDecimal> selected = new HashMap<>();
        request.getParameterMap().forEach((name, values) -> {
            if (name == null || !name.startsWith(prefix) || values == null || values.length == 0) return;
            BigDecimal value = parsePrice(values[0]);
            String code = Attributes.normalizeCode(name.substring(prefix.length()));
            if (value != null && !code.isBlank()) selected.put(code, value);
        });
        return selected;
    }

    private static Set<String> selectedRangeCodes(Map<String, BigDecimal> min, Map<String, BigDecimal> max) {
        Set<String> codes = new HashSet<>();
        if (min != null) codes.addAll(min.keySet());
        if (max != null) codes.addAll(max.keySet());
        codes.removeIf(c -> c == null || c.isBlank());
        return codes;
    }

    // ---- product matching ----

    private static int safeCount(long count) {
        if (count <= 0) return 0;
        return count > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) count;
    }

    private static List<Product> findMatchingProductsForGroups(LegacyProductService ps, List<ProductGroup> groups,
                                                               String catalogCode, String searchTerm) {
        List<Product> all = new ArrayList<>();
        if (groups == null) return all;
        for (ProductGroup g : groups) all.addAll(findMatchingProductsForGroup(ps, g, catalogCode, searchTerm));
        return distinctById(all);
    }

    private static List<Product> findMatchingProductsForGroup(LegacyProductService ps, ProductGroup group,
                                                              String catalogCode, String searchTerm) {
        if (group == null) return new ArrayList<>();
        String code = group.getStringId();
        boolean hasSearch = searchTerm != null && !searchTerm.isBlank();
        boolean hasCatalog = catalogCode != null && !catalogCode.isBlank() && !"0".equals(catalogCode);
        int count;
        if (hasSearch && hasCatalog) {
            count = safeCount(ps.countByCatalogOrSubCatalog(code, catalogCode, searchTerm));
            return count <= 0 ? new ArrayList<>() : ps.findByCatalogOrSubCatalog(code, catalogCode, searchTerm, 0, count);
        }
        if (hasSearch) {
            count = safeCount(ps.countBySearchTerm(code, searchTerm));
            return count <= 0 ? new ArrayList<>() : ps.findBySearchTerm(code, searchTerm, 0, count);
        }
        if (hasCatalog) {
            List<String> codes = List.of(catalogCode);
            count = safeCount(ps.countProductsByCategoryCode(code, codes));
            return count <= 0 ? new ArrayList<>() : ps.findProductsByCategoryCode(code, codes, 0, count);
        }
        count = safeCount(ps.countProductsByGroup(code));
        return count <= 0 ? new ArrayList<>() : ps.getProductsByGroupByPage(code, 0, count);
    }

    private static List<ProductGroup> buildFilteredProductGroups(LegacyProductService ps, Attributes attrs, List<ProductGroup> groups,
                                                                 HttpServletRequest request, String catalogCode, String searchTerm,
                                                                 Set<String> brands, BigDecimal minPrice, BigDecimal maxPrice,
                                                                 Map<String, BigDecimal> minRanges, Map<String, BigDecimal> maxRanges) {
        List<ProductGroup> result = new LinkedList<>();
        if (groups == null) return result;
        String requestedGroup = normalizeFilterCode(request.getParameter("group"));
        int requestedPage = 0;
        if (request.getParameter("page") != null) {
            try {
                requestedPage = Math.max(Integer.parseInt(request.getParameter("page")) - 1, 0);
            } catch (NumberFormatException ignored) {
                requestedPage = 0;
            }
        }
        for (ProductGroup g : groups) {
            List<Product> matched = findMatchingProductsForGroup(ps, g, catalogCode, searchTerm);
            List<Product> filtered = filterProductsForResult(attrs, matched, brands, minPrice, maxPrice, minRanges, maxRanges);
            if (filtered.isEmpty()) continue;
            g.setPageSize(12);
            int pageIndex = normalizeFilterCode(g.getStringId()).equals(requestedGroup) ? requestedPage : 0;
            List<Product> page = pageProducts(filtered, pageIndex, g.getPageSize());
            if (page.isEmpty() && pageIndex > 0) {
                pageIndex = 0;
                page = pageProducts(filtered, 0, g.getPageSize());
            }
            ps.formatProductsForResultImages(page);
            g.setProducts(page, filtered.size());
            g.setActivePage(pageIndex);
            result.add(g);
        }
        return result;
    }

    private static List<Product> filterProductsForResult(Attributes attrs, List<Product> products, Set<String> brands,
                                                         BigDecimal minPrice, BigDecimal maxPrice,
                                                         Map<String, BigDecimal> minRanges, Map<String, BigDecimal> maxRanges) {
        List<Product> filtered = new ArrayList<>();
        if (products == null) return filtered;
        Set<String> rangeCodes = selectedRangeCodes(minRanges, maxRanges);
        Map<Long, Map<String, ProductAttributeValue>> values = rangeCodes.isEmpty() ? new HashMap<>()
                : attrs.valuesByProductIds(products.stream().map(Product::getId).collect(Collectors.toList()));
        for (Product p : products) {
            if (p == null) continue;
            String brand = normalizeFilterCode(p.getProductBrand());
            if (brands != null && !brands.isEmpty() && !brands.contains(brand)) continue;
            BigDecimal price = p.getProductPriceAmount() == null ? BigDecimal.ZERO : p.getProductPriceAmount();
            if (minPrice != null && price.compareTo(minPrice) < 0) continue;
            if (maxPrice != null && price.compareTo(maxPrice) > 0) continue;
            if (!matchesRanges(p, values.get(p.getId()), rangeCodes, minRanges, maxRanges)) continue;
            filtered.add(p);
        }
        return filtered;
    }

    private static List<Product> pageProducts(List<Product> products, int pageIndex, int pageSize) {
        if (products == null || products.isEmpty()) return new ArrayList<>();
        int size = pageSize <= 0 ? 12 : pageSize;
        int from = Math.max(pageIndex, 0) * size;
        if (from >= products.size()) from = 0;
        int to = Math.min(from + size, products.size());
        return new ArrayList<>(products.subList(from, to));
    }

    private static List<Product> distinctById(List<Product> products) {
        List<Product> result = new ArrayList<>();
        Set<Long> seen = new HashSet<>();
        if (products == null) return result;
        for (Product p : products) {
            if (p == null || seen.contains(p.getId())) continue;
            seen.add(p.getId());
            result.add(p);
        }
        return result;
    }

    private static boolean matchesRanges(Product product, Map<String, ProductAttributeValue> values, Set<String> codes,
                                         Map<String, BigDecimal> min, Map<String, BigDecimal> max) {
        if (codes == null || codes.isEmpty()) return true;
        if (product == null || values == null || values.isEmpty()) return false;
        for (String code : codes) {
            ProductAttributeValue v = values.get(code);
            BigDecimal number = v == null ? null : v.getNumberValue();
            if (number == null) return false;
            BigDecimal lo = min == null ? null : min.get(code);
            BigDecimal hi = max == null ? null : max.get(code);
            if (lo != null && number.compareTo(lo) < 0) return false;
            if (hi != null && number.compareTo(hi) > 0) return false;
        }
        return true;
    }

    // ---- result filter model ----

    private void addResultFilterAttributes(Map<String, Object> model, Attributes attrs, boolean visible, List<Product> source,
                                           List<ProductBrand> brands, Set<String> selectedBrands, BigDecimal minPrice,
                                           BigDecimal maxPrice, String rawKeyword, String catalogCode, String tenant,
                                           Map<String, BigDecimal> minRanges, Map<String, BigDecimal> maxRanges, String lang) {
        List<Product> unique = distinctById(source);
        List<Product> filtered = filterProductsForResult(attrs, unique, selectedBrands, minPrice, maxPrice, minRanges, maxRanges);
        model.put("resultFilterVisible", visible && !unique.isEmpty());
        model.put("resultFilterBrandOptions", brandOptions(unique, brands, selectedBrands));
        model.put("resultFilterRangeOptions", rangeOptions(attrs, unique, tenant, minRanges, maxRanges, lang));
        model.put("resultFilterResultCount", unique.size());
        model.put("resultFilterFilteredCount", filtered.size());
        model.put("selectedBrandFilters", selectedBrands == null ? new HashSet<String>() : selectedBrands);
        model.put("selectedCatalog", catalogCode == null || catalogCode.isBlank() ? "0" : catalogCode);
        model.put("keyword", rawKeyword == null ? "" : rawKeyword);
        model.put("minPrice", minPrice == null ? "" : minPrice.toPlainString());
        model.put("maxPrice", maxPrice == null ? "" : maxPrice.toPlainString());
        BigDecimal lo = extremePrice(unique, true);
        BigDecimal hi = extremePrice(unique, false);
        model.put("resultFilterMinPriceAvailable", lo == null ? "" : lo.toPlainString());
        model.put("resultFilterMaxPriceAvailable", hi == null ? "" : hi.toPlainString());
    }

    private static List<Map<String, Object>> brandOptions(List<Product> products, List<ProductBrand> brands, Set<String> selected) {
        Map<String, String> names = new HashMap<>();
        if (brands != null) {
            for (ProductBrand b : brands) {
                String code = normalizeFilterCode(b.getBrandCode());
                if (!code.isBlank()) names.put(code, b.getBrandName());
            }
        }
        Map<String, Integer> counts = new HashMap<>();
        if (products != null) {
            for (Product p : products) {
                String code = normalizeFilterCode(p.getProductBrand());
                if (code.isBlank() || "none".equals(code)) continue;
                counts.put(code, counts.getOrDefault(code, 0) + 1);
            }
        }
        List<String> codes = new ArrayList<>(counts.keySet());
        codes.sort((a, b) -> names.getOrDefault(a, a).compareToIgnoreCase(names.getOrDefault(b, b)));
        List<Map<String, Object>> options = new ArrayList<>();
        for (String code : codes) {
            Map<String, Object> o = new HashMap<>();
            o.put("code", code);
            o.put("name", names.getOrDefault(code, code));
            o.put("count", counts.get(code));
            o.put("selected", selected != null && selected.contains(code));
            options.add(o);
        }
        return options;
    }

    private static BigDecimal extremePrice(List<Product> products, boolean min) {
        BigDecimal best = null;
        if (products == null) return null;
        for (Product p : products) {
            if (p == null || p.getProductPriceAmount() == null) continue;
            BigDecimal price = p.getProductPriceAmount();
            if (best == null || (min ? price.compareTo(best) < 0 : price.compareTo(best) > 0)) best = price;
        }
        return best;
    }

    private List<Map<String, Object>> rangeOptions(Attributes attrs, List<Product> products, String tenant,
                                                   Map<String, BigDecimal> minRanges, Map<String, BigDecimal> maxRanges, String lang) {
        List<Map<String, Object>> options = new ArrayList<>();
        List<Product> unique = distinctById(products);
        if (unique.isEmpty() || tenant == null || tenant.isBlank()) return options;
        Map<Long, Map<String, ProductAttributeValue>> values =
                attrs.valuesByProductIds(unique.stream().map(Product::getId).collect(Collectors.toList()));
        Map<String, CategoryAttribute> configs = rangeConfigs(attrs, unique, values, minRanges, maxRanges);
        for (CategoryAttribute config : configs.values()) {
            String code = Attributes.normalizeCode(config.getAttributeCode());
            List<BigDecimal> numbers = unique.stream()
                    .map(p -> values.get(p.getId())).filter(m -> m != null)
                    .map(m -> m.get(code)).filter(v -> v != null && v.getNumberValue() != null)
                    .map(ProductAttributeValue::getNumberValue).collect(Collectors.toList());
            if (numbers.isEmpty() && !selectedRangeCodes(minRanges, maxRanges).contains(code)) continue;
            BigDecimal lo = numbers.stream().min(BigDecimal::compareTo).orElse(null);
            BigDecimal hi = numbers.stream().max(BigDecimal::compareTo).orElse(null);
            Map<String, Object> o = new HashMap<>();
            o.put("code", code);
            o.put("name", localizeLabel(config.getAttributeName(), code, lang));
            o.put("unit", localizeUnit(config.getUnit(), code, lang));
            o.put("minParamName", "attributeMin_" + code);
            o.put("maxParamName", "attributeMax_" + code);
            o.put("selectedMin", minRanges == null || minRanges.get(code) == null ? "" : minRanges.get(code).toPlainString());
            o.put("selectedMax", maxRanges == null || maxRanges.get(code) == null ? "" : maxRanges.get(code).toPlainString());
            o.put("minAvailable", lo == null ? "" : lo.stripTrailingZeros().toPlainString());
            o.put("maxAvailable", hi == null ? "" : hi.stripTrailingZeros().toPlainString());
            o.put("displayOrder", config.getDisplayOrder());
            options.add(o);
        }
        options.sort((a, b) -> {
            int c = ((Integer) a.getOrDefault("displayOrder", 0)).compareTo((Integer) b.getOrDefault("displayOrder", 0));
            return c != 0 ? c : String.valueOf(a.get("name")).compareToIgnoreCase(String.valueOf(b.get("name")));
        });
        return options;
    }

    private static Map<String, CategoryAttribute> rangeConfigs(Attributes attrs, List<Product> products,
                                                               Map<Long, Map<String, ProductAttributeValue>> values,
                                                               Map<String, BigDecimal> minRanges, Map<String, BigDecimal> maxRanges) {
        Map<String, CategoryAttribute> configs = new HashMap<>();
        Set<String> seen = new HashSet<>();
        for (Product p : products) {
            for (String category : categoryCodes(p)) {
                if (!seen.add(category)) continue;
                for (CategoryAttribute config : attrs.filterableCategoryAttributes(category)) {
                    String code = Attributes.normalizeCode(config.getAttributeCode());
                    if (ProductAttribute.DATA_TYPE_NUMBER.equals(config.getDataType())
                            && ProductAttribute.FILTER_TYPE_RANGE.equals(config.getFilterType())) {
                        configs.putIfAbsent(code, config);
                    }
                }
            }
        }
        Set<String> selected = selectedRangeCodes(minRanges, maxRanges);
        boolean hasPower = values.values().stream().filter(m -> m != null).map(m -> m.get("POWER"))
                .anyMatch(v -> v != null && v.getNumberValue() != null);
        if (!configs.containsKey("POWER") && (selected.contains("POWER") || hasPower)) {
            ProductAttribute attribute = new ProductAttribute();
            attribute.setAttributeCode("POWER");
            attribute.setAttributeName("Công Suất");
            attribute.setDataType(ProductAttribute.DATA_TYPE_NUMBER);
            attribute.setFilterType(ProductAttribute.FILTER_TYPE_RANGE);
            attribute.setUnit("Ngựa (HP/PS)");
            attribute.setActive(true);
            CategoryAttribute config = new CategoryAttribute();
            config.setAttributeCode("POWER");
            config.setFilterable(true);
            config.setActive(true);
            config.setDisplayOrder(0);
            config.setAttribute(attribute);
            configs.put("POWER", config);
        }
        return configs;
    }

    private static Set<String> categoryCodes(Product product) {
        Set<String> codes = new HashSet<>();
        if (product == null) return codes;
        String catalog = Attributes.normalizeCode(product.getProductCatalog());
        if (!catalog.isBlank() && !"NONE".equals(catalog)) codes.add(catalog);
        String sub = product.getProductSubCatalog();
        if (sub != null) {
            for (String token : sub.split("[#;,\\s]+")) {
                String code = Attributes.normalizeCode(token);
                if (!code.isBlank() && !"NONE".equals(code)) codes.add(code);
            }
        }
        return codes;
    }

    private String localizeLabel(String label, String code, String languageCode) {
        if (!"POWER".equals(code == null ? "" : code.trim().toUpperCase(Locale.ROOT))) return label;
        String l = site.languages().normalizeFrontendLanguageCode(languageCode);
        switch (l == null ? "en" : l) {
            case "vi": return "Công Suất";
            case "cn": return "功率";
            case "tw": return "功率";
            case "fil": return "Power";
            case "ja": return "出力";
            case "ko": return "출력";
            case "es": return "Potencia";
            case "dv": return "ޕަވަރ";
            case "ms": return "Kuasa";
            case "id": return "Daya";
            case "ar": return "القدرة";
            case "fr": return "Puissance";
            default: return "Power";
        }
    }

    private String localizeUnit(String unit, String code, String languageCode) {
        if (!"POWER".equals(code == null ? "" : code.trim().toUpperCase(Locale.ROOT))) return unit;
        String l = site.languages().normalizeFrontendLanguageCode(languageCode);
        switch (l == null ? "en" : l) {
            case "vi": return "Ngựa (HP/PS)";
            case "cn": return "马力 (HP/PS)";
            case "tw": return "馬力 (HP/PS)";
            case "fil": return "Horsepower (HP/PS)";
            case "ja": return "馬力 (HP/PS)";
            case "ko": return "마력 (HP/PS)";
            case "es": return "Caballos de fuerza (HP/PS)";
            case "dv": return "ހޯސްޕަވަރ (HP/PS)";
            case "ms": return "Kuasa kuda (HP/PS)";
            case "id": return "Tenaga kuda (HP/PS)";
            case "ar": return "حصان (HP/PS)";
            case "fr": return "Chevaux (HP/PS)";
            default: return "Horsepower (HP/PS)";
        }
    }

    /** GreetingController.persist into the in-memory list. */
    private static void persist(Product item, List<Product> database) {
        if (item.getId() == 0) {
            item.setId(database.stream().map(Product::getId).max(Comparator.naturalOrder()).orElse(0L) + 1);
        }
        Optional<Product> existing = database.stream().filter(e -> e.getId() == item.getId()).findFirst();
        if (existing.isPresent()) {
            int position = database.indexOf(existing.get());
            database.remove(position);
            database.add(position, item);
        } else {
            database.add(item);
        }
    }

    /** Utilities.parseLanguages(): languages.xml next to config.xml. */
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

    /** ProductAttributeService (normalizeCode, getValuesByProductIds, getFilterableCategoryAttributes). */
    static final class Attributes {
        private final LegacyProductRepository repo;
        private Map<String, ProductAttribute> definitions;

        Attributes(LegacyProductRepository repo) { this.repo = repo; }

        static String normalizeCode(String value) {
            String code = value == null ? "" : value.trim();
            return code.toUpperCase().replaceAll("[^A-Z0-9_]+", "_").replaceAll("_+", "_").replaceAll("^_|_$", "");
        }

        Map<Long, Map<String, ProductAttributeValue>> valuesByProductIds(Collection<Long> ids) {
            if (ids == null || ids.isEmpty()) return new HashMap<>();
            return repo.findVisibleAttributeValuesByProductIdIn(new ArrayList<>(ids)).stream()
                    .collect(Collectors.groupingBy(ProductAttributeValue::getProductId,
                            Collectors.toMap(ProductAttributeValue::getAttributeCode, v -> v, (a, b) -> a, LinkedHashMap::new)));
        }

        List<CategoryAttribute> filterableCategoryAttributes(String categoryCode) {
            List<CategoryAttribute> configs = repo.findFilterableByCategoryCode(normalizeCode(categoryCode));
            if (definitions == null) {
                definitions = repo.findAllAttributesOrdered().stream()
                        .collect(Collectors.toMap(ProductAttribute::getAttributeCode, a -> a, (a, b) -> a));
            }
            configs.forEach(c -> c.setAttribute(definitions.get(c.getAttributeCode())));
            configs.sort(Comparator.comparing(CategoryAttribute::getDisplayOrder).thenComparing(CategoryAttribute::getAttributeCode));
            return configs;
        }
    }
}
