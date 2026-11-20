// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity; 
import java.io.Serializable;
import java.time.LocalDateTime;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import com.anhmedia.portalweb.legacy.Utilities; 

 @Entity
@Table(name = "productColorTB")
@Access(value=AccessType.FIELD) 
public class  ProductColor implements Serializable { 
 	private static final long serialVersionUID = 5023056730920470950L;

	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private long id = 0 ; 
	@Column(name="colorName") 
	private String colorName = "none" ; 
	@Column(name="colorCode") 
	private String colorCode = "none" ; 
	@Column(name="productCode") 
	private String productCode = "none" ; 
	@Column(name="colorShortDes") 
	private String colorShortDes = "none" ; 
	@Column(name="colorLongDes") 
	private String colorLongDes = "none" ; 
	@Column(name="colorImageUrl1") 
	private String colorImageUrl1 = "none" ; 
	@Column(name="colorImageDesUrl") 
	private String colorImageDesUrl = "none" ; 
	@Column(name="colorVideoAdd") 
	private String colorVideoAdd = "none" ; 
	@Column(name="language") 
	private String language = "vi" ; 
	@Column(name="path") 
	private String path = "none" ; 
	
	@Transient
	private String colorImageDesUrlThumbnail = "none" ; 
	
	@Transient
	private String tenantId = "none" ; 
	
	public String getTenantId() {
		return tenantId;
	}

	public void setTenantId(String tenantId) {
		this.tenantId = tenantId;
	}

	public String getColorImageDesUrlThumbnail() {
		return colorImageDesUrlThumbnail;
	}

	public void setColorImageDesUrlThumbnail(String colorImageDesUrlThumbnail) {
		this.colorImageDesUrlThumbnail = colorImageDesUrlThumbnail;
	}

	@Transient
	private String display = "none";
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
	public void setId(long id) {
		this.id = id;
	}

	public long getId() {
		return id;
	} 
 
	public void setColorName(String colorName) {
		this.colorName = Utilities.ValidateInputValue(colorName);
	}

	public String getColorName() {
		return  colorName==null?"":Utilities.GetBackStringValue(colorName);
	} 
 
	public void setColorCode(String colorCode) {
		this.colorCode = Utilities.ValidateInputValue(colorCode);
	}

	public String getColorCode() {
		return  colorCode==null?"":Utilities.GetBackStringValue(colorCode);
	} 
 
	public void setProductCode(String productCode) {
		this.productCode = Utilities.ValidateInputValue(productCode);
	}

	public String getProductCode() {
		return  productCode==null?"":Utilities.GetBackStringValue(productCode);
	} 
 
	public void setColorShortDes(String colorShortDes) {
		this.colorShortDes = Utilities.ValidateInputValue(colorShortDes);
	}

	public String getColorShortDes() {
		return  colorShortDes==null?"":Utilities.GetBackStringValue(colorShortDes);
	} 
 
	public void setColorLongDes(String colorLongDes) {
		this.colorLongDes = Utilities.ValidateInputValue(colorLongDes);
	}

	public String getColorLongDes() {
		return  colorLongDes==null?"":Utilities.GetBackStringValue(colorLongDes);
	} 
 
	public void setColorImageUrl1(String colorImageUrl1) {
		this.colorImageUrl1 = Utilities.ValidateInputValue(colorImageUrl1);
	}

	public String getColorImageUrl1() {
		return  colorImageUrl1==null?"":Utilities.GetBackStringValue(colorImageUrl1);
	} 
 
	public void setColorImageDesUrl(String colorImageDesUrl) {
		this.colorImageDesUrl = Utilities.ValidateInputValue(colorImageDesUrl);
	}

	public String getColorImageDesUrl() {
		return  colorImageDesUrl==null?"":Utilities.GetBackStringValue(colorImageDesUrl);
	} 
 
	public void setColorVideoAdd(String colorVideoAdd) {
		this.colorVideoAdd = Utilities.ValidateInputValue(colorVideoAdd);
	}

	public String getColorVideoAdd() {
		return  colorVideoAdd==null?"":Utilities.GetBackStringValue(colorVideoAdd);
	} 
 
	public void setLanguage(String language) {
		this.language = Utilities.ValidateInputValue(language);
	}

	public String getLanguage() {
		return  language==null?"":Utilities.GetBackStringValue(language);
	} 
 
	public void setPath(String path) {
		this.path = Utilities.ValidateInputValue(path);
	}

	public String getPath() {
		return  path==null?"":Utilities.GetBackStringValue(path);
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
 
	public void isApproved(boolean approved) {
		this.approved = approved;
	}

	public Boolean getApproved() {
		return approved;
	}	public void isLocked(boolean locked) {
		this.locked = locked;
	}

	public Boolean getLocked() {
		return locked;
	}	public void isVisible(boolean visible) {
		this.visible = visible;
	}

	public Boolean getVisible() {
		return visible;
	}	
	

	public String getDisplay() {
		return display;
	}

	public void setDisplay(String display) {
		this.display = display;
	}

	public ProductColor deepCopy() {
						ProductColor copy = new ProductColor();
				        copy.setId(this.id);
				        copy.setColorName(this.colorName);
				        copy.setColorCode(this.colorCode);
				        copy.setProductCode(this.productCode);
				        copy.setColorShortDes(this.colorShortDes);
				        copy.setColorLongDes(this.colorLongDes);
				        copy.setColorImageUrl1(this.colorImageUrl1);
				        copy.setColorImageDesUrl(this.colorImageDesUrl);
				        copy.setColorVideoAdd(this.colorVideoAdd);
				        copy.setLanguage(this.language);
				        copy.setPath(this.path);
				        copy.setCreatedTime(this.createdTime);
				        copy.setModifiedTime(this.modifiedTime);
				        copy.isApproved(this.approved);
				        copy.isLocked(this.locked);
				        copy.isVisible(this.visible);
	return copy;
	}} 
