// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity; 

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

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
@Table(name = "productCatalogTB")
@Access(value=AccessType.FIELD) 
public class  ProductCatalog { 

 	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private Long id = (long)0 ;
 	
 	@Column(name="catalogIndex") 
 	private long catalogIndex = 32000 ; 

	public long getCatalogIndex() {
		return catalogIndex;
	}

	public void setCatalogIndex(long catalogIndex) {
		this.catalogIndex = catalogIndex;
	}

	@Column(name="catalogName") 
	private String catalogName = "none" ;

	@Column(name="catalogCode") 
	private String catalogCode = "none" ;

	@Column(name="catalogShortDes") 
	private String catalogShortDes = "none" ;

	@Column(name="catalogLongDes") 
	private String catalogLongDes = "none" ;

	@Column(name="catalogImageUrl1") 
	private String catalogImageUrl1 = "none" ;

	@Column(name="catalogImageDesUrl") 
	private String catalogImageDesUrl = "none" ;

	@Column(name="catalogVideoAdd") 
	private String catalogVideoAdd = "none" ;

	@Column(name="language") 
	private String language = "vi" ;

	@Column(name="path") 
	private String path = "none" ;
	
	@Transient
	private String htmlClassString="none";
	
	public String getHtmlClassString() {
		return htmlClassString;
	}

	public void setHtmlClassString(String htmlClassString) {
		this.htmlClassString = htmlClassString;
	}

	@Transient
	List<Product> products = new ArrayList<Product>();
	
	@Transient
	List<String> images = new ArrayList<String>();

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
 
	public void setCatalogName(String catalogName) {
		this.catalogName = Utilities.ValidateInputValue(catalogName);
	}

	public String getCatalogName() {
		return  catalogName==null?"":Utilities.GetBackStringValue(catalogName);
	} 
 
	public void setCatalogCode(String catalogCode) {
		this.catalogCode = Utilities.ValidateInputValue(catalogCode);
	}

	public String getCatalogCode() {
		return  catalogCode==null?"":Utilities.GetBackStringValue(catalogCode);
	} 
 
	public void setCatalogShortDes(String catalogShortDes) {
		this.catalogShortDes = Utilities.ValidateInputValue(catalogShortDes);
	}

	public String getCatalogShortDes() {
		return  catalogShortDes==null?"":Utilities.GetBackStringValue(catalogShortDes);
	} 
 
	public void setCatalogLongDes(String catalogLongDes) {
		this.catalogLongDes = Utilities.ValidateInputValue(catalogLongDes);
	}

	public String getCatalogLongDes() {
		return  catalogLongDes==null?"":Utilities.GetBackStringValue(catalogLongDes);
	} 
 
	public void setCatalogImageUrl1(String catalogImageUrl1) {
		this.catalogImageUrl1 = Utilities.ValidateInputValue(catalogImageUrl1);
	}

	public String getCatalogImageUrl1() {
		return  catalogImageUrl1==null?"":Utilities.GetBackStringValue(catalogImageUrl1);
	} 
 
	public void setCatalogImageDesUrl(String catalogImageDesUrl) {
		this.catalogImageDesUrl = Utilities.ValidateInputValue(catalogImageDesUrl);
		//if(!catalogImageDesUrl.isEmpty()) {
			images = Arrays.asList( catalogImageDesUrl.split("\n"));
		//}
	
	}

	public String getCatalogImageDesUrl() {
		return  catalogImageDesUrl==null?"":Utilities.GetBackStringValue(catalogImageDesUrl);
	} 
 
	public void setCatalogVideoAdd(String catalogVideoAdd) {
		this.catalogVideoAdd = Utilities.ValidateInputValue(catalogVideoAdd);
	}

	public String getCatalogVideoAdd() {
		return  catalogVideoAdd==null?"":Utilities.GetBackStringValue(catalogVideoAdd);
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
	}	
	
	
	public void isLocked(boolean locked) {
		this.locked = locked;
	}

	public boolean getLocked() {
		return locked;
	}	public void isVisible(boolean visible) {
		this.visible = visible;
	}

	public boolean getVisible() {
		return visible;
	}	public List<Product> getProducts() {
		return products;
	}

	public void setProducts(List<Product> products) {
		this.products = products;
	}

	public List<String> getImages() {
		return images;
	}

	public void setImages(List<String> images) {
		this.images = images;
	}

	public ProductCatalog deepCopy() {
						ProductCatalog copy = new ProductCatalog();
				        copy.setId(this.id);
				        copy.setCatalogName(this.catalogName);
				        copy.setCatalogCode(this.catalogCode);
				        copy.setCatalogShortDes(this.catalogShortDes);
				        copy.setCatalogLongDes(this.catalogLongDes);
				        copy.setCatalogImageUrl1(this.catalogImageUrl1);
				        copy.setCatalogImageDesUrl(this.catalogImageDesUrl);
				        copy.setCatalogVideoAdd(this.catalogVideoAdd);
				        copy.setLanguage(this.language);
				        copy.setPath(this.path);
				        copy.setCreatedTime(this.createdTime);
				        copy.setModifiedTime(this.modifiedTime);
				        copy.isApproved(this.approved);
				        copy.isLocked(this.locked);
				        copy.isVisible(this.visible);
				        copy.setProducts(products);
				        copy.setImages(images);
	return copy;
	}} 

