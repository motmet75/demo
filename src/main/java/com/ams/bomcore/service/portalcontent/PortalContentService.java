package com.ams.bomcore.service.portalcontent;

import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class PortalContentService {
    private final PortalTenantDataSourceRegistry tenants;

    public PortalContentService(PortalTenantDataSourceRegistry tenants) {
        this.tenants = tenants;
    }

    public List<String> tenantIds() { return tenants.tenantIds(); }

    public List<ArticleView> articles(String tenantId, String search) {
        String query = search(search);
        String sql = """
                SELECT id, articleid, username, articlelink, articlecategory, articlelangcode,
                       articlesubcategory, articletitle, articlekeyword, articlethumnailurl,
                       articledescription, articlecontent, createdtime, modifiedtime,
                       isvisible, isapproved, islocked, articletemplate
                  FROM articletb
                 WHERE (? = '' OR lower(coalesce(articletitle,'')) LIKE ? OR lower(coalesce(articlelink,'')) LIKE ?)
                 ORDER BY modifiedtime DESC NULLS LAST, id DESC LIMIT 500
                """;
        return access(tenantId, db -> db.query(sql, this::article, query, like(query), like(query)));
    }

    public ArticleView createArticle(String tenantId, ArticleWrite value, String actor) {
        ArticleWrite input = validate(value);
        String sql = """
                INSERT INTO articletb
                    (articleid, username, articlelink, articlecategory, articlelangcode,
                     articlesubcategory, articletitle, articlekeyword, articlethumnailurl,
                     articledescription, articlecontent, createdtime, modifiedtime,
                     isvisible, isapproved, islocked, articletemplate, articletime)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                RETURNING id
                """;
        Integer id = access(tenantId, db -> db.queryForObject(sql, Integer.class,
                String.valueOf(System.currentTimeMillis()), text(actor, "admin"), input.articleLink(),
                input.category(), input.language(), input.subCategory(), input.title(), input.keywords(),
                input.thumbnailUrl(), input.description(), input.content(), input.visible(), input.approved(),
                input.locked(), input.template()));
        return articleById(tenantId, id);
    }

    public ArticleView updateArticle(String tenantId, int id, ArticleWrite value) {
        ArticleWrite input = validate(value);
        String sql = """
                UPDATE articletb SET articlelink=?, articlecategory=?, articlelangcode=?,
                    articlesubcategory=?, articletitle=?, articlekeyword=?, articlethumnailurl=?,
                    articledescription=?, articlecontent=?, modifiedtime=CURRENT_TIMESTAMP,
                    isvisible=?, isapproved=?, islocked=?, articletemplate=? WHERE id=?
                """;
        int changed = access(tenantId, db -> db.update(sql, input.articleLink(), input.category(), input.language(),
                input.subCategory(), input.title(), input.keywords(), input.thumbnailUrl(), input.description(),
                input.content(), input.visible(), input.approved(), input.locked(), input.template(), id));
        if (changed != 1) throw new IllegalArgumentException("Article not found");
        return articleById(tenantId, id);
    }

    public List<ProductView> products(String tenantId, String search) {
        String query = search(search);
        String sql = """
                SELECT id, productname, productcode, productcatalog, productsubcatalog,
                       productshortdes, productlongdes, productstatus, productimageurl1,
                       productimagedesurl, productvideoadd, productpriceamount, productdiscont,
                       productpricecurrency, language, path, createdtime, modifiedtime,
                       isvisible, isapproved, islocked, isnew, productbrand, productgroupstring
                  FROM producttb
                 WHERE (? = '' OR lower(coalesce(productname,'')) LIKE ? OR lower(coalesce(productcode,'')) LIKE ?)
                 ORDER BY modifiedtime DESC NULLS LAST, id DESC LIMIT 500
                """;
        return access(tenantId, db -> db.query(sql, this::product, query, like(query), like(query)));
    }

    public ProductView createProduct(String tenantId, ProductWrite value) {
        ProductWrite input = validate(value);
        String sql = """
                INSERT INTO producttb
                    (productname, productcode, productcatalog, productsubcatalog, productshortdes,
                     productlongdes, productstatus, productimageurl1, productimagedesurl, productvideoadd,
                     productpriceamount, productdiscont, productpricecurrency, language, path,
                     createdtime, modifiedtime, isvisible, isapproved, islocked, isnew,
                     productbrand, productgroupstring)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
                        ?, ?, ?, ?, ?, ?) RETURNING id
                """;
        Integer id = access(tenantId, db -> db.queryForObject(sql, Integer.class,
                input.name(), input.code(), input.catalog(), input.subCatalog(), input.shortDescription(),
                input.longDescription(), input.status(), input.imageUrl(), input.imageDescriptionUrl(),
                input.videoUrl(), input.price(), input.discount(), input.currency(), input.language(), input.path(),
                input.visible(), input.approved(), input.locked(), input.newProduct(), input.brand(), input.group()));
        return productById(tenantId, id);
    }

    public ProductView updateProduct(String tenantId, int id, ProductWrite value) {
        ProductWrite input = validate(value);
        String sql = """
                UPDATE producttb SET productname=?, productcode=?, productcatalog=?, productsubcatalog=?,
                    productshortdes=?, productlongdes=?, productstatus=?, productimageurl1=?,
                    productimagedesurl=?, productvideoadd=?, productpriceamount=?, productdiscont=?,
                    productpricecurrency=?, language=?, path=?, modifiedtime=CURRENT_TIMESTAMP,
                    isvisible=?, isapproved=?, islocked=?, isnew=?, productbrand=?, productgroupstring=?
                 WHERE id=?
                """;
        int changed = access(tenantId, db -> db.update(sql, input.name(), input.code(), input.catalog(),
                input.subCatalog(), input.shortDescription(), input.longDescription(), input.status(), input.imageUrl(),
                input.imageDescriptionUrl(), input.videoUrl(), input.price(), input.discount(), input.currency(),
                input.language(), input.path(), input.visible(), input.approved(), input.locked(), input.newProduct(),
                input.brand(), input.group(), id));
        if (changed != 1) throw new IllegalArgumentException("Product not found");
        return productById(tenantId, id);
    }

    private ArticleView articleById(String tenantId, int id) {
        return articles(tenantId, "").stream().filter(row -> row.id() == id).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Article not found"));
    }

    private ProductView productById(String tenantId, int id) {
        return products(tenantId, "").stream().filter(row -> row.id() == id).findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Product not found"));
    }

    private ArticleView article(ResultSet row, int ignored) throws SQLException {
        return new ArticleView(row.getInt("id"), row.getString("articleid"), row.getString("username"),
                row.getString("articlelink"), row.getString("articlecategory"), row.getString("articlelangcode"),
                row.getString("articlesubcategory"), row.getString("articletitle"), row.getString("articlekeyword"),
                row.getString("articlethumnailurl"), row.getString("articledescription"), row.getString("articlecontent"),
                time(row, "createdtime"), time(row, "modifiedtime"), row.getBoolean("isvisible"),
                row.getBoolean("isapproved"), row.getBoolean("islocked"), row.getString("articletemplate"));
    }

    private ProductView product(ResultSet row, int ignored) throws SQLException {
        return new ProductView(row.getInt("id"), row.getString("productname"), row.getString("productcode"),
                row.getString("productcatalog"), row.getString("productsubcatalog"), row.getString("productshortdes"),
                row.getString("productlongdes"), row.getString("productstatus"), row.getString("productimageurl1"),
                row.getString("productimagedesurl"), row.getString("productvideoadd"), row.getBigDecimal("productpriceamount"),
                row.getBigDecimal("productdiscont"), row.getString("productpricecurrency"), row.getString("language"),
                row.getString("path"), time(row, "createdtime"), time(row, "modifiedtime"), row.getBoolean("isvisible"),
                row.getBoolean("isapproved"), row.getBoolean("islocked"), row.getBoolean("isnew"),
                row.getString("productbrand"), row.getString("productgroupstring"));
    }

    private static LocalDateTime time(ResultSet row, String field) throws SQLException {
        var value = row.getTimestamp(field);
        return value == null ? null : value.toLocalDateTime();
    }

    private ArticleWrite validate(ArticleWrite value) {
        if (value == null) throw new IllegalArgumentException("Article is required");
        return new ArticleWrite(required(value.title(), "Article title", 255),
                required(value.articleLink(), "Article link", 255), text(value.category(), "none"),
                text(value.subCategory(), "none"), text(value.language(), "vi"), text(value.keywords(), "none"),
                text(value.thumbnailUrl(), "none"), text(value.description(), "none"), text(value.content(), "none"),
                text(value.template(), "blog-single.html"), value.visible(), value.approved(), value.locked());
    }

    private ProductWrite validate(ProductWrite value) {
        if (value == null) throw new IllegalArgumentException("Product is required");
        BigDecimal discount = value.discount() == null ? BigDecimal.ZERO : value.discount();
        if (discount.compareTo(BigDecimal.ZERO) < 0 || discount.compareTo(new BigDecimal("99.99")) > 0)
            throw new IllegalArgumentException("Discount must be between 0 and 99.99");
        return new ProductWrite(required(value.name(), "Product name", 255), required(value.code(), "Product code", 255),
                text(value.catalog(), "none"), text(value.subCatalog(), "none"), text(value.brand(), "none"),
                text(value.status(), "available"), text(value.shortDescription(), ""), text(value.longDescription(), ""),
                text(value.imageUrl(), ""), text(value.imageDescriptionUrl(), ""), text(value.videoUrl(), ""),
                value.price() == null ? BigDecimal.ZERO : value.price(), discount, text(value.currency(), "VND"),
                text(value.language(), "vi"), required(value.path(), "Product path", 2000), text(value.group(), "none"),
                value.visible(), value.approved(), value.locked(), value.newProduct());
    }

    private <T> T access(String tenantId, DatabaseWork<T> work) {
        try { return work.run(new JdbcTemplate(tenants.dataSource(tenantId))); }
        catch (IllegalArgumentException exception) { throw exception; }
        catch (DataAccessException exception) {
            throw new IllegalStateException("Portal database operation failed for tenant "
                    + PortalTenantDataSourceRegistry.normalizeTenantId(tenantId), exception);
        }
    }

    private static String search(String value) { return value == null ? "" : value.trim().toLowerCase(); }
    private static String like(String value) { return "%" + value + "%"; }
    private static String text(String value, String fallback) { return value == null || value.isBlank() ? fallback : value.trim(); }
    private static String required(String value, String label, int max) {
        String result = value == null ? "" : value.trim();
        if (result.isEmpty() || result.length() > max) throw new IllegalArgumentException(label + " is required and must be at most " + max + " characters");
        return result;
    }

    @FunctionalInterface private interface DatabaseWork<T> { T run(JdbcTemplate db); }

    public record ArticleView(int id, String articleId, String username, String articleLink, String category,
                              String language, String subCategory, String title, String keywords, String thumbnailUrl,
                              String description, String content, LocalDateTime createdTime, LocalDateTime modifiedTime,
                              boolean visible, boolean approved, boolean locked, String template) {}
    public record ArticleWrite(String title, String articleLink, String category, String subCategory, String language,
                               String keywords, String thumbnailUrl, String description, String content, String template,
                               boolean visible, boolean approved, boolean locked) {}
    public record ProductView(int id, String name, String code, String catalog, String subCatalog,
                              String shortDescription, String longDescription, String status, String imageUrl,
                              String imageDescriptionUrl, String videoUrl, BigDecimal price, BigDecimal discount,
                              String currency, String language, String path, LocalDateTime createdTime,
                              LocalDateTime modifiedTime, boolean visible, boolean approved, boolean locked,
                              boolean newProduct, String brand, String group) {}
    public record ProductWrite(String name, String code, String catalog, String subCatalog, String brand, String status,
                               String shortDescription, String longDescription, String imageUrl, String imageDescriptionUrl,
                               String videoUrl, BigDecimal price, BigDecimal discount, String currency, String language,
                               String path, String group, boolean visible, boolean approved, boolean locked, boolean newProduct) {}
}
