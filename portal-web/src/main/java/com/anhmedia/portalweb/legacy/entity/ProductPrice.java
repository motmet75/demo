// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity; 
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import com.anhmedia.portalweb.legacy.Utilities; 

 @Entity
@Table(name = "productPriceTB")
@Access(value=AccessType.FIELD) 
public class  ProductPrice implements Serializable { 
 	private static final long serialVersionUID = 6142222615321332283L;

	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private Long id = (long)0 ; 
	@Column(name="priceName") 
	private String priceName = "none" ; 
	@Column(name="priceCode") 
	private String priceCode = "none" ; 
	@Column(name="productCode") 
	private String productCode = "none" ; 
	
	@Transient 
	private String productName = "none" ; 
	@Column(name="productCatalog") 
	private String productCatalog = "none" ; 
	@Column(name="productBrand") 
	private String productBrand = "none" ; 
	@Column(name="sizeCode") 
	private String sizeCode = "none" ; 
	@Column(name="colorCode") 
	private String colorCode = "none" ; 
	@Column(name="priceShortDes") 
	private String priceShortDes = "none" ; 
	@Column(name="priceAmount") 
	private BigDecimal  priceAmount = BigDecimal.ZERO; 
	
	@Column(name="priceDiscountPercentage") 
	private BigDecimal  priceDiscountPercentage = BigDecimal.ZERO; 
	
	@Column(name="priceImage") 
	private String priceImage = "none" ; 
	@Column(name="disCountAmount") 
	private BigDecimal  disCountAmount = BigDecimal.ZERO; 
	@Column(name="priceType") 
	private String priceType = "none" ; 
	@Column(name="language") 
	private String language = "vi" ; 
	@Column(name="path") 
	private String path = "none" ; 
	
	@Transient
	private String formatedPrice ="";
	
	@Transient
	private String beanStatus = "old";
	
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
	
	@Transient
	ProductColor selectedColor = new ProductColor();
	
	@Transient
	ProductSize selectedSize = new ProductSize();
	
	
	
	public ProductPrice(String colorValue) {
		setColorCode(colorValue);
	}
	
	public ProductPrice() {
	}

	public void setId(Long id) {
		this.id = id;
	}

	public Long getId() {
		return id;
	} 
 
	public void setPriceName(String priceName) {
		this.priceName = Utilities.ValidateInputValue(priceName);
	}

	public String getPriceName() {
		return  priceName==null?"":Utilities.GetBackStringValue(priceName);
	} 
 
	public void setPriceCode(String priceCode) {
		this.priceCode = Utilities.ValidateInputValue(priceCode);
	}

	public String getPriceCode() {
		return  priceCode==null?"":Utilities.GetBackStringValue(priceCode);
	} 
 
	public void setProductCode(String productCode) {
		this.productCode = Utilities.ValidateInputValue(productCode);
	}

	public String getProductCode() {
		return  productCode==null?"":Utilities.GetBackStringValue(productCode);
	} 
 
	public void setProductCatalog(String productCatalog) {
		this.productCatalog = Utilities.ValidateInputValue(productCatalog);
	}

	public String getProductCatalog() {
		return  productCatalog==null?"":Utilities.GetBackStringValue(productCatalog);
	} 
 
	public void setProductBrand(String productBrand) {
		this.productBrand = Utilities.ValidateInputValue(productBrand);
	}

	public String getProductBrand() {
		return  productBrand==null?"":Utilities.GetBackStringValue(productBrand);
	} 
 
	public void setSizeCode(String sizeCode) {
		this.sizeCode = Utilities.ValidateInputValue(sizeCode);
	}

	public String getSizeCode() {
		return  sizeCode==null?"":Utilities.GetBackStringValue(sizeCode);
	} 
 
	public void setColorCode(String colorCode) {
		this.colorCode = Utilities.ValidateInputValue(colorCode);
	}

	public String getColorCode() {
		return  colorCode==null?"":Utilities.GetBackStringValue(colorCode);
	} 
 
	public void setPriceShortDes(String priceShortDes) {
		this.priceShortDes = Utilities.ValidateInputValue(priceShortDes);
	}

	public String getPriceShortDes() {
		return  priceShortDes==null?"":Utilities.GetBackStringValue(priceShortDes);
	} 
 
	public void setPriceAmount(BigDecimal  priceAmount) {
		this.priceAmount = priceAmount;
	}

	public BigDecimal  getPriceAmount() {
		return priceAmount;
	} 
	
	public void setPriceDiscountPercentage(BigDecimal  priceDiscountPercentage) {
		this.priceDiscountPercentage = priceDiscountPercentage;
	}
	
	public BigDecimal  getPriceDiscountPercentage() {
		return priceDiscountPercentage;
	} 
 
	public void setDisCountAmount(BigDecimal  disCountAmount) {
		this.disCountAmount = disCountAmount;
	}

	public BigDecimal  getDisCountAmount() {
		return disCountAmount;
	} 
 
	public void setPriceType(String priceType) {
		this.priceType = Utilities.ValidateInputValue(priceType);
	}

	public String getPriceType() {
		return  priceType==null?"":Utilities.GetBackStringValue(priceType);
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
 
	public String getPriceImage() {
		return priceImage==null?"":Utilities.GetBackStringValue(priceImage);
	}

	public void setPriceImage(String priceImage) {
		this.priceImage =  Utilities.ValidateInputValue(priceImage);
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
 
	public void isApproved(Boolean  approved) {
		this.approved = approved;
	}

	public Boolean getApproved() {
		return approved;
	}	public void isLocked(Boolean  locked) {
		this.locked = locked;
	}

	public Boolean getLocked() {
		return locked;
	}	public void isVisible(Boolean  visible) {
		this.visible = visible;
	}

	public Boolean getVisible() {
		return visible;
	}	
	
	public String getProductName() {
		if(product!=null) {
			return product.getProductName();
		}else {
			return productName;
		}
	}

	public void setProductName(String productName) {
		this.productName = productName;
	}

	public String getFormatedPrice() {
		return Utilities.doubleToStringCurrency(priceAmount, tenantId, language);
	}
	
	
	// JOIN to Product using productCode
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "productCode", referencedColumnName = "productCode", insertable = false, updatable = false)
    private Product product;
    
	@Transient
	private String tenantId = "";
	

	public void setFormatedPrice(String formatedPrice) {
		this.formatedPrice =  Utilities.ValidateInputValue(formatedPrice);
	}

	public String getTenantId() {
		return tenantId;
	}

	public void setTenantId(String tenantId) {
		this.tenantId = tenantId;
	}

	public ProductColor getSelectedColor() {
		return selectedColor;
	}

	public ProductSize getSelectedSize() {
		return selectedSize;
	}

	public void setSelectedColor(ProductColor selectedColor) {
		this.selectedColor = selectedColor;
	}

	public void setSelectedSize(ProductSize selectedSize) {
		this.selectedSize = selectedSize;
	}

	public String getBeanStatus() {
		return beanStatus;
	}

	public void setBeanStatus(String beanStatus) {
		this.beanStatus = beanStatus;
	}

	public ProductPrice deepCopy() {
						ProductPrice copy = new ProductPrice();
				        copy.setId(this.id);
				        copy.setPriceName(this.priceName);
				        copy.setPriceCode(this.priceCode);
				        copy.setProductCode(this.productCode);
				        copy.setProductName(this.productName);
				        copy.setProductCatalog(this.productCatalog);
				        copy.setProductBrand(this.productBrand);
				        copy.setSizeCode(this.sizeCode);
				        copy.setColorCode(this.colorCode);
				        copy.setPriceShortDes(this.priceShortDes);
				        copy.setPriceAmount(this.priceAmount);
				        copy.setPriceDiscountPercentage(this.priceDiscountPercentage);
				        copy.setPriceImage(this.priceImage);;
				        copy.setDisCountAmount(this.disCountAmount);
				        copy.setPriceType(this.priceType);
				        copy.setLanguage(this.language);
				        copy.setPath(this.path);
				        copy.setCreatedTime(this.createdTime);
				        copy.setModifiedTime(this.modifiedTime);
				        copy.isApproved(this.approved);
				        copy.isLocked(this.locked);
				        copy.isVisible(this.visible);
	return copy;
	}} 
