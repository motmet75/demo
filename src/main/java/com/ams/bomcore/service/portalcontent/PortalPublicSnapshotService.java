package com.ams.bomcore.service.portalcontent;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.BadSqlGrammarException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * A bounded, read-only public website snapshot from ONE approved tenant DB.
 * The original Portal's GreetingController.returnHomePage() defines the model
 * names. Only public fields are selected for the response; credentials and
 * admin/unpublished article/product data are never serialized.
 *
 * This is a migration slice, not the original search/cart/auth implementation.
 */
@Service
public class PortalPublicSnapshotService {
    private static final Logger log = LoggerFactory.getLogger(PortalPublicSnapshotService.class);
    private final PortalTenantDataSourceRegistry tenants;

    public PortalPublicSnapshotService(PortalTenantDataSourceRegistry tenants) {
        this.tenants = tenants;
    }

    public Map<String, Object> home(String tenantId, String language) {
        String tenant = PortalTenantDataSourceRegistry.normalizeTenantId(tenantId);
        String lang = "vi".equalsIgnoreCase(language) ? "vi" : "en";
        JdbcTemplate db = new JdbcTemplate(tenants.dataSource(tenant));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("tenantId", tenant);

        List<Map<String, Object>> clients = rows(db, "clienttb",
                "isvisible = true AND lower(clientcode) = lower(?)", 30, tenant);
        Map<String, Object> selectedClient = clients.stream()
                .filter(x -> lang.equalsIgnoreCase(str(x, "clientlangstringid")))
                .findFirst().orElse(clients.stream().findFirst().orElse(Map.of()));
        result.put("client", client(selectedClient));

        // Home page article controls the actual theme file, not only static
        // "index.html"; home may be stored as an Article link.
        List<Map<String, Object>> homeRows = rows(db, "articletb",
                "isvisible = true AND lower(articlelink) IN ('home','home.html','index.html','trang-chu.html')", 20);
        Map<String, Object> homeArticle = homeRows.stream()
                .filter(x -> "home".equalsIgnoreCase(str(x, "articlelink")))
                .findFirst().orElse(homeRows.stream().findFirst().orElse(Map.of()));
        String homeTemplate = str(homeArticle, "articletemplate");
        result.put("homeTemplate", homeTemplate.isBlank() ? "index.html" : homeTemplate);
        result.put("page", article(homeArticle, tenant));

        List<Map<String, Object>> allArticles = rows(db, "articletb",
                "isvisible = true AND isapproved = true AND islocked = false", 120);
        List<Map<String, Object>> articles = new ArrayList<>();
        List<Map<String, Object>> spotlights = new ArrayList<>();
        List<Map<String, Object>> pages = new ArrayList<>();
        for (Map<String, Object> raw : allArticles) {
            String type = str(raw, "articlecategory").toLowerCase(Locale.ROOT);
            Map<String, Object> item = article(raw, tenant);
            if (type.startsWith("article")) {
                if (articles.size() < 10) articles.add(item);
                if (str(raw, "articlesubcategory").toLowerCase(Locale.ROOT).contains("spotlight")
                        && spotlights.size() < 5) spotlights.add(item);
            } else if (type.startsWith("page") && pages.size() < 60) {
                pages.add(item);
            }
        }
        result.put("articles", articles);
        result.put("spotlightArticles", spotlights);
        result.put("pages", pages);

        List<Map<String, Object>> allCatalogs = rows(db, "productcatalogtb",
                "isvisible = true", 100);
        allCatalogs.sort(Comparator.comparingLong(x -> number(x, "catalogindex").longValue()));
        List<Map<String, Object>> catalogs = allCatalogs.stream().map(this::catalog).toList();
        result.put("catalogs", catalogs);
        result.put("topCatalogs", catalogs.stream().limit(3).toList());

        List<Map<String, Object>> allProducts = rows(db, "producttb",
                "isvisible = true AND isapproved = true", 180);
        Map<String, Map<String, Object>> catalogByCode = new HashMap<>();
        for (Map<String, Object> c : catalogs) {
            catalogByCode.put(str(c, "catalogCode").toLowerCase(Locale.ROOT), c);
        }
        List<Map<String, Object>> products = new ArrayList<>();
        List<Map<String, Object>> withVideos = new ArrayList<>();
        List<Map<String, Object>> recent = new ArrayList<>();
        for (Map<String, Object> raw : allProducts) {
            Map<String, Object> p = product(raw, catalogByCode);
            if (recent.size() < 20) recent.add(p);
            if (flag(raw, "isnew") && products.size() < 24) products.add(p);
            if (str(raw, "youtubevideourl").startsWith("http") && withVideos.size() < 6) withVideos.add(p);
        }
        if ("minhmapshop.com".equals(tenant) || products.isEmpty()) products = recent;
        result.put("products", products);
        result.put("productsWithVideos", withVideos);

        List<Map<String, Object>> selectedHomeCatalogs = new ArrayList<>();
        for (Map<String, Object> cat : catalogs) {
            String code = str(cat, "catalogCode");
            List<Map<String, Object>> matches = new ArrayList<>();
            for (Map<String, Object> p : allProducts.stream().map(r -> product(r, catalogByCode)).toList()) {
                if (code.equalsIgnoreCase(str(p, "productCatalog")) && matches.size() < 5) matches.add(p);
            }
            if (!matches.isEmpty()) {
                Map<String, Object> linked = new LinkedHashMap<>(cat);
                linked.put("products", matches);
                selectedHomeCatalogs.add(linked);
            }
        }
        result.put("selectedHomeCatalogs", selectedHomeCatalogs);
        result.put("productofActiveCatalog", selectedHomeCatalogs.isEmpty()
                ? List.of() : selectedHomeCatalogs.get(0).get("products"));

        result.put("brands", rows(db, "productbrandtb", "isvisible = true", 80)
                .stream().map(this::brand).toList());
        result.put("productGroups", rows(db, "productgrouptb", "isvisible = true", 100)
                .stream().map(this::group).toList());
        result.put("partners", rows(db, "partnertb", "isvisible = true", 60)
                .stream().map(this::partner).toList());

        List<Map<String, Object>> menus = rows(db, "menutb", "isvisible = true", 150)
                .stream().map(this::menu).toList();
        result.put("projectMenuEntities", menuTree(menus, lang));

        String second = "";
        for (Map<String, Object> c : catalogs) {
            if (str(c, "catalogImageDesUrl").length() > 6) {
                second = str(c, "catalogImageDesUrl");
                break;
            }
        }
        if (second.isBlank()) second = str(selectedClient, "clientbanner");
        result.put("secondImage", second);

        // Match the original TemplateImageService fallback order: requested
        // language, then Vietnamese, and template link "home" or filename.
        List<Map<String, Object>> rawSlots = rows(db, "templateimagetb", "isvisible = true", 200);
        String tmpl = result.get("homeTemplate").toString();
        List<Map<String, Object>> slots = selectTemplateImages(rawSlots, "home", tmpl, lang);
        result.put("templateImages", slots);
        Map<String, Object> byId = new LinkedHashMap<>();
        for (Map<String, Object> slot : slots) byId.put(str(slot, "stringId"), slot);
        result.put("templateImageMap", byId);
        return result;
    }

    private static List<Map<String, Object>> rows(JdbcTemplate db, String table, String condition,
                                                   int limit, Object... args) {
        // Table names and conditions are ONLY server-defined constants.
        String sql = "SELECT * FROM " + table + " WHERE " + condition
                + " ORDER BY id DESC LIMIT " + Math.min(limit, 250);
        try {
            return db.queryForList(sql, args);
        } catch (BadSqlGrammarException missingOptionalLegacyTable) {
            log.warn("Optional Portal content table unavailable: {}", table);
            return List.of();
        }
    }

    private Map<String, Object> client(Map<String, Object> row) {
        return values("clientName", str(row,"clientname"), "clientBanner", str(row,"clientbanner"),
                "clientBannerText", str(row,"clientbannertext"), "clientLogo", str(row,"clientlogo"),
                "clientDescription", str(row,"clientdescription"),
                "clientPhone", str(row,"clientphone"), "clientMail", str(row,"clientmail"),
                "clientAddress", str(row,"clientaddress"), "clientMapEmbeded", str(row,"clientmapembeded"));
    }

    private Map<String, Object> article(Map<String, Object> row, String tenant) {
        String image = str(row, "articlethumnailurl");
        String thumb = image.isBlank() || "none".equalsIgnoreCase(image)
                ? "" : image.startsWith("http") || image.startsWith("/") ? image : "/image/" + image;
        return values("articleTitle", str(row,"articletitle"), "articleLink", str(row,"articlelink"),
                "articleTemplate", str(row,"articletemplate"),
                "articleKeyWord", str(row,"articlekeyword"),
                "articleCategory", str(row,"articlecategory"),
                "articleSubCategory", str(row,"articlesubcategory"),
                "articleDescription", str(row,"articledescription"),
                "articleContent", str(row,"articlecontent"),
                "articleThumnailURL", image, "articleThumnailURLWithHost2", thumb,
                "articleLangCode", str(row,"articlelangcode"),
                "articleTime", date(row,"articletime"),
                "URLbyAticleLangCode", str(row, "articlelink"));
    }

    private Map<String, Object> product(Map<String, Object> r, Map<String, Map<String, Object>> catalogByCode) {
        String catalogCode = str(r, "productcatalog");
        String image = str(r, "productimagedesurl");
        if (image.isBlank() || "none".equalsIgnoreCase(image)) image = str(r, "productimageurl1");
        Map<String, Object> category = catalogByCode.getOrDefault(
                catalogCode.toLowerCase(Locale.ROOT), values("catalogCode", catalogCode));
        return values("productName", str(r,"productname"), "productCode", str(r,"productcode"),
                "productCatalog", catalogCode, "productCategory", category,
                "productSubCatalog", str(r,"productsubcatalog"),
                "productBrand", str(r,"productbrand"),
                "productGroupString", str(r,"productgroupstring"),
                "productShortDes", str(r,"productshortdes"), "productLongDes", str(r,"productlongdes"),
                "productImageDesUrl", image, "productImageUrl1", str(r,"productimageurl1"),
                "youtubeVideoURL", str(r,"youtubevideourl"),
                "productVideoAdd", str(r,"productvideoadd"),
                "productPriceAmount", number(r,"productpriceamount"),
                "productPriceCurrency", str(r,"productpricecurrency"),
                "publicPrice", flag(r,"publicprice"),
                "newProduct", flag(r,"isnew"), "path", str(r,"path"));
    }

    private Map<String, Object> catalog(Map<String, Object> r) {
        return values("catalogCode", str(r,"catalogcode"), "catalogName", str(r,"catalogname"),
                "catalogShortDes", str(r,"catalogshortdes"), "catalogLongDes", str(r,"cataloglongdes"),
                "catalogImageUrl1", str(r,"catalogimageurl1"),
                "catalogImageDesUrl", str(r,"catalogimagedesurl"),
                "catalogVideoAdd", str(r,"catalogvideoadd"), "path", str(r,"path"),
                "htmlClassString", "", "products", List.of());
    }

    private Map<String, Object> brand(Map<String, Object> r) {
        return values("brandCode", str(r,"brandcode"), "brandName", str(r,"brandname"),
                "brandImageDesUrl", str(r,"brandimagedesurl"), "path", str(r,"path"));
    }

    private Map<String, Object> group(Map<String, Object> r) {
        return values("stringId", str(r,"stringid"), "productGroupCode", str(r,"productgroupcode"),
                "productGroupName", str(r,"productgroupname"), "currentPageProductList", List.of(),
                "products", List.of(), "pageCount", List.of(), "totalPage", 0);
    }

    private Map<String, Object> partner(Map<String, Object> r) {
        return values("partnerName", str(r,"partnername"), "partnerLogo", str(r,"partnerlogo"));
    }

    private Map<String, Object> menu(Map<String, Object> r) {
        return values("menuStringId", str(r,"menustringid"),
                "menuRootStringId", str(r,"menurootstringid"),
                "menuName", str(r,"menuname"), "path", str(r,"path"),
                "language", str(r,"language"), "index", str(r,"index"),
                "external", str(r,"external"), "subItems", List.of());
    }

    private List<Map<String, Object>> menuTree(List<Map<String, Object>> all, String lang) {
        List<Map<String, Object>> matching = all.stream()
                .filter(m -> lang.equalsIgnoreCase(str(m,"language"))).toList();
        if (matching.isEmpty()) matching = all.stream()
                .filter(m -> "en".equalsIgnoreCase(str(m,"language"))).toList();
        Map<String, List<Map<String, Object>>> children = new HashMap<>();
        for (Map<String, Object> m : matching) {
            children.computeIfAbsent(str(m,"menuRootStringId"), unused -> new ArrayList<>()).add(m);
        }
        return treeAt("root", children, new HashSet<>(), 0);
    }

    private List<Map<String, Object>> treeAt(String root, Map<String,List<Map<String,Object>>> children,
                                             Set<String> visited, int depth) {
        if (depth > 6) return List.of();
        List<Map<String,Object>> items = new ArrayList<>();
        for (Map<String,Object> m : children.getOrDefault(root, List.of())) {
            String id = str(m, "menuStringId");
            if (id.isBlank() || !visited.add(id)) continue;
            Map<String,Object> node = new LinkedHashMap<>(m);
            node.put("subItems", treeAt(id,children,visited,depth+1));
            items.add(node);
        }
        items.sort(Comparator.comparing(x -> str(x, "index")));
        return items;
    }

    private List<Map<String, Object>> selectTemplateImages(List<Map<String,Object>> rows, String link,
                                                              String template, String lang) {
        for (String candidate : List.of(link, template)) {
            for (String locale : List.of(lang, "vi")) {
                List<Map<String,Object>> selected = rows.stream().filter(m ->
                        candidate.equalsIgnoreCase(str(m, "templatelink"))
                                && locale.equalsIgnoreCase(str(m, "langcode"))).toList();
                if (!selected.isEmpty()) {
                    List<Map<String, Object>> images = selected.stream().map(this::slot).collect(java.util.stream.Collectors.toCollection(ArrayList::new));
                    images.sort(Comparator.comparingInt(x -> number(x, "imageSequence").intValue()));
                    return images;
                }
            }
        }
        return List.of();
    }

    private Map<String, Object> slot(Map<String,Object> r) {
        return values("stringId", str(r,"stringid"), "mediaType", str(r,"mediatype"),
                "imageUrl", str(r,"imageurl"), "mediaUrl", str(r,"mediaurl"),
                "embedUrl", str(r,"embedurl"), "remark", str(r,"remark"),
                "imageSequence", number(r,"imagesequence"),
                "imageWidth", str(r,"imagewidth"), "imageHeight", str(r,"imageheight"));
    }

    private static Map<String,Object> values(Object... keyValues) {
        Map<String,Object> result = new LinkedHashMap<>();
        for (int i=0; i<keyValues.length; i+=2) result.put((String)keyValues[i], keyValues[i+1]);
        return result;
    }

    private static Object value(Map<String,Object> row, String key) {
        if (row.containsKey(key)) return row.get(key);
        for (var entry : row.entrySet()) if (entry.getKey().equalsIgnoreCase(key)) return entry.getValue();
        return null;
    }
    private static String str(Map<String,Object> row, String key) {
        Object item = value(row,key);
        return item == null ? "" : item.toString().trim();
    }
    private static boolean flag(Map<String,Object> row, String key) {
        Object item = value(row,key);
        return item instanceof Boolean b ? b : "true".equalsIgnoreCase(String.valueOf(item));
    }
    private static Number number(Map<String,Object> row, String key) {
        Object item = value(row,key);
        if (item instanceof Number n) return n;
        try { return new BigDecimal(String.valueOf(item)); } catch (Exception ignored) { return BigDecimal.ZERO; }
    }
    private static String date(Map<String,Object> row, String key) {
        Object item = value(row,key);
        if (item instanceof Timestamp stamp) return stamp.toLocalDateTime().toString();
        if (item instanceof LocalDateTime t) return t.toString();
        return item == null ? "" : item.toString().replace(' ', 'T');
    }
}
