package com.anhmedia.portalweb.legacy.entity;

import com.anhmedia.portalweb.legacy.Utilities;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDateTime;

/**
 * Port of legacy com.vaadin.example.data.entity.Article (table ArticleTB).
 * Getters, setters and their side effects are kept identical because the
 * Thymeleaf templates read them by property name.
 */
public class Article implements Comparable<Article> {

    private Integer id = 0;
    private String articleId = "";
    private String postId = "n";
    private String articleLink = "none";
    private String articleTemplate = "blog-single.html";
    private String menuStringId = "none";
    private String index = "none";
    private Long viewCount = 0L;
    private Double rating = 0.0;
    private String articleTitle = "none";
    private String articleCategory = "none";
    private String videoUrl = "videoUrl";
    private String articleSubCategory = "none";
    private String articleLangCode = "en";
    private String username = "none";
    private String originAuthor = "none";
    private String articleKeyWord = "none";
    private String articleThumnailURL = "none";
    private String articleDescription = "none";
    private String articleContent = "none";
    private Boolean visible = true;
    private Boolean approved = false;
    private Boolean locked = false;
    private LocalDateTime createdTime = LocalDateTime.now();
    private LocalDateTime modifiedTime = LocalDateTime.now();
    private LocalDateTime articleTime = LocalDateTime.now();
    private LocalDateTime lastPostTime = null;
    private Integer tiktokPostCount = 0;
    private Integer youtubePostCount = 0;
    private Integer facebookPostCount = 0;
    private LocalDateTime lastPostTimeTiktok = null;
    private LocalDateTime lastPostTimeYoutube = null;
    private LocalDateTime lastPostTimeYoutubeShort = null;
    private LocalDateTime lastPostTimeFacebook = null;
    private Integer youtubeShortPostCount = 0;
    private String rejectedByUser = "none";
    private String rejectedReason = "none";

    // @Transient in the legacy entity
    private String hostString = "";
    private String beanStatus = "old";
    private String articleThumnailURLWithHost2 = "";
    private String tenantString = "";
    private String URLbyAticleLangCode = "";

    public Article() {}

    public Article(String title, String link, String template, String category, String lang) {
        setArticleTitle(title);
        setArticleLink(link);
        setArticleTemplate(template);
        setArticleCategory(category);
        setArticleLangCode(lang);
    }

    /** Field-level hydration, like Hibernate @Access(FIELD): NULL columns stay null. */
    public static Article fromRow(ResultSet rs) throws SQLException {
        Article a = new Article();
        a.id = rs.getInt("id");
        a.articleId = rs.getString("articleid");
        a.postId = rs.getString("postid");
        a.articleLink = rs.getString("articlelink");
        a.articleTemplate = rs.getString("articletemplate");
        a.menuStringId = rs.getString("menustringid");
        a.index = rs.getString("index");
        Object views = rs.getObject("viewcount");
        a.viewCount = views == null ? null : ((Number) views).longValue();
        BigDecimal rate = rs.getBigDecimal("rating");
        a.rating = rate == null ? null : rate.doubleValue();
        a.articleTitle = rs.getString("articletitle");
        a.articleCategory = rs.getString("articlecategory");
        a.videoUrl = rs.getString("video_url");
        a.articleSubCategory = rs.getString("articlesubcategory");
        a.articleLangCode = rs.getString("articlelangcode");
        a.username = rs.getString("username");
        a.originAuthor = rs.getString("originauthor");
        a.articleKeyWord = rs.getString("articlekeyword");
        a.articleThumnailURL = rs.getString("articlethumnailurl");
        a.articleDescription = rs.getString("articledescription");
        a.articleContent = rs.getString("articlecontent");
        a.visible = (Boolean) rs.getObject("isvisible");
        a.approved = (Boolean) rs.getObject("isapproved");
        a.locked = (Boolean) rs.getObject("islocked");
        a.createdTime = time(rs, "createdtime");
        a.modifiedTime = time(rs, "modifiedtime");
        a.articleTime = time(rs, "articletime");
        a.lastPostTime = time(rs, "lastposttime");
        a.tiktokPostCount = integer(rs, "tiktokpostcount");
        a.youtubePostCount = integer(rs, "youtubepostcount");
        a.facebookPostCount = integer(rs, "facebookpostcount");
        a.lastPostTimeTiktok = time(rs, "lastposttimetiktok");
        a.lastPostTimeYoutube = time(rs, "lastposttimeyoutube");
        a.lastPostTimeYoutubeShort = time(rs, "lastposttimeyoutubeshort");
        a.lastPostTimeFacebook = time(rs, "lastposttimefacebook");
        a.youtubeShortPostCount = integer(rs, "youtubeshortpostcount");
        a.rejectedByUser = rs.getString("rejectedbyuser");
        a.rejectedReason = rs.getString("rejectedreason");
        return a;
    }

    static LocalDateTime time(ResultSet rs, String column) throws SQLException {
        if (!hasColumn(rs, column)) return null;
        Timestamp t = rs.getTimestamp(column);
        return t == null ? null : t.toLocalDateTime();
    }

    static Integer integer(ResultSet rs, String column) throws SQLException {
        if (!hasColumn(rs, column)) return null;
        Object v = rs.getObject(column);
        return v == null ? null : ((Number) v).intValue();
    }

    /** Some tenant schemas predate the social-posting columns. */
    static boolean hasColumn(ResultSet rs, String column) throws SQLException {
        var meta = rs.getMetaData();
        for (int i = 1; i <= meta.getColumnCount(); i++) {
            if (meta.getColumnLabel(i).equalsIgnoreCase(column)) return true;
        }
        return false;
    }

    public String getTenantString() { return tenantString; }
    public void setTenantString(String tenantString) { this.tenantString = tenantString; }

    public String getURLbyAticleLangCode() {
        String urlByLang = Utilities.getConfigByTenantAndLang(articleLink, tenantString, articleLangCode);
        if (!urlByLang.isEmpty()) {
            URLbyAticleLangCode = urlByLang;
        } else {
            URLbyAticleLangCode = articleLink;
        }
        return URLbyAticleLangCode;
    }

    public void setURLbyAticleLangCode(String uRLbyAticleLangCode) { URLbyAticleLangCode = uRLbyAticleLangCode; }

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public String getArticleId() {
        if (Utilities.ValidateInputValue(articleId).isBlank() || id == 0) {
            articleId = String.valueOf(System.currentTimeMillis());
        }
        return articleId;
    }

    public void setArticleId(String articleId) { this.articleId = Utilities.ValidateInputValue(articleId); }

    public String getArticleLink() { return Utilities.GetBackStringValue(articleLink); }
    public void setArticleLink(String articleLink) { this.articleLink = Utilities.ValidateInputValue(articleLink); }

    public String getArticleTitle() { return Utilities.GetBackStringValue(articleTitle).toUpperCase(); }
    public String getNormalArticleTitle() { return Utilities.GetBackStringValue(articleTitle); }
    public void setArticleTitle(String articleTitle) { this.articleTitle = Utilities.ValidateInputValue(articleTitle); }

    public String getArticleKeyWord() { return articleKeyWord == null ? "none" : articleKeyWord; }

    public void setArticleKeyWord(String articleKeyWord) {
        if (articleKeyWord != null && !articleKeyWord.isEmpty()) {
            this.articleKeyWord = Utilities.ValidateInputValue(articleKeyWord);
        }
    }

    public String getArticleThumnailURL() { return articleThumnailURL; }

    public String getArticleThumnailURLWithHost() {
        if (articleThumnailURL.contains("http")) {
            return articleThumnailURL;
        } else if (articleCategory.contains("policyfile")) {
            return Utilities.getHostbaseurl(hostString) + "/file/" + articleThumnailURL;
        }
        return Utilities.getHostbaseurl(hostString) + "/image/" + articleThumnailURL;
    }

    public String getFileThumnailURLWithHost() {
        String returnString;
        String extString = Utilities.getFileExtension(getArticleLink()).toLowerCase();
        if (extString.contains("jpg") || extString.contains("jpeg") || extString.contains("png")
                || extString.contains("gif") || extString.contains("webp")) {
            returnString = getArticleThumnailURLWithHost();
        } else if (extString.contains("ppt")) {
            if (articleThumnailURL.contains("http")) return articleThumnailURL;
            returnString = Utilities.getHostbaseurl(tenantString) + "/" + Utilities.getConfigValueByLanguage("ppt", "en");
        } else if (extString.contains("doc")) {
            if (articleThumnailURL.contains("http")) return articleThumnailURL;
            returnString = Utilities.getHostbaseurl(tenantString) + "/" + Utilities.getConfigValueByLanguage("word", "en");
        } else if (extString.contains("xls")) {
            if (articleThumnailURL.contains("http")) return articleThumnailURL;
            returnString = Utilities.getHostbaseurl(tenantString) + "/" + Utilities.getConfigValueByLanguage("excel", "en");
        } else if (extString.contains("pdf")) {
            if (articleThumnailURL.contains("http")) return articleThumnailURL;
            returnString = Utilities.getHostbaseurl(tenantString) + "/" + Utilities.getConfigValueByLanguage("pdf", "en");
        } else if (extString.contains("zip")) {
            if (articleThumnailURL.contains("http")) return articleThumnailURL;
            returnString = Utilities.getHostbaseurl(tenantString) + "/" + Utilities.getConfigValueByLanguage("zip", "en");
        } else if (extString.contains("rar")) {
            if (articleThumnailURL.contains("http")) return articleThumnailURL;
            returnString = Utilities.getHostbaseurl(tenantString) + "/" + Utilities.getConfigValueByLanguage("rar", "en");
        } else {
            if (articleThumnailURL.contains("http")) return articleThumnailURL;
            returnString = Utilities.getHostbaseurl(tenantString) + "/" + Utilities.getConfigValueByLanguage("file", "en");
        }
        return returnString;
    }

    public void setArticleThumnailURL(String articleThumnailURL) {
        if (articleThumnailURL != null && !articleThumnailURL.isEmpty()) {
            this.articleThumnailURL = Utilities.ValidateInputValue(articleThumnailURL);
            if (articleThumnailURL != null && !articleThumnailURL.contains("http")) {
                if (articleCategory.contains("policyfile")) {
                    articleThumnailURLWithHost2 = Utilities.getHostbaseurl(hostString) + "/file/" + this.articleThumnailURL;
                } else {
                    articleThumnailURLWithHost2 = Utilities.getHostbaseurl(hostString) + "/image/" + this.articleThumnailURL;
                }
            } else {
                articleThumnailURLWithHost2 = articleThumnailURL;
            }
        }
    }

    public String getArticleDescription() { return Utilities.GetBackStringValue(articleDescription); }

    public void setArticleDescription(String articleDescription) {
        if (articleDescription != null && !articleDescription.isEmpty()) {
            this.articleDescription = Utilities.ValidateInputValue(articleDescription);
        }
    }

    public String getArticleContent() { return Utilities.GetBackStringValue(articleContent); }
    public void setArticleContent(String articleContent) { this.articleContent = Utilities.ValidateInputValue(articleContent); }

    public LocalDateTime getCreatedTime() { return createdTime; }
    public void setCreatedTime(LocalDateTime createdTime) { if (createdTime != null) this.createdTime = createdTime; }

    public String getArticleCategory() { return articleCategory; }
    public void setArticleCategory(String articleCategory) { this.articleCategory = Utilities.ValidateInputValue(articleCategory); }

    public String getArticleSubCategory() { return articleSubCategory == null ? "none" : articleSubCategory; }

    public void setArticleSubCategory(String articleSubCategory) {
        if (articleSubCategory != null && !articleSubCategory.isEmpty()) this.articleSubCategory = articleSubCategory;
    }

    public LocalDateTime getModifiedTime() { return modifiedTime; }
    public void setModifiedTime(LocalDateTime modifiedTime) { this.modifiedTime = modifiedTime; }

    public void setVisible(Boolean isVisible) { this.visible = isVisible; }
    public Boolean getVisible() { return visible; }
    public void setApproved(Boolean isApproved) { this.approved = isApproved; }
    public Boolean getApproved() { return approved; }
    public Boolean getLocked() { return locked; }
    public void setLocked(Boolean isLocked) { this.locked = isLocked; }

    public String getArticleLangCode() { return articleLangCode; }

    public void setArticleLangCode(String aticleLangCode) {
        if (aticleLangCode != null && aticleLangCode.equals("en_us")) aticleLangCode = "en";
        this.articleLangCode = aticleLangCode;
    }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getRejectedByUser() { return rejectedByUser == null ? "none" : rejectedByUser; }
    public void setRejectedByUser(String rejectedByUser) { this.rejectedByUser = Utilities.ValidateInputValue(rejectedByUser); }

    public String getRejectedReason() { return Utilities.GetBackStringValue(rejectedReason); }
    public void setRejectedReason(String rejectedReason) { this.rejectedReason = Utilities.ValidateInputValue(rejectedReason); }

    public LocalDateTime getArticleTime() { return articleTime == null ? LocalDateTime.now().minusYears(50) : articleTime; }
    public void setArticleTime(LocalDateTime articleTime) { this.articleTime = articleTime; }

    public LocalDateTime getLastPostTime() { return lastPostTime; }
    public Integer getTiktokPostCount() { return tiktokPostCount == null ? 0 : tiktokPostCount; }
    public Integer getYoutubePostCount() { return youtubePostCount == null ? 0 : youtubePostCount; }
    public Integer getFacebookPostCount() { return facebookPostCount == null ? 0 : facebookPostCount; }
    public LocalDateTime getLastPostTimeTiktok() { return lastPostTimeTiktok; }
    public LocalDateTime getLastPostTimeYoutube() { return lastPostTimeYoutube; }
    public LocalDateTime getLastPostTimeYoutubeShort() { return lastPostTimeYoutubeShort; }
    public LocalDateTime getLastPostTimeFacebook() { return lastPostTimeFacebook; }
    public Integer getYoutubeShortPostCount() { return youtubeShortPostCount == null ? 0 : youtubeShortPostCount; }

    public String getHostString() { return hostString; }

    public void setHostString(String hostString) {
        this.hostString = hostString;
        this.tenantString = hostString;
    }

    public String getArticleThumnailURLWithHost2() { return articleThumnailURLWithHost2; }
    public void setArticleThumnailURLWithHost2(String value) { this.articleThumnailURLWithHost2 = value; }

    public String getOriginAuthor() { return originAuthor == null ? "none" : originAuthor; }

    public String getMenuStringId() { return menuStringId; }

    public Long getViewCount() { return viewCount == null ? 0 : viewCount; }
    public Double getRating() { return rating; }

    public String getPostId() { return postId; }

    public String getArticleTemplate() { return articleTemplate == null ? "default" : articleTemplate; }

    public void setArticleTemplate(String articleTemplate) {
        if (articleTemplate != null && !articleTemplate.isBlank()) this.articleTemplate = articleTemplate;
    }

    public String getBeanStatus() { return beanStatus; }
    public void setBeanStatus(String beanStatus) { this.beanStatus = beanStatus; }

    public String getIndex() { return index == null ? "0" : index; }

    public String getVideoUrl() { return videoUrl; }

    @Override
    public int compareTo(Article o) { return this.getCreatedTime().compareTo(o.getCreatedTime()); }

    public String getArticleContentPure() {
        if (articleContent == null || articleContent.isBlank()) return "";
        Document doc = Jsoup.parse(articleContent);
        StringBuilder result = new StringBuilder();
        for (Element element : doc.body().children()) {
            if ("p".equalsIgnoreCase(element.tagName())) {
                String text = element.text().trim();
                if (!text.isEmpty()) result.append(text).append("\n");
            } else {
                String otherText = element.text().trim();
                if (!otherText.isEmpty()) result.append(otherText).append(" ");
            }
        }
        return result.toString().trim();
    }

    public String getDailymotionVideoId() {
        if (videoUrl == null) return null;
        int idx = videoUrl.indexOf("video=");
        if (idx >= 0) {
            String id = videoUrl.substring(idx + 6);
            int amp = id.indexOf('&');
            if (amp > 0) id = id.substring(0, amp);
            return id;
        }
        return null;
    }
}
