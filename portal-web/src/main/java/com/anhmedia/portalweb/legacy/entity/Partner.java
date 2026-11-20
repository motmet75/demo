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

import com.anhmedia.portalweb.legacy.Utilities; 

 @Entity
@Table(name = "partnerTB")
@Access(value=AccessType.FIELD) 
public class  Partner { 
 	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private Long id = (long) 0.0 ; 
	@Column(name="stringId") 
	private String  stringId = String.valueOf(System.currentTimeMillis()) ; 
	@Column(name="partnerName") 
	private String  partnerName = "none" ; 
	@Column(name="partnerLogo") 
	private String  partnerLogo = "none" ; 
	@Column(name="langCode") 
	private String  langCode = "none" ; 
	@Column(name="createdTime") 
	private LocalDateTime createdTime = LocalDateTime.now() ; 
	@Column(name="modifiedTime") 
	private LocalDateTime modifiedTime = LocalDateTime.now() ; 
	@Column(name="isApproved") 
	private Boolean approved = true ; 
	@Column(name="isLocked") 
	private Boolean locked = false ; 
	@Column(name="isVisible") 
	private Boolean visible = true ; 
	public void setId(Long id) {
		this.id = id;
	}

	public Long getId() {
		return id;
	} 
 
	public void setStringId(String stringId) {
		this.stringId = Utilities.ValidateInputValue(stringId);
	}

	public String getStringId() {
		return  stringId==null?"":Utilities.GetBackStringValue(stringId);
	} 
 
	public void setPartnerName(String partnerName) {
		this.partnerName = Utilities.ValidateInputValue(partnerName);
	}

	public String getPartnerName() {
		return  partnerName==null?"":Utilities.GetBackStringValue(partnerName);
	} 
 
	public void setPartnerLogo(String partnerLogo) {
		this.partnerLogo = Utilities.ValidateInputValue(partnerLogo);
	}

	public String getPartnerLogo() {
		return  partnerLogo==null?"":Utilities.GetBackStringValue(partnerLogo);
	} 
 
	public void setLangCode(String langCode) {
		this.langCode = Utilities.ValidateInputValue(langCode);
	}

	public String getLangCode() {
		return  langCode==null?"":Utilities.GetBackStringValue(langCode);
	} 
 
	public void setCreatedTime(LocalDateTime createdTime) {
		this.createdTime = createdTime;
	}

	public LocalDateTime getCreatedTime() {
		return createdTime;
	} 
 
	public void setModifiedTime(LocalDateTime modifiedTime) {
		this.modifiedTime = modifiedTime;
	}

	public LocalDateTime getModifiedTime() {
		return modifiedTime;
	} 
 
	public void setApproved(Boolean approved) {
		this.approved = approved;
	}

	public Boolean getApproved() {
		return approved;
	}	public void setLocked(Boolean locked) {
		this.locked = locked;
	}

	public Boolean getLocked() {
		return locked;
	}	public void setVisible(Boolean visible) {
		this.visible = visible;
	}

	public Boolean getVisible() {
		return visible;
	}	public Partner deepCopy() {
						Partner copy = new Partner();
				        copy.setId(this.id);
				        copy.setStringId(this.stringId);
				        copy.setPartnerName(this.partnerName);
				        copy.setPartnerLogo(this.partnerLogo);
				        copy.setLangCode(this.langCode);
				        copy.setCreatedTime(this.createdTime);
				        copy.setModifiedTime(this.modifiedTime);
				        copy.setApproved(this.approved);
				        copy.setLocked(this.locked);
				        copy.setVisible(this.visible);
	return copy;
	}} 
