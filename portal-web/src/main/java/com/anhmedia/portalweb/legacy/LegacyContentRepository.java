package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Article;
import com.anhmedia.portalweb.legacy.entity.Client;
import com.anhmedia.portalweb.legacy.entity.TemplateImage;
import com.anhmedia.portalweb.legacy.entity.WebMenu;
import org.springframework.dao.IncorrectResultSizeDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;

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
    private final JdbcTemplate db;

    public LegacyContentRepository(JdbcTemplate db) {
        this.db = db;
    }

    // ---- ArticleRepository ----

    /** findbyURL: LOWER(articleLink) = LOWER(?1) and visible = true (single result). */
    public Article findArticleByUrl(String link) {
        List<Article> rows = db.query(
                "SELECT * FROM articletb t WHERE LOWER(t.articlelink) = LOWER(?) AND t.isvisible = true",
                (rs, n) -> Article.fromRow(rs), link);
        if (rows.size() > 1) throw new IncorrectResultSizeDataAccessException(1, rows.size());
        return rows.isEmpty() ? null : rows.get(0);
    }

    /** getAllArticleByType: articleCategory like ?1 and visible order by modifiedTime DESC. */
    public List<Article> getAllArticleByType(String typePattern) {
        return db.query("SELECT * FROM articletb t WHERE t.articlecategory LIKE ? AND t.isvisible = true"
                        + " ORDER BY t.modifiedtime DESC",
                (rs, n) -> Article.fromRow(rs), typePattern);
    }

    /** getAllDisplayArticleByTypeAndPage. */
    public List<Article> getAllDisplayArticleByTypeAndPage(String typePattern, int page, int size) {
        return db.query("SELECT * FROM articletb t WHERE t.articlecategory LIKE ? AND t.isvisible = true"
                        + " AND t.isapproved = true AND t.islocked = false ORDER BY t.articletime DESC"
                        + " LIMIT ? OFFSET ?",
                (rs, n) -> Article.fromRow(rs), typePattern, size, (long) page * size);
    }

    /** getSpotlightArticle. */
    public List<Article> getSpotlightArticle(String typePattern, String subcatePattern, int page, int size) {
        return db.query("SELECT * FROM articletb t WHERE t.articlecategory LIKE ?"
                        + " AND LOWER(t.articlesubcategory) LIKE LOWER(?) AND t.isvisible = true"
                        + " AND t.isapproved = true AND t.islocked = false ORDER BY t.articletime DESC"
                        + " LIMIT ? OFFSET ?",
                (rs, n) -> Article.fromRow(rs), typePattern, subcatePattern, size, (long) page * size);
    }

    /** getAllDisplayedArticleWithPageWithMenu. */
    public List<Article> getAllDisplayedArticleWithPageWithMenu(String typePattern, String linkPattern, int page, int size) {
        return db.query("SELECT * FROM articletb t WHERE t.articlecategory LIKE ? AND t.menustringid LIKE ?"
                        + " AND t.isvisible = true AND t.isapproved = true AND t.islocked = false"
                        + " ORDER BY t.articletime DESC LIMIT ? OFFSET ?",
                (rs, n) -> Article.fromRow(rs), typePattern, linkPattern, size, (long) page * size);
    }

    /** countArticlesByGroupAndMenu. */
    public long countArticlesByGroupAndMenu(String typePattern, String linkPattern) {
        Long count = db.queryForObject("SELECT COUNT(*) FROM articletb t WHERE t.articlecategory LIKE ?"
                        + " AND t.menustringid LIKE ? AND t.isvisible = true AND t.isapproved = true"
                        + " AND t.islocked = false",
                Long.class, typePattern, linkPattern);
        return count == null ? 0 : count;
    }

    // ---- WebMenuRepository / ClientRepository / TemplateImageRepository ----

    /** getAllWebMenu: visible = true order by index ASC. */
    public List<WebMenu> getAllWebMenu() {
        return db.query("SELECT * FROM menutb m WHERE m.isvisible = true ORDER BY m.index ASC",
                (rs, n) -> WebMenu.fromRow(rs));
    }

    /** getClientByDomainAndLanguageCode (Optional single result). */
    public Optional<Client> getClientByDomainAndLanguageCode(String domain, String langId) {
        List<Client> rows = db.query("SELECT * FROM clienttb e WHERE e.isvisible = true AND e.clientcode = ?"
                        + " AND e.clientlangstringid = ?",
                (rs, n) -> Client.fromRow(rs), domain, langId);
        if (rows.size() > 1) throw new IncorrectResultSizeDataAccessException(1, rows.size());
        return rows.stream().findFirst();
    }

    /** findVisibleByTemplateAndLang. */
    public List<TemplateImage> findVisibleTemplateImages(String templateLink, String langCode) {
        return db.query("SELECT * FROM templateimagetb t WHERE t.isvisible = true"
                        + " AND LOWER(t.templatelink) = LOWER(?) AND LOWER(t.langcode) = LOWER(?)"
                        + " ORDER BY t.imagesequence ASC, t.stringid ASC",
                (rs, n) -> TemplateImage.fromRow(rs), templateLink, langCode);
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
