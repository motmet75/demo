// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity;

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
@Table(name = "InstructionPageTB")
@Access(value = AccessType.FIELD)
public class InstructionPage {

    @Id
    @Column(name = "id")
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id = 0L;

    @Column(name = "pageKey", length = 160)
    private String pageKey = "";

    @Column(name = "title", length = 500)
    private String title = "";

    @Column(name = "description", columnDefinition = "TEXT")
    private String description = "";

    @Column(name = "coverUrl", length = 2000)
    private String coverUrl = "";

    @Column(name = "languageCode", length = 20)
    private String languageCode = "vi";

    @Column(name = "tenantKey", length = 160)
    private String tenantKey = "";

    @Column(name = "ownerUsername", length = 160)
    private String ownerUsername = "";

    @Column(name = "visibility", length = 60)
    private String visibility = "tenant";

    @Column(name = "sortOrder")
    private Integer sortOrder = 0;

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

    public String getTitle() { return text(title); }
    public void setTitle(String title) { this.title = text(title); }

    public String getDescription() { return text(description); }
    public void setDescription(String description) { this.description = text(description); }

    public String getCoverUrl() { return text(coverUrl); }
    public void setCoverUrl(String coverUrl) { this.coverUrl = text(coverUrl); }

    public String getLanguageCode() { return text(languageCode).isBlank() ? "vi" : text(languageCode).toLowerCase(); }
    public void setLanguageCode(String languageCode) { this.languageCode = text(languageCode).isBlank() ? "vi" : text(languageCode).toLowerCase(); }

    public String getTenantKey() { return text(tenantKey); }
    public void setTenantKey(String tenantKey) { this.tenantKey = text(tenantKey); }

    public String getOwnerUsername() { return text(ownerUsername); }
    public void setOwnerUsername(String ownerUsername) { this.ownerUsername = text(ownerUsername); }

    public String getVisibility() { return text(visibility).isBlank() ? "tenant" : text(visibility); }
    public void setVisibility(String visibility) { this.visibility = text(visibility); }

    public Integer getSortOrder() { return sortOrder == null ? 0 : sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder == null ? 0 : sortOrder; }

    public LocalDateTime getCreatedTime() { return createdTime; }
    public void setCreatedTime(LocalDateTime createdTime) { this.createdTime = createdTime; }

    public LocalDateTime getModifiedTime() { return modifiedTime; }
    public void setModifiedTime(LocalDateTime modifiedTime) { this.modifiedTime = modifiedTime; }

    public Boolean getVisible() { return visible == null ? Boolean.TRUE : visible; }
    public void setVisible(Boolean visible) { this.visible = visible; }

    public boolean isVisible() { return Boolean.TRUE.equals(getVisible()); }

    private String text(String value) {
        return value == null ? "" : value.trim();
    }
}
