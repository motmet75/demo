package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.Client;
import com.anhmedia.portalweb.legacy.entity.TemplateImage;
import com.anhmedia.portalweb.legacy.entity.WebMenu;
import org.springframework.dao.IncorrectResultSizeDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * SQL translations of the legacy Spring Data JPA queries, one method per
 * repository method, with identical filters, LIKE patterns and ordering.
 * Hibernate mapped the unquoted camelCase columns to lower case.
 */
public class LegacyContentRepository {
    // One managed instance per (entity, id) per request, like the legacy Hibernate session.
    private static final RowMapper<Article> ARTICLE =
            (rs, n) -> PersistenceContext.managed(Article.class, rs.getInt("id"), () -> Article.fromRow(rs));
    private static final RowMapper<WebMenu> MENU =
            (rs, n) -> PersistenceContext.managed(WebMenu.class, rs.getLong("id"), () -> WebMenu.fromRow(rs));
    private static final RowMapper<Client> CLIENT =
            (rs, n) -> PersistenceContext.managed(Client.class, rs.getLong("id"), () -> Client.fromRow(rs));
    private static final RowMapper<TemplateImage> IMAGE =
            (rs, n) -> PersistenceContext.managed(TemplateImage.class, rs.getLong("id"), () -> TemplateImage.fromRow(rs));

    private final JdbcTemplate db;

    public LegacyContentRepository(JdbcTemplate db) {
        this.db = db;
    }

    // ---- ArticleRepository ----

    /** findbyURL: LOWER(articleLink) = LOWER(?1) and visible = true (single result). */
    public Article findArticleByUrl(String link) {
        List<Article> rows = db.query(
                "SELECT * FROM articletb t WHERE LOWER(t.articlelink) = LOWER(?) AND t.isvisible = true",
                ARTICLE, link);
        if (rows.size() > 1) throw new IncorrectResultSizeDataAccessException(1, rows.size());
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** getAllArticleByType: articleCategory like ?1 and visible order by modifiedTime DESC. */
    public List<Article> getAllArticleByType(String typePattern) {
        return db.query("SELECT * FROM articletb t WHERE t.articlecategory LIKE ? AND t.isvisible = true"
                        + " ORDER BY t.modifiedtime DESC",
                ARTICLE, typePattern);
    }

    /** getAllDisplayArticleByTypeAndPage. */
    public List<Article> getAllDisplayArticleByTypeAndPage(String typePattern, int page, int size) {
        return db.query("SELECT * FROM articletb t WHERE t.articlecategory LIKE ? AND t.isvisible = true"
                        + " AND t.isapproved = true AND t.islocked = false ORDER BY t.articletime DESC"
                        + " LIMIT ? OFFSET ?",
                ARTICLE, typePattern, size, (long) page * size);
    }

    /** getSpotlightArticle. */
    public List<Article> getSpotlightArticle(String typePattern, String subcatePattern, int page, int size) {
        return db.query("SELECT * FROM articletb t WHERE t.articlecategory LIKE ?"
                        + " AND LOWER(t.articlesubcategory) LIKE LOWER(?) AND t.isvisible = true"
                        + " AND t.isapproved = true AND t.islocked = false ORDER BY t.articletime DESC"
                        + " LIMIT ? OFFSET ?",
                ARTICLE, typePattern, subcatePattern, size, (long) page * size);
    }

    /** getAllDisplayedArticleWithPageWithMenu. */
    public List<Article> getAllDisplayedArticleWithPageWithMenu(String typePattern, String linkPattern, int page, int size) {
        return db.query("SELECT * FROM articletb t WHERE t.articlecategory LIKE ? AND t.menustringid LIKE ?"
                        + " AND t.isvisible = true AND t.isapproved = true AND t.islocked = false"
                        + " ORDER BY t.articletime DESC LIMIT ? OFFSET ?",
                ARTICLE, typePattern, linkPattern, size, (long) page * size);
    }

    /** countArticlesByGroupAndMenu. */
    public long countArticlesByGroupAndMenu(String typePattern, String linkPattern) {
        Long count = db.queryForObject("SELECT COUNT(*) FROM articletb t WHERE t.articlecategory LIKE ?"
                        + " AND t.menustringid LIKE ? AND t.isvisible = true AND t.isapproved = true"
                        + " AND t.islocked = false",
                Long.class, typePattern, linkPattern);
        return count == null ? 0 : count;
    }

    /** countArticlesByGroup. */
    public long countArticlesByGroup(String typePattern) {
        Long count = db.queryForObject("SELECT COUNT(*) FROM articletb t WHERE t.articlecategory LIKE ? AND t.isvisible = true"
                + " AND t.isapproved = true AND t.islocked = false", Long.class, typePattern);
        return count == null ? 0 : count;
    }

    private static final String ARTICLE_TERM = "((LOWER(unaccent(p.articletitle)) LIKE ?) OR (LOWER(unaccent(p.originauthor)) LIKE ?)"
            + " OR (LOWER(unaccent(p.articlekeyword)) LIKE ?) OR (LOWER(unaccent(p.articledescription)) LIKE ?)"
            + " OR (LOWER(unaccent(p.articlecontent)) LIKE ?))";

    private static Object[] articleSearchArgs(String catalogCode, String searchTerm) {
        String like = "%" + searchTerm + "%";
        return new Object[] {catalogCode, catalogCode, like, like, like, like, like};
    }

    /** findByCatalogOrSubCatalogPageable(catalogCode, searchTerm, pageable). */
    public List<Article> findArticlesByCatalogOrSubCatalogPageable(String catalogCode, String searchTerm, int page, int size) {
        if (page < 0 || size < 1) throw new IllegalArgumentException("Page index must not be less than zero");
        Object[] base = articleSearchArgs(catalogCode, searchTerm);
        Object[] args = java.util.Arrays.copyOf(base, base.length + 2);
        args[base.length] = size;
        args[base.length + 1] = (long) page * size;
        return db.query("SELECT * FROM articletb p WHERE p.isvisible = true AND p.isapproved = true AND p.islocked = false"
                        + " AND (p.articlecategory LIKE ? OR p.articlesubcategory LIKE ?) AND " + ARTICLE_TERM
                        + " ORDER BY p.articletime DESC LIMIT ? OFFSET ?", ARTICLE, args);
    }

    /** countByCatalogOrSubCatalog(catalogCode, searchTerm) for articles. */
    public long countArticlesByCatalogOrSubCatalog(String catalogCode, String searchTerm) {
        Long count = db.queryForObject("SELECT COUNT(*) FROM articletb p WHERE p.isvisible = true AND p.isapproved = true"
                + " AND p.islocked = false AND (p.articlecategory LIKE ? OR p.articlesubcategory LIKE ?) AND " + ARTICLE_TERM,
                Long.class, articleSearchArgs(catalogCode, searchTerm));
        return count == null ? 0 : count;
    }

    // ---- InstructionPageRepository / InstructionMediaItemRepository ----

    public List<com.anhmedia.portalweb.legacy.entity.InstructionPage> findVisibleInstructionPagesByLanguage(String languageCode) {
        return db.query("SELECT * FROM instructionpagetb p WHERE p.visible = true AND (LOWER(COALESCE(p.languagecode, 'vi')) = LOWER(?)"
                        + " OR (? = 'vi' AND p.languagecode = '')) ORDER BY p.sortorder ASC, p.modifiedtime DESC, p.title ASC",
                LegacyRowMapper.of(com.anhmedia.portalweb.legacy.entity.InstructionPage.class), languageCode, languageCode);
    }

    public List<com.anhmedia.portalweb.legacy.entity.InstructionMediaItem> findVisibleInstructionMediaByPageKey(String pageKey) {
        return db.query("SELECT * FROM instructionmediaitemtb m WHERE m.visible = true AND LOWER(m.pagekey) = LOWER(?)"
                        + " ORDER BY m.sortorder ASC, m.createdtime DESC",
                LegacyRowMapper.of(com.anhmedia.portalweb.legacy.entity.InstructionMediaItem.class), pageKey);
    }

    public Optional<com.anhmedia.portalweb.legacy.entity.InstructionMediaItem> findVisibleInstructionMediaById(long id) {
        return db.query("SELECT * FROM instructionmediaitemtb m WHERE m.visible = true AND m.id = ?",
                LegacyRowMapper.of(com.anhmedia.portalweb.legacy.entity.InstructionMediaItem.class), id).stream().findFirst();
    }

    // ---- WebMenuRepository / ClientRepository / TemplateImageRepository ----

    /** getAllWebMenu: visible = true order by index ASC. */
    public List<WebMenu> getAllWebMenu() {
        return db.query("SELECT * FROM menutb m WHERE m.isvisible = true ORDER BY m.index ASC",
                MENU);
    }

    /** getClientByDomainAndLanguageCode (Optional single result). */
    public Optional<Client> getClientByDomainAndLanguageCode(String domain, String langId) {
        List<Client> rows = db.query("SELECT * FROM clienttb e WHERE e.isvisible = true AND e.clientcode = ?"
                        + " AND e.clientlangstringid = ?",
                CLIENT, domain, langId);
        if (rows.size() > 1) throw new IncorrectResultSizeDataAccessException(1, rows.size());
        return rows.stream().findFirst();
    }

    /** findVisibleByTemplateAndLang. */
    public List<TemplateImage> findVisibleTemplateImages(String templateLink, String langCode) {
        return db.query("SELECT * FROM templateimagetb t WHERE t.isvisible = true"
                        + " AND LOWER(t.templatelink) = LOWER(?) AND LOWER(t.langcode) = LOWER(?)"
                        + " ORDER BY t.imagesequence ASC, t.stringid ASC",
                IMAGE, templateLink, langCode);
    }

    // ---- ArticleAiReviewRepository ----

    /**
     * findFirstByArticleIdAndLanguageAndSourceHashAndStatusOrderByReviewedAtDescIdDesc.
     * Hibernate adds no NULLS LAST, so PostgreSQL's DESC (nulls first) applies.
     */
    public Optional<String> findLatestApprovedSummaryHtml(int articleId, String language, String sourceContent) {
        String lang = language == null ? "" : language.trim().replace('_', '-').toLowerCase(Locale.ROOT);
        if (lang.isEmpty()) lang = "und";
        List<String> rows = db.queryForList("SELECT summary_html FROM article_ai_reviews WHERE article_id = ?"
                        + " AND language = ? AND source_hash = ? AND status = 'APPROVED'"
                        + " ORDER BY reviewed_at DESC, id DESC LIMIT 1",
                String.class, articleId, lang, sha256(sourceContent));
        return rows.stream().findFirst();
    }

    static String sha256(String sourceContent) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = (sourceContent == null ? "" : sourceContent).getBytes(StandardCharsets.UTF_8);
            return HexFormat.of().formatHex(digest.digest(bytes));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 is not available.", e);
        }
    }
}
