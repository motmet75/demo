// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity;

import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "InstructionMediaItemTB")
@Access(value = AccessType.FIELD)
public class InstructionMediaItem {

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id = 0L;

    @Column(name = "pageKey", length = 160)
    private String pageKey = "";

    @Column(name = "mediaType", length = 40)
    private String mediaType = "image";

    @Column(name = "mediaUrl", columnDefinition = "TEXT")
    private String mediaUrl = "";

    @Column(name = "thumbnailUrl", columnDefinition = "TEXT")
    private String thumbnailUrl = "";

    @Column(name = "caption", length = 1000)
    private String caption = "";

    @Column(name = "description", columnDefinition = "TEXT")
    private String description = "";

    @Column(name = "sourcePlace", length = 500)
    private String sourcePlace = "";

    @Column(name = "sourceUrl", length = 2000)
    private String sourceUrl = "";

    @Column(name = "achievement", columnDefinition = "TEXT")
    private String achievement = "";

    @Column(name = "collaborators", length = 1000)
    private String collaborators = "";

    @Column(name = "challenges", columnDefinition = "TEXT")
    private String challenges = "";

    @Column(name = "skills", length = 1000)
    private String skills = "";

    @Column(name = "occurredOn")
    private LocalDate occurredOn;

    @Column(name = "sortOrder")
    private Integer sortOrder = 0;

    @Column(name = "tenantKey", length = 160)
    private String tenantKey = "";

    @Column(name = "ownerUsername", length = 160)
    private String ownerUsername = "";

    @Column(name = "createdTime")
    private LocalDateTime createdTime = LocalDateTime.now();

    @Column(name = "modifiedTime")
    private LocalDateTime modifiedTime = LocalDateTime.now();

    @Column(name = "visible")
    private Boolean visible = true;

    public Long getId() { return id == null ? 0L : id; }
    public void setId(Long id) { this.id = id == null ? 0L : id; }

    public String getPageKey() { return text(pageKey); }
    public void setPageKey(String pageKey) { this.pageKey = text(pageKey); }

    public String getMediaType() { return text(mediaType).isBlank() ? "image" : text(mediaType).toLowerCase(); }
    public void setMediaType(String mediaType) { this.mediaType = text(mediaType); }

    public String getMediaUrl() { return text(mediaUrl); }
    public void setMediaUrl(String mediaUrl) { this.mediaUrl = text(mediaUrl); }

    public String getThumbnailUrl() { return text(thumbnailUrl); }
    public void setThumbnailUrl(String thumbnailUrl) { this.thumbnailUrl = text(thumbnailUrl); }

    public String getCaption() { return text(caption); }
    public void setCaption(String caption) { this.caption = text(caption); }

    public String getDescription() { return text(description); }
    public void setDescription(String description) { this.description = text(description); }

    public String getSourcePlace() { return text(sourcePlace); }
    public void setSourcePlace(String sourcePlace) { this.sourcePlace = text(sourcePlace); }

    public String getSourceUrl() { return text(sourceUrl); }
    public void setSourceUrl(String sourceUrl) { this.sourceUrl = text(sourceUrl); }

    public String getAchievement() { return text(achievement); }
    public void setAchievement(String achievement) { this.achievement = text(achievement); }

    public String getCollaborators() { return text(collaborators); }
    public void setCollaborators(String collaborators) { this.collaborators = text(collaborators); }

    public String getChallenges() { return text(challenges); }
    public void setChallenges(String challenges) { this.challenges = text(challenges); }

    public String getSkills() { return text(skills); }
    public void setSkills(String skills) { this.skills = text(skills); }

    public LocalDate getOccurredOn() { return occurredOn; }
    public void setOccurredOn(LocalDate occurredOn) { this.occurredOn = occurredOn; }

    public Integer getSortOrder() { return sortOrder == null ? 0 : sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder == null ? 0 : sortOrder; }

    public String getTenantKey() { return text(tenantKey); }
    public void setTenantKey(String tenantKey) { this.tenantKey = text(tenantKey); }

    public String getOwnerUsername() { return text(ownerUsername); }
    public void setOwnerUsername(String ownerUsername) { this.ownerUsername = text(ownerUsername); }

    public LocalDateTime getCreatedTime() { return createdTime; }
    public void setCreatedTime(LocalDateTime createdTime) { this.createdTime = createdTime; }

    public LocalDateTime getModifiedTime() { return modifiedTime; }
    public void setModifiedTime(LocalDateTime modifiedTime) { this.modifiedTime = modifiedTime; }

    public Boolean getVisible() { return visible == null ? Boolean.TRUE : visible; }
    public void setVisible(Boolean visible) { this.visible = visible; }

    public boolean isVideo() { return "video".equalsIgnoreCase(getMediaType()); }
    public boolean isImage() { return !isVideo(); }
    public String getFirstMediaUrl() { return firstUrl(mediaUrl); }
    public String getFirstThumbnailUrl() { return firstUrl(thumbnailUrl); }
    public String getPosterUrl() {
        String thumbnail = getFirstThumbnailUrl();
        return !thumbnail.isBlank() ? thumbnail : getFirstMediaUrl();
    }

    private String firstUrl(String value) {
        String clean = text(value);
        if (clean.isBlank()) {
            return "";
        }
        String normalized = clean.replace("\r", "\n");
        for (String line : normalized.split("\n+")) {
            for (String part : line.split("\\s*[;,]\\s*")) {
                String url = part.trim();
                if (!url.isBlank()) {
                    return url;
                }
            }
        }
        return "";
    }

    private String text(String value) {
        return value == null ? "" : value.trim();
    }
}
