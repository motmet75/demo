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
@Table(name = "ProductHtmlTb")
@Access(value=AccessType.FIELD) 
public class  ProductHtml { 
 	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private Long id = (long) 0.0 ; 
	@Column(name="stringId") 
	private String  stringId = String.valueOf(System.currentTimeMillis()); ; 
	@Column(name="productHtmlCode") 
	private String  productHtmlCode = "p" ; 
	@Column(name="productCode") 
	private String  productCode = "none" ; 
	@Column(name="productHtmlUsingId") 
	private String  productHtmlUsingId = "none" ; 
	@Column(name="index") 
	private String  index = "active-none" ; 
	@Column(name="productHtmlGroup") 
	private String  productHtmlGroup = "rightofgallery" ; 
	@Column(name="productHtmlDescription") 
	private String  productHtmlDescription = "none" ; 
	@Column(name="productHtmlContent") 
	private String  productHtmlContent = "Content" ; 
	@Column(name="langCode") 
	private String  langCode = "vi" ; 
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
 
	public void setProductHtmlCode(String productHtmlCode) {
		this.productHtmlCode = Utilities.ValidateInputValue(productHtmlCode);
	}

	public String getProductHtmlCode() {
		return  productHtmlCode==null?"":Utilities.GetBackStringValue(productHtmlCode);
	} 
 
	public void setProductCode(String productCode) {
		this.productCode = Utilities.ValidateInputValue(productCode);
	}

	public String getProductCode() {
		return  productCode==null?"":Utilities.GetBackStringValue(productCode);
	} 
 
	public void setProductHtmlUsingId(String productHtmlUsingId) {
		this.productHtmlUsingId = Utilities.ValidateInputValue(productHtmlUsingId);
	}

	public String getProductHtmlUsingId() {
		return  productHtmlUsingId==null?"":Utilities.GetBackStringValue(productHtmlUsingId);
	} 
 
	public void setIndex(String index) {
		this.index = Utilities.ValidateInputValue(index);
	}

	public String getIndex() {
		return  index==null?"":Utilities.GetBackStringValue(index);
	} 
 
	public void setProductHtmlGroup(String productHtmlGroup) {
		this.productHtmlGroup = Utilities.ValidateInputValue(productHtmlGroup);
	}

	public String getProductHtmlGroup() {
		return  productHtmlGroup==null?"":Utilities.GetBackStringValue(productHtmlGroup);
	} 
 
	public void setProductHtmlDescription(String productHtmlDescription) {
		this.productHtmlDescription = Utilities.ValidateInputValue(productHtmlDescription);
	}

	public String getProductHtmlDescription() {
		return  productHtmlDescription==null?"":Utilities.GetBackStringValue(productHtmlDescription);
	} 
 
	public void setProductHtmlContent(String productHtmlContent) {
		this.productHtmlContent = Utilities.ValidateInputValue(productHtmlContent);
	}

	public String getProductHtmlContent() {
		return  productHtmlContent==null?"":Utilities.GetBackStringValue(productHtmlContent);
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
	}	public ProductHtml deepCopy() {
						ProductHtml copy = new ProductHtml();
				        copy.setId(this.id);
				        copy.setStringId(this.stringId);
				        copy.setProductHtmlCode(this.productHtmlCode);
				        copy.setProductCode(this.productCode);
				        copy.setProductHtmlUsingId(this.productHtmlUsingId);
				        copy.setIndex(this.index);
				        copy.setProductHtmlGroup(this.productHtmlGroup);
				        copy.setProductHtmlDescription(this.productHtmlDescription);
				        copy.setProductHtmlContent(this.productHtmlContent);
				        copy.setLangCode(this.langCode);
				        copy.setCreatedTime(this.createdTime);
				        copy.setModifiedTime(this.modifiedTime);
				        copy.setApproved(this.approved);
				        copy.setLocked(this.locked);
				        copy.setVisible(this.visible);
	return copy;
	}} 
