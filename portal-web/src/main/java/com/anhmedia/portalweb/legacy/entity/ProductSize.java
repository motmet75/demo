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
@Table(name = "productSizeTB")
@Access(value=AccessType.FIELD) 
public class  ProductSize implements Serializable  { 
 	private static final long serialVersionUID = 1403640017073088645L;

	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private long id = 0 ; 
	@Column(name="sizeName") 
	private String sizeName = "none" ; 
	@Column(name="sizeCode") 
	private String sizeCode = "none" ; 
	@Column(name="productCode") 
	private String productCode = "none" ; 
	@Column(name="sizeShortDes") 
	private String sizeShortDes = "none" ; 
	@Column(name="sizeLongDes") 
	private String sizeLongDes = "none" ; 
	@Column(name="sizeImageUrl1") 
	private String sizeImageUrl1 = "none" ; 
	@Column(name="sizeImageDesUrl") 
	private String sizeImageDesUrl = "none" ; 
	@Column(name="sizeVideoAdd") 
	private String sizeVideoAdd = "none" ; 
	@Column(name="language") 
	private String language = "none" ; 
	@Column(name="path") 
	private String path = "none" ; 
	@Column(name="createdTime") 
	private LocalDateTime createdTime = LocalDateTime.now() ; 
	@Column(name="modifiedTime") 
	private LocalDateTime modifiedTime = LocalDateTime.now() ; 
	@Column(name="isApproved") 
	private boolean approved = true ; 
	@Column(name="isLocked") 
	private boolean locked = false ; 
	@Column(name="isVisible") 
	private boolean visible = true ; 
	
	@Transient
	private String display = "none";
	public String getDisplay() {
		return display;
	}

	public void setDisplay(String display) {
		this.display = display;
	}

	public void setId(long id) {
		this.id = id;
	}

	public long getId() {
		return id;
	} 
 
	public void setSizeName(String sizeName) {
		this.sizeName = Utilities.ValidateInputValue(sizeName);
	}

	public String getSizeName() {
		return  sizeName==null?"":Utilities.GetBackStringValue(sizeName);
	} 
 
	public void setSizeCode(String sizeCode) {
		this.sizeCode = Utilities.ValidateInputValue(sizeCode);
	}

	public String getSizeCode() {
		return  sizeCode==null?"":Utilities.GetBackStringValue(sizeCode);
	} 
 
	public void setProductCode(String productCode) {
		this.productCode = Utilities.ValidateInputValue(productCode);
	}

	public String getProductCode() {
		return  productCode==null?"":Utilities.GetBackStringValue(productCode);
	} 
 
	public void setSizeShortDes(String sizeShortDes) {
		this.sizeShortDes = Utilities.ValidateInputValue(sizeShortDes);
	}

	public String getSizeShortDes() {
		return  sizeShortDes==null?"":Utilities.GetBackStringValue(sizeShortDes);
	} 
 
	public void setSizeLongDes(String sizeLongDes) {
		this.sizeLongDes = Utilities.ValidateInputValue(sizeLongDes);
	}

	public String getSizeLongDes() {
		return  sizeLongDes==null?"":Utilities.GetBackStringValue(sizeLongDes);
	} 
 
	public void setSizeImageUrl1(String sizeImageUrl1) {
		this.sizeImageUrl1 = Utilities.ValidateInputValue(sizeImageUrl1);
	}

	public String getSizeImageUrl1() {
		return  sizeImageUrl1==null?"":Utilities.GetBackStringValue(sizeImageUrl1);
	} 
 
	public void setSizeImageDesUrl(String sizeImageDesUrl) {
		this.sizeImageDesUrl = Utilities.ValidateInputValue(sizeImageDesUrl);
	}

	public String getSizeImageDesUrl() {
		return  sizeImageDesUrl==null?"":Utilities.GetBackStringValue(sizeImageDesUrl);
	} 
 
	public void setSizeVideoAdd(String sizeVideoAdd) {
		this.sizeVideoAdd = Utilities.ValidateInputValue(sizeVideoAdd);
	}

	public String getSizeVideoAdd() {
		return  sizeVideoAdd==null?"":Utilities.GetBackStringValue(sizeVideoAdd);
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
	}	public ProductSize deepCopy() {
						ProductSize copy = new ProductSize();
				        copy.setId(this.id);
				        copy.setSizeName(this.sizeName);
				        copy.setSizeCode(this.sizeCode);
				        copy.setProductCode(this.productCode);
				        copy.setSizeShortDes(this.sizeShortDes);
				        copy.setSizeLongDes(this.sizeLongDes);
				        copy.setSizeImageUrl1(this.sizeImageUrl1);
				        copy.setSizeImageDesUrl(this.sizeImageDesUrl);
				        copy.setSizeVideoAdd(this.sizeVideoAdd);
				        copy.setLanguage(this.language);
				        copy.setPath(this.path);
				        copy.setCreatedTime(this.createdTime);
				        copy.setModifiedTime(this.modifiedTime);
				        copy.isApproved(this.approved);
				        copy.isLocked(this.locked);
				        copy.isVisible(this.visible);
	return copy;
	}} 
