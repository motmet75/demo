package com.anhmedia.portalweb.legacy.entity;

import com.anhmedia.portalweb.legacy.Utilities;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;

/** Port of legacy TemplateImage (table TemplateImageTb). */
public class TemplateImage {
    private Long id;
    private String stringId = "image001";
    private String templateLink = "quan-an-mini-0-dong.html";
    private String langCode = "vi";
    private String imageUrl = "";
    private String mediaType = "image";
    private String mediaUrl = "";
    private String embedUrl = "";
    private String imageWidth = "100%";
    private String imageHeight = "auto";
    private String remark = "";
    private Integer imageSequence = 1;
    private LocalDateTime createdTime = LocalDateTime.now();
    private LocalDateTime modifiedTime = LocalDateTime.now();
    private Boolean visible = true;

    public static TemplateImage fromRow(ResultSet rs) throws SQLException {
        TemplateImage t = new TemplateImage();
        t.id = rs.getLong("id");
        t.stringId = rs.getString("stringid");
        t.templateLink = rs.getString("templatelink");
        t.langCode = rs.getString("langcode");
        t.imageUrl = rs.getString("imageurl");
        t.mediaType = rs.getString("mediatype");
        t.mediaUrl = rs.getString("mediaurl");
        t.embedUrl = rs.getString("embedurl");
        t.imageWidth = rs.getString("imagewidth");
        t.imageHeight = rs.getString("imageheight");
        t.remark = rs.getString("remark");
        t.imageSequence = Article.integer(rs, "imagesequence");
        t.createdTime = Article.time(rs, "createdtime");
        t.modifiedTime = Article.time(rs, "modifiedtime");
        t.visible = (Boolean) rs.getObject("isvisible");
        return t;
    }

    public Long getId() { return id; }
    public String getStringId() { return stringId == null ? "" : Utilities.GetBackStringValue(stringId); }
    public String getTemplateLink() { return templateLink == null ? "" : Utilities.GetBackStringValue(templateLink); }
    public String getLangCode() { return langCode == null ? "" : Utilities.GetBackStringValue(langCode); }
    public String getImageUrl() { return imageUrl == null ? "" : Utilities.GetBackStringValue(imageUrl); }
    public String getMediaType() { return mediaType == null || mediaType.isBlank() ? "image" : Utilities.GetBackStringValue(mediaType); }
    public String getMediaUrl() { return mediaUrl == null ? "" : Utilities.GetBackStringValue(mediaUrl); }
    public String getEmbedUrl() { return embedUrl == null ? "" : Utilities.GetBackStringValue(embedUrl); }
    public String getImageWidth() { return imageWidth == null || imageWidth.isBlank() ? "100%" : Utilities.GetBackStringValue(imageWidth); }
    public String getImageHeight() { return imageHeight == null || imageHeight.isBlank() ? "auto" : Utilities.GetBackStringValue(imageHeight); }
    public String getRemark() { return remark == null ? "" : Utilities.GetBackStringValue(remark); }
    public Integer getImageSequence() { return imageSequence == null ? 0 : imageSequence; }
    public LocalDateTime getCreatedTime() { return createdTime; }
    public LocalDateTime getModifiedTime() { return modifiedTime; }
    public Boolean getVisible() { return visible == null ? Boolean.TRUE : visible; }
    public boolean hasImageUrl() { return getImageUrl().length() > 6; }
    public boolean hasMediaUrl() { return getMediaUrl().length() > 6 || hasImageUrl(); }
    public boolean hasEmbedUrl() { return getEmbedUrl().length() > 6; }
    public boolean isImage() { return "image".equalsIgnoreCase(getMediaType()); }
    public boolean isNativeVideo() { return "video".equalsIgnoreCase(getMediaType()); }
    public boolean isYouTube() { return "youtube".equalsIgnoreCase(getMediaType()) || "youtube_short".equalsIgnoreCase(getMediaType()); }
    public boolean isFacebook() { return "facebook".equalsIgnoreCase(getMediaType()); }
    public boolean isTikTok() { return "tiktok".equalsIgnoreCase(getMediaType()); }
    public boolean isVideo() { return isNativeVideo() || isYouTube() || isFacebook() || isTikTok(); }
    public String getDisplayMediaUrl() { return !getMediaUrl().isBlank() ? getMediaUrl() : getImageUrl(); }

    public String getVideoProviderLabel() {
        if (isNativeVideo()) return "Video";
        if (isYouTube()) return "YouTube";
        if (isFacebook()) return "Facebook";
        if (isTikTok()) return "TikTok";
        return "Image";
    }

    public String getTikTokVideoId() {
        String url = getDisplayMediaUrl();
        int marker = url.indexOf("/video/");
        if (marker < 0) return "";
        String id = url.substring(marker + 7);
        int query = id.indexOf('?');
        if (query >= 0) id = id.substring(0, query);
        int slash = id.indexOf('/');
        if (slash >= 0) id = id.substring(0, slash);
        return id.trim();
    }

    public String getWidthCss() { return normalizeCssSize(getImageWidth(), "100%"); }
    public String getHeightCss() { return normalizeCssSize(getImageHeight(), "auto"); }

    private String normalizeCssSize(String value, String fallback) {
        if (value == null || value.isBlank()) return fallback;
        String trimmed = value.trim();
        if (trimmed.matches("^[0-9]+$")) return trimmed + "px";
        return trimmed;
    }
}
