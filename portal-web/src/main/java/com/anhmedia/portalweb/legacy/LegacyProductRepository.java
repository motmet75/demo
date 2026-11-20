package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Partner;
import com.anhmedia.portalweb.legacy.entity.Product;
import com.anhmedia.portalweb.legacy.entity.ProductBrand;
import com.anhmedia.portalweb.legacy.entity.ProductCatalog;
import com.anhmedia.portalweb.legacy.entity.ProductColor;
import com.anhmedia.portalweb.legacy.entity.ProductGroup;
import com.anhmedia.portalweb.legacy.entity.ProductHtml;
import com.anhmedia.portalweb.legacy.entity.ProductPrice;
import com.anhmedia.portalweb.legacy.entity.ProductSize;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * SQL translations of the legacy ProductRepository and the catalog, brand,
 * group, partner, size, color and price repositories. JPQL field names are
 * replaced by their @Column names (visible -> isvisible, newProduct -> isnew).
 * Spring Data's "LIKE %:p%" binds '%' + value + '%' without escaping.
 */
public class LegacyProductRepository {
    private static final String P = "SELECT p.* FROM producttb p ";
    private static final String SHOWN = "p.isvisible = true AND p.isapproved = true";
    private static final String CATALOG_MATCH = "(LOWER(p.productcatalog) = ? OR LOWER(p.productsubcatalog) = ?"
            + " OR LOWER(p.productsubcatalog) LIKE CONCAT('%#', ?, '#%') OR LOWER(p.productsubcatalog) LIKE CONCAT('%#', ?))";
    private static final String TERM_MATCH = "(LOWER(unaccent(p.productname)) LIKE ? OR LOWER(unaccent(p.productshortdes)) LIKE ?"
            + " OR LOWER(unaccent(p.productlongdes)) LIKE ? OR LOWER(unaccent(p.productsubcatalog)) LIKE ?"
            + " OR LOWER(unaccent(p.productbrand)) LIKE ? OR LOWER(unaccent(p.productcatalog)) LIKE ?)";
    private static final String BY_PUBLISHED = " ORDER BY p.publishedtime DESC";

    private final JdbcTemplate db;

    public LegacyProductRepository(JdbcTemplate db) {
        this.db = db;
    }

    private List<Product> products(String sql, Object... args) {
        return new ArrayList<>(db.query(sql, LegacyRowMapper.of(Product.class), args));
    }

    private long count(String sql, Object... args) {
        Long n = db.queryForObject(sql, Long.class, args);
        return n == null ? 0 : n;
    }

    private static String page(int page, int size) {
        if (page < 0 || size < 1) throw new IllegalArgumentException("Page index must not be less than zero");
        return " LIMIT " + size + " OFFSET " + ((long) page * size);
    }

    private static Object[] catalog(String code) { return new Object[] {code, code, code, code}; }

    private static Object[] term(String searchTerm) {
        String like = "%" + searchTerm + "%";
        return new Object[] {like, like, like, like, like, like};
    }

    private static Object[] concat(Object[]... parts) {
        List<Object> all = new ArrayList<>();
        for (Object[] p : parts) Collections.addAll(all, p);
        return all.toArray();
    }

    private static String inList(int n) {
        return String.join(",", Collections.nCopies(n, "?"));
    }

    // ---- ProductRepository ----

    public List<Product> getNewProducts() {
        return products(P + "WHERE p.isvisible = true AND p.isnew = true AND p.isvisible = true AND p.isapproved = true"
                + BY_PUBLISHED);
    }

    public List<Product> getAllDisPlayedProduct() {
        return products(P + "WHERE " + SHOWN + BY_PUBLISHED);
    }

    public List<Product> findByPath(String path) {
        return products(P + "WHERE p.isvisible = true AND p.path = ? AND p.isapproved = true ORDER BY p.modifiedtime DESC", path);
    }

    public List<Product> findByCode(String code) {
        return products(P + "WHERE p.isvisible = true AND p.productcode = ? AND p.isapproved = true ORDER BY p.modifiedtime DESC", code);
    }

    public List<Product> getProductsByPage(String catalogCode, int page, int size) {
        return products(P + "WHERE " + SHOWN + " AND p.productcatalog LIKE ?" + BY_PUBLISHED + page(page, size),
                "%" + catalogCode + "%");
    }

    public List<Product> getTopRelatedProducts(String catalogString, int page, int size) {
        return products(P + "WHERE " + SHOWN + " AND p.productsubcatalog LIKE ?" + BY_PUBLISHED + page(page, size),
                "%" + catalogString + "%");
    }

    public List<Product> getProductsWithVideosByPage(int page, int size) {
        return products(P + "WHERE " + SHOWN + " AND p.youtubevideourl LIKE 'http%'" + BY_PUBLISHED + page(page, size));
    }

    public List<Product> getProductsByGroupByPage(String groupCode, int page, int size) {
        return products(P + "WHERE " + SHOWN + " AND p.productgroupstring LIKE CONCAT('%', ?, '%')" + BY_PUBLISHED
                + page(page, size), groupCode);
    }

    public long countProductsByGroup(String groupCode) {
        return count("SELECT COUNT(*) FROM producttb p WHERE " + SHOWN + " AND p.productgroupstring LIKE CONCAT('%', ?, '%')",
                groupCode);
    }

    public List<Product> findProductsByCategoryCode(String groupCode, List<String> codes, int page, int size) {
        return products(P + "WHERE LOWER(p.productcatalog) IN (" + inList(codes.size()) + ") AND " + SHOWN
                        + " AND p.productgroupstring LIKE CONCAT('%', ?, '%')" + BY_PUBLISHED + page(page, size),
                concat(codes.toArray(), new Object[] {groupCode}));
    }

    public long countProductsByCategoryCode(String groupCode, List<String> codes) {
        return count("SELECT COUNT(*) FROM producttb p WHERE LOWER(p.productcatalog) IN (" + inList(codes.size()) + ") AND "
                + SHOWN + " AND p.productgroupstring LIKE CONCAT('%', ?, '%')", concat(codes.toArray(), new Object[] {groupCode}));
    }

    public List<String> findDistinctProductGroupStringsByCategoryCode(List<String> codes) {
        return db.queryForList("SELECT DISTINCT p.productgroupstring FROM producttb p WHERE LOWER(p.productcatalog) IN ("
                + inList(codes.size()) + ") AND " + SHOWN, String.class, codes.toArray());
    }

    public List<Product> findProductsByCategoryBrand(List<String> brands) {
        return products(P + "WHERE LOWER(p.productbrand) IN (" + inList(brands.size()) + ") AND " + SHOWN + BY_PUBLISHED,
                brands.toArray());
    }

    public List<Product> findProductsByCategoryCodeAadBrand(List<String> brands, List<String> codes) {
        return products(P + "WHERE LOWER(p.productbrand) IN (" + inList(brands.size()) + ") AND LOWER(p.productcatalog) IN ("
                + inList(codes.size()) + ") AND " + SHOWN + BY_PUBLISHED, concat(brands.toArray(), codes.toArray()));
    }

    /** findByCatalogOrSubCatalog(catalogCode, searchTerm, pageable). */
    public List<Product> findByCatalogOrSubCatalog(String catalogCode, String searchTerm, int page, int size) {
        return products(P + "WHERE " + SHOWN + " AND " + CATALOG_MATCH + " AND " + TERM_MATCH + BY_PUBLISHED + page(page, size),
                concat(catalog(catalogCode), term(searchTerm)));
    }

    /** findByCatalogOrSubCatalog(groupCode, catalogCode, searchTerm, pageable). */
    public List<Product> findByCatalogOrSubCatalog(String groupCode, String catalogCode, String searchTerm, int page, int size) {
        return products(P + "WHERE " + SHOWN + " AND p.productgroupstring LIKE CONCAT('%', ?, '%') AND " + CATALOG_MATCH
                        + " AND " + TERM_MATCH + BY_PUBLISHED + page(page, size),
                concat(new Object[] {groupCode}, catalog(catalogCode), term(searchTerm)));
    }

    public List<String> findGroupStringsByCatalogOrSubCatalog(String catalogCode, String searchTerm) {
        return db.queryForList("SELECT DISTINCT p.productgroupstring FROM producttb p WHERE " + SHOWN + " AND " + CATALOG_MATCH
                + " AND " + TERM_MATCH, String.class, concat(catalog(catalogCode), term(searchTerm)));
    }

    public long countByCatalogOrSubCatalog(String catalogCode, String searchTerm) {
        return count("SELECT COUNT(*) FROM producttb p WHERE " + SHOWN + " AND " + CATALOG_MATCH + " AND " + TERM_MATCH,
                concat(catalog(catalogCode), term(searchTerm)));
    }

    public long countByCatalogOrSubCatalog(String groupCode, String catalogCode, String searchTerm) {
        return count("SELECT COUNT(*) FROM producttb p WHERE " + SHOWN + " AND p.productgroupstring LIKE CONCAT('%', ?, '%') AND "
                + CATALOG_MATCH + " AND " + TERM_MATCH, concat(new Object[] {groupCode}, catalog(catalogCode), term(searchTerm)));
    }

    public List<Product> findBySearchTerm(String searchTerm, int page, int size) {
        return products(P + "WHERE " + SHOWN + " AND " + TERM_MATCH + BY_PUBLISHED + page(page, size), term(searchTerm));
    }

    public List<Product> findBySearchTerm(String groupCode, String searchTerm, int page, int size) {
        return products(P + "WHERE " + SHOWN + " AND p.productgroupstring LIKE CONCAT('%', ?, '%') AND " + TERM_MATCH
                + BY_PUBLISHED + page(page, size), concat(new Object[] {groupCode}, term(searchTerm)));
    }

    public List<String> findGroupStringsBySearchTerm(String searchTerm) {
        return db.queryForList("SELECT DISTINCT p.productgroupstring FROM producttb p WHERE " + SHOWN + " AND " + TERM_MATCH,
                String.class, term(searchTerm));
    }

    public long countBySearchTerm(String searchTerm) {
        return count("SELECT COUNT(*) FROM producttb p WHERE " + SHOWN + " AND " + TERM_MATCH, term(searchTerm));
    }

    public long countBySearchTerm(String groupCode, String searchTerm) {
        return count("SELECT COUNT(*) FROM producttb p WHERE " + SHOWN + " AND p.productgroupstring LIKE CONCAT('%', ?, '%') AND "
                + TERM_MATCH, concat(new Object[] {groupCode}, term(searchTerm)));
    }

    // ---- catalog / brand / group / partner / attribute repositories ----

    public List<ProductCatalog> getAllProductCatalog() {
        return new ArrayList<>(db.query("SELECT * FROM productcatalogtb m WHERE m.isvisible = true ORDER BY m.catalogindex ASC",
                LegacyRowMapper.of(ProductCatalog.class)));
    }

    public List<ProductCatalog> getTopProductCatalogs(int size) {
        return new ArrayList<>(db.query("SELECT * FROM productcatalogtb m WHERE m.isvisible = true ORDER BY m.catalogindex ASC"
                + page(0, size), LegacyRowMapper.of(ProductCatalog.class)));
    }

    public List<ProductBrand> getAllProductBrand() {
        return new ArrayList<>(db.query("SELECT * FROM productbrandtb m WHERE m.isvisible = true ORDER BY m.createdtime DESC",
                LegacyRowMapper.of(ProductBrand.class)));
    }

    public List<ProductBrand> getAllProductDisPlayedBrand() {
        return new ArrayList<>(db.query("SELECT * FROM productbrandtb m WHERE m.isvisible = true AND m.isapproved = true"
                + " ORDER BY m.createdtime DESC", LegacyRowMapper.of(ProductBrand.class)));
    }

    public List<ProductGroup> getAllProductGroup() {
        return new ArrayList<>(db.query("SELECT * FROM productgrouptb m WHERE m.isvisible = true ORDER BY m.productgroupcode ASC",
                LegacyRowMapper.of(ProductGroup.class)));
    }

    public List<Partner> getAllPartner() {
        return new ArrayList<>(db.query("SELECT * FROM partnertb m WHERE m.isvisible = true ORDER BY m.createdtime DESC",
                LegacyRowMapper.of(Partner.class)));
    }

    public List<ProductSize> getAllProductSize() {
        return new ArrayList<>(db.query("SELECT * FROM productsizetb m WHERE m.isvisible = true ORDER BY m.createdtime DESC",
                LegacyRowMapper.of(ProductSize.class)));
    }

    public List<ProductColor> getAllProductColor() {
        return new ArrayList<>(db.query("SELECT * FROM productcolortb m WHERE m.isvisible = true ORDER BY m.id DESC",
                LegacyRowMapper.of(ProductColor.class)));
    }

    // ---- product attributes (ProductAttributeValue / CategoryAttribute / ProductAttribute repositories) ----

    public List<com.anhmedia.portalweb.legacy.entity.ProductAttributeValue> findVisibleAttributeValuesByProductIdIn(List<Long> ids) {
        if (ids.isEmpty()) return new ArrayList<>();
        return new ArrayList<>(db.query("SELECT * FROM product_attribute_value v WHERE v.product_id IN (" + inList(ids.size())
                + ") AND v.visible = true", LegacyRowMapper.of(com.anhmedia.portalweb.legacy.entity.ProductAttributeValue.class),
                ids.toArray()));
    }

    public List<com.anhmedia.portalweb.legacy.entity.CategoryAttribute> findFilterableByCategoryCode(String categoryCode) {
        return new ArrayList<>(db.query("SELECT * FROM category_attribute ca WHERE ca.filterable = true AND ca.active = true"
                        + " AND ca.category_code = ? ORDER BY ca.display_order ASC, ca.attribute_code ASC",
                LegacyRowMapper.of(com.anhmedia.portalweb.legacy.entity.CategoryAttribute.class), categoryCode));
    }

    public List<com.anhmedia.portalweb.legacy.entity.ProductAttribute> findAllAttributesOrdered() {
        return new ArrayList<>(db.query("SELECT * FROM product_attribute a ORDER BY a.attribute_code ASC",
                LegacyRowMapper.of(com.anhmedia.portalweb.legacy.entity.ProductAttribute.class)));
    }

    /** ProductHtmlRepository.getProductHtmlByGroup ("active" index first). No visible filter in legacy either. */
    public List<ProductHtml> getProductHtmlByGroup(String groupCode, String productCode) {
        return new ArrayList<>(db.query("SELECT * FROM producthtmltb p WHERE p.producthtmlgroup = ? AND p.productcode = ?"
                        + " ORDER BY CASE WHEN LOWER(p.index) = 'active' THEN 0 ELSE 1 END, p.index ASC",
                LegacyRowMapper.of(ProductHtml.class), groupCode, productCode));
    }

    /** "SELECT pp FROM ProductPrice pp JOIN Product p ON pp.productCode = p.productCode WHERE pp.visible = true" (no ORDER BY). */
    public List<ProductPrice> getAllProductPrice() {
        return new ArrayList<>(db.query("SELECT pp.* FROM productpricetb pp JOIN producttb p ON pp.productcode = p.productcode"
                + " WHERE pp.isvisible = true", LegacyRowMapper.of(ProductPrice.class)));
    }
}
