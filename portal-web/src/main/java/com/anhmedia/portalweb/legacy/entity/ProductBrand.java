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
@Table(name = "productBrandTB")
@Access(value=AccessType.FIELD) 
public class  ProductBrand { 

 	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private Long id = (long)0 ;

	@Column(name="brandName") 
	private String brandName = "none" ; 

	@Column(name="brandCode") 
	private String brandCode = "none" ; 

	@Column(name="brandShortDes") 
	private String brandShortDes = "none" ; 

	@Column(name="brandLongDes") 
	private String brandLongDes = "none" ; 

	@Column(name="brandImageUrl1") 
	private String brandImageUrl1 = "none" ; 

	@Column(name="brandImageDesUrl") 
	private String brandImageDesUrl = "none" ; 

	@Column(name="brandVideoAdd") 
	private String brandVideoAdd = "none" ; 

	@Column(name="language") 
	private String language = "vi" ; 

	@Column(name="path") 
	private String path = "none" ; 

	@Column(name="createdTime") 
	private LocalDateTime createdTime = LocalDateTime.now() ; 

	@Column(name="modifiedTime") 
	private LocalDateTime modifiedTime = LocalDateTime.now() ; 

	@Column(name="isApproved") 
	private boolean approved = true ; 

	@Column(name="isLocked") 
	private boolean locked = true ; 

	@Column(name="isVisible") 
	private boolean visible = true ; 

	public void setId(long id) {
		this.id = id;
	}

	public long getId() {
		return id;
	} 
 
	public void setBrandName(String brandName) {
		this.brandName = Utilities.ValidateInputValue(brandName);
	}

	public String getBrandName() {
		return  brandName==null?"":Utilities.GetBackStringValue(brandName);
	} 
 
	public void setBrandCode(String brandCode) {
		this.brandCode = Utilities.ValidateInputValue(brandCode);
	}

	public String getBrandCode() {
		return  brandCode==null?"":Utilities.GetBackStringValue(brandCode);
	} 
 
	public void setBrandShortDes(String brandShortDes) {
		this.brandShortDes = Utilities.ValidateInputValue(brandShortDes);
	}

	public String getBrandShortDes() {
		return  brandShortDes==null?"":Utilities.GetBackStringValue(brandShortDes);
	} 
 
	public void setBrandLongDes(String brandLongDes) {
		this.brandLongDes = Utilities.ValidateInputValue(brandLongDes);
	}

	public String getBrandLongDes() {
		return  brandLongDes==null?"":Utilities.GetBackStringValue(brandLongDes);
	} 
 
	public void setBrandImageUrl1(String brandImageUrl1) {
		this.brandImageUrl1 = Utilities.ValidateInputValue(brandImageUrl1);
	}

	public String getBrandImageUrl1() {
		return  brandImageUrl1==null?"":Utilities.GetBackStringValue(brandImageUrl1);
	} 
 
	public void setBrandImageDesUrl(String brandImageDesUrl) {
		this.brandImageDesUrl = Utilities.ValidateInputValue(brandImageDesUrl);
	}

	public String getBrandImageDesUrl() {
		return  brandImageDesUrl==null?"":Utilities.GetBackStringValue(brandImageDesUrl);
	} 
 
	public void setBrandVideoAdd(String brandVideoAdd) {
		this.brandVideoAdd = Utilities.ValidateInputValue(brandVideoAdd);
	}

	public String getBrandVideoAdd() {
		return  brandVideoAdd==null?"":Utilities.GetBackStringValue(brandVideoAdd);
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

	public boolean getApproved() {
		return approved;
	}	public void isLocked(boolean locked) {
		this.locked = locked;
	}

	public boolean getLocked() {
		return locked;
	}	public void isVisible(boolean visible) {
		this.visible = visible;
	}

	public boolean getVisible() {
		return visible;
	}	public ProductBrand deepCopy() {
						ProductBrand copy = new ProductBrand();
				        copy.setId(this.id);
				        copy.setBrandName(this.brandName);
				        copy.setBrandCode(this.brandCode);
				        copy.setBrandShortDes(this.brandShortDes);
				        copy.setBrandLongDes(this.brandLongDes);
				        copy.setBrandImageUrl1(this.brandImageUrl1);
				        copy.setBrandImageDesUrl(this.brandImageDesUrl);
				        copy.setBrandVideoAdd(this.brandVideoAdd);
				        copy.setLanguage(this.language);
				        copy.setPath(this.path);
				        copy.setCreatedTime(this.createdTime);
				        copy.setModifiedTime(this.modifiedTime);
				        copy.isApproved(this.approved);
				        copy.isLocked(this.locked);
				        copy.isVisible(this.visible);
	return copy;
	}} 

