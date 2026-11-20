// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity; 

import java.io.Serializable;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedList;
import java.util.List;

import jakarta.persistence.Access;
import jakarta.persistence.AccessType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import com.fasterxml.jackson.annotation.JsonIgnore;

import com.anhmedia.portalweb.legacy.Utilities; 

@Entity
@Table(name = "ProductTB")
@Access(value=AccessType.FIELD) 
public class  Product implements Serializable  { 

 	private static final long serialVersionUID = -8428221211100024215L;

	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private Long id = (long)0.0 ; 

	@Column(name="productName") 
	private String productName = "none" ; 

	@Column(name="productCode", nullable = false, unique = true) 
	private String productCode = "none" ; 

	@Column(name="productCatalog") 
	private String productCatalog = "none" ; 
	
	@Column(name="productBrand") 
	private String productBrand = "none" ; 

	@Column(name="productShortDes") 
	private String productShortDes = "none" ; 

	@Column(name="productLongDes") 
	private String productLongDes = "none" ; 

	@Column(name="productImageUrl1") 
	private String productImageUrl1 = "none" ; 
	
	@Column(name="productSubCatalog") 
	private String productSubCatalog = "none" ; 
	
	@Column(name="productGroupString") 
	private String productGroupString = "none" ; 
	
	@Column(name="pageKeyword") 
	private String pageKeyword = "none" ; 
	
	@Transient
	private List<String> imageList = new ArrayList<>() ; 
	
	@Transient
	private List<ImageGalary> imageGalaryList = new ArrayList<>() ; 
	@Transient
	private List<ImageGalary> imageGalaryListThumbnail = new ArrayList<>() ; 
	
	public List<ImageGalary> getImageGalaryListThumbnail() {
		return imageGalaryListThumbnail;
	}

	public void setImageGalaryListThumbnail(List<ImageGalary> imageGalaryListThumbnail) {
		this.imageGalaryListThumbnail = imageGalaryListThumbnail;
	}

	@JsonIgnore
	@Transient
    private ProductCatalog productCategory = new ProductCatalog();

	@JsonIgnore
	@Transient
    private ProductBrand productBrandEntity = new ProductBrand();
	
	@JsonIgnore
	@Transient
	private List<ProductColor> colorList = new ArrayList<>();
	
	@JsonIgnore
	@Transient
	private List<ProductSize> sizeList = new ArrayList<>();
	
	@JsonIgnore
	//@OneToMany(mappedBy = "product")
	@Transient
	private List<ProductPrice> priceList = new ArrayList<>();
	
	@JsonIgnore
	@Transient
	private ProductPrice seletedPrice = new ProductPrice();

	@JsonIgnore
	@Column(name="productImageUrl2") 
	private String productImageUrl2 = "none" ; 

	@Column(name="productImageDesUrl") 
	private String productImageDesUrl = "none" ; 

	@Column(name="productVideoAdd") 
	private String productVideoAdd = "none" ;

	@Column(name="youtubeVideoURL", length = 2048)
	private String youtubeVideoURL = "none";

	@Column(name="productVideoType")
	private String productVideoType = "Unknown";

	@Column(name="productPriceAmount") 
	private BigDecimal productPriceAmount = BigDecimal.ZERO; 
	

	@Column(name="productDiscont") 
	private BigDecimal productDiscount = BigDecimal.ZERO; 

	@Column(name="productPriceCurrency") 
	private String productPriceCurrency = "VND" ; 

	@Column(name="productStockQty")
	private BigDecimal productStockQty = BigDecimal.ZERO;
	
	@Transient
	private String formatedPriceAmout = "" ; 
	
	@Transient
	private String formatedPriceAmoutMajor = "" ; 
	
	@Transient
	private String formatedPriceAmoutMinor = "" ; 
	
	@Transient
	private String formatedPriceAmoutHidden = "" ; 
	
	@Transient
	private String formatedProductDiscount = "" ; 
	
	@Transient
	private String formatedProductDiscountHidden = "" ; 
	
	@Transient
	private String newProductString = "" ; 
	
	@Transient
	private String newProductStringHidden = "" ; 
	
	@Transient
	private String formatedPriceAfterDiscount = "" ; 
	
	@Transient
	private String formatedPriceAfterDiscountMajor = "" ; 
	
	@Transient
	private String formatedPriceAfterDiscountMinor = "" ; 

	@Column(name="language") 
	private String language = "vi" ; 
	
	@Transient
	private String tenantId = "" ; 

	@Column(name="path") 
	private String path = "none" ; 
	
	
	@Column(name="createdTime") 
	private LocalDateTime createdTime = LocalDateTime.now() ; 
	
	@Column(name="publishedTime") 
	private LocalDateTime publishedTime = LocalDateTime.now() ;

	@Column(name="lastPostTime")
	private LocalDateTime lastPostTime = null ;

	@Column(name="tiktokPostCount")
	private Integer tiktokPostCount = 0 ;

	@Column(name="youtubePostCount")
	private Integer youtubePostCount = 0 ;

	@Column(name="facebookPostCount")
	private Integer facebookPostCount = 0 ;

	@Column(name="lastPostTimeTiktok")
	private LocalDateTime lastPostTimeTiktok = null ;

	@Column(name="lastPostTimeYoutube")
	private LocalDateTime lastPostTimeYoutube = null ;

	@Column(name="lastPostTimeYoutubeShort")
	private LocalDateTime lastPostTimeYoutubeShort = null ;

	@Column(name="lastPostTimeFacebook")
	private LocalDateTime lastPostTimeFacebook = null ;

	@Column(name="youtubeShortPostCount")
	private Integer youtubeShortPostCount = 0 ;

	@Column(name="modifiedTime") 
	private LocalDateTime modifiedTime = LocalDateTime.now() ; 
	
	@Column(name = "publicPrice", nullable = false)
	private Boolean publicPrice = false;

	@Column(name = "isVisible")
	private Boolean   visible = true;

	@Column(name = "isApproved")
	private Boolean   approved = false;

	@Column(name = "isLocked")
	private Boolean   locked = false;
	
	@Column(name = "isNew")
	private Boolean   newProduct = false;

	public void setId(long id) {
		this.id = id;
	}

	public long getId() {
		return id;
	} 
 
	public void setProductName(String productName) {
		this.productName = Utilities.ValidateInputValue(productName);
	}

	public String getProductName() {
	
		return  productName==null?"":productName;
	} 
 
	public void setProductCode(String productCode) {
		this.productCode = Utilities.ValidateInputValue(productCode);
	}

	public String getProductCode() {
		return  productCode==null?"":productCode;
	} 
 
	public void setProductCatalog(String productCatalog) {
		this.productCatalog = Utilities.ValidateInputValue(productCatalog);
	}

	public String getProductCatalog() {
		return  productCatalog==null?"":productCatalog;
	} 
 
	public void setProductShortDes(String productShortDes) {
		if(Utilities.ValidateInputValue(productShortDes).length()>0) {
			this.productShortDes = Utilities.ValidateInputValue(productShortDes);
		}
	}

	public String getProductShortDes() {
		return  productShortDes==null?"":productShortDes;
	} 
 
	public void setProductLongDes(String productLongDes) {
		this.productLongDes = Utilities.ValidateInputValue(productLongDes);
	}

	public String getProductLongDes() {
		return  productLongDes==null?"":productLongDes;
	} 
 
	public void setProductImageUrl1(String productImageUrl1) {
		List<String> normalizedImages = normalizeProductImageLines(productImageUrl1);
		if(normalizedImages.size()>0) {
			this.productImageUrl1 = String.join("\n", normalizedImages);
			rebuildProductImageGalleries(normalizedImages);
		}
	}

	private List<String> normalizeProductImageLines(String productImageUrl1) {
		List<String> normalizedImages = new ArrayList<>();
		for (String rawImage : Utilities.ValidateInputValue(productImageUrl1).split("\\R")) {
			String normalizedImage = normalizeProductImageUrl(rawImage);
			if(!normalizedImage.isEmpty() && !normalizedImages.contains(normalizedImage)) {
				normalizedImages.add(normalizedImage);
			}
		}
		return normalizedImages;
	}

	private String normalizeProductImageUrl(String imageUrl) {
		String normalizedImage = Utilities.ValidateInputValue(imageUrl).trim();
		if(normalizedImage.isEmpty() || normalizedImage.equalsIgnoreCase("null") || normalizedImage.equalsIgnoreCase("none")) {
			return "";
		}
		return Utilities.appendResolutionToFilename(normalizedImage, "").trim();
	}

	private void rebuildProductImageGalleries(List<String> normalizedImages) {
		imageList = new ArrayList<>(normalizedImages);
		imageGalaryList  = new ArrayList<>();
		imageGalaryListThumbnail  = new ArrayList<>();
		for (int i = 0; i < imageList.size(); i++) {
			String img = imageList.get(i);
			if(Utilities.returnTenants(tenantId, img)) {
				ImageGalary iGalary = new ImageGalary(i, Utilities.appendResolutionToFilename(img, "_rslt_300x300"),"");
				ImageGalary iGalaryThumnails = new ImageGalary(i, Utilities.appendResolutionToFilename(img, "_rslt_64x64"),"");
				imageGalaryList.add(iGalary);
				imageGalaryListThumbnail.add(iGalaryThumnails);
			}else {
				ImageGalary iGalary = new ImageGalary(i, img,"");
				imageGalaryList.add(iGalary);
				imageGalaryListThumbnail.add(iGalary);
			}
		}
		if(imageGalaryList.size()>0) {
			imageGalaryList.get(0).setActive("active");
		}
	}

	public String getProductImageUrl1() {
		return  productImageUrl1==null?"":productImageUrl1;
	} 
 
	public void setProductImageUrl2(String productImageUrl2) {
		this.productImageUrl2 = Utilities.ValidateInputValue(productImageUrl2);
	}

	public String getProductImageUrl2() {
		return  productImageUrl2==null?"":productImageUrl2;
	} 
 
	public void setProductImageDesUrl(String productImageDesUrl) {
		if(Utilities.ValidateInputValue(productImageDesUrl).length()>0) {
			this.productImageDesUrl = Utilities.ValidateInputValue(productImageDesUrl);
		}
	}

	public String getProductImageDesUrl() {
		formatPrice(tenantId);
		return  productImageDesUrl==null?"":productImageDesUrl;
	} 
 
	public void setProductVideoAdd(String productVideoAdd) {
		formatPrice(tenantId);
		if(!productVideoAdd.isEmpty()){
			this.productVideoAdd = Utilities.ValidateInputValue(productVideoAdd).trim();
		}
	}

	public String getProductVideoAdd() {
		return  productVideoAdd==null?"":productVideoAdd;
	} 

	public String getYoutubeVideoURL() {
		return youtubeVideoURL == null || youtubeVideoURL.isBlank() ? "none" : youtubeVideoURL;
	}

	public void setYoutubeVideoURL(String youtubeVideoURL) {
		String normalizedUrl = youtubeVideoURL == null
				? "" : Utilities.ValidateInputValue(youtubeVideoURL).trim();
		this.youtubeVideoURL = normalizeYoutubeEmbedUrl(normalizedUrl);
	}

	private String normalizeYoutubeEmbedUrl(String value) {
		if (value == null || value.isBlank() || "none".equalsIgnoreCase(value)) return "none";
		String videoId = "";
		if (value.contains("youtube.com/watch") && value.contains("v=")) {
			videoId = value.substring(value.indexOf("v=") + 2);
		} else if (value.contains("youtu.be/")) {
			videoId = value.substring(value.indexOf("youtu.be/") + 9);
		} else if (value.contains("youtube.com/shorts/")) {
			videoId = value.substring(value.indexOf("youtube.com/shorts/") + 19);
		} else if (value.contains("youtube.com/embed/")) {
			videoId = value.substring(value.indexOf("youtube.com/embed/") + 18);
		}
		if (videoId.isBlank()) return value;
		int separator = videoId.indexOf('?');
		if (separator >= 0) videoId = videoId.substring(0, separator);
		separator = videoId.indexOf('&');
		if (separator >= 0) videoId = videoId.substring(0, separator);
		separator = videoId.indexOf('#');
		if (separator >= 0) videoId = videoId.substring(0, separator);
		separator = videoId.indexOf('/');
		if (separator >= 0) videoId = videoId.substring(0, separator);
		return videoId.isBlank() ? "none" : "https://www.youtube.com/embed/" + videoId;
	}

	public String getProductVideoType() {
		return productVideoType == null || productVideoType.isBlank() ? "Unknown" : productVideoType;
	}

	public void setProductVideoType(String productVideoType) {
		this.productVideoType = productVideoType == null || productVideoType.isBlank()
				? "Unknown" : Utilities.ValidateInputValue(productVideoType).trim();
	}
 
	public void setProductPriceAmount(BigDecimal productPriceAmount) {
		if(productPriceAmount!=null) {
			this.productPriceAmount = productPriceAmount;
		}
	}

	public BigDecimal getProductPriceAmount() {
		return productPriceAmount == null?BigDecimal.ZERO:productPriceAmount;
	} 
	
	public void formatPrice(String tenantId) {
		setTenantId(tenantId);
		
		BigDecimal currentProductPriceAmount1 = getProductPriceAmount();
		BigDecimal currentProductDiscount1 = getProductDiscount();
		BigDecimal currentProductPriceAmount2 = getProductPriceAmount();
		BigDecimal currentProductDiscount2 = getProductDiscount();
		String formatedPriceAfterDiscount1 = "";
		String formatedPriceAmout1 = "";
		String formatedPriceAfterDiscount2 = "";
		String formatedPriceAmout2 = "";
		
		
		
		if(!priceList.isEmpty() && seletedPrice.getId() == 0) {
			
			if(priceList.size()==1) {
				seletedPrice = priceList.get(0);
				
				 currentProductPriceAmount1 = seletedPrice.getPriceAmount();
				 currentProductDiscount1 = seletedPrice.getPriceDiscountPercentage();
				BigDecimal discountedAmount = currentProductPriceAmount1.multiply(currentProductDiscount1.divide(BigDecimal.valueOf(100)));
				if(getLanguage().equals("vi")) {
					discountedAmount = discountedAmount.setScale(0, RoundingMode.FLOOR);
				}
				 
				if(isDiscountable(currentProductDiscount1)) {
					formatedPriceAfterDiscount1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1.subtract(discountedAmount), tenantId, getLanguage());
					formatedProductDiscount = "-" + currentProductDiscount1.stripTrailingZeros().toPlainString() + "*";
					formatedPriceAmoutHidden = "";
					formatedProductDiscountHidden = "";
				}else if(currentProductDiscount1.compareTo(BigDecimal.ZERO) == 0) {
					formatedPriceAfterDiscount1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1.subtract(currentProductPriceAmount1.multiply(currentProductDiscount1.divide(BigDecimal.valueOf(100)))), tenantId, getLanguage());
					formatedProductDiscount= "";
					formatedPriceAmoutHidden = "hidden";
					formatedProductDiscountHidden = "none";
				}
				
				formatedPriceAfterDiscount = formatedPriceAfterDiscount1;
				formatedPriceAmout1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1, tenantId, getLanguage());
				formatedPriceAmout = formatedPriceAmout1;
				
			}else if(priceList.size()>1) {
				
				List<ProductPrice>	sortist =	new LinkedList<>(priceList);
				priceList = sortist;
				Collections.sort(priceList,Comparator.comparing(ProductPrice::getPriceAmount));
				
				 currentProductPriceAmount1 = priceList.get(0).getPriceAmount();
				 BigDecimal discountedAmount = currentProductPriceAmount1.multiply(currentProductDiscount1.divide(BigDecimal.valueOf(100)));
					if(getLanguage().equals("vi")) {
						discountedAmount = discountedAmount.setScale(0, RoundingMode.FLOOR);
					}
				 for (ProductPrice productPrice : priceList) {
					if(productPrice.getPriceDiscountPercentage().compareTo(currentProductDiscount1) > 0) {
						 currentProductDiscount1 = productPrice.getPriceDiscountPercentage();
					}
				}
				 
				if(isDiscountable(currentProductDiscount1) ) {
					formatedPriceAfterDiscount1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1.subtract(discountedAmount), tenantId, getLanguage());
					formatedProductDiscount = "-" + currentProductDiscount1.stripTrailingZeros().toPlainString() + "*";
					formatedPriceAmoutHidden = "";
					formatedProductDiscountHidden = "";
				}else if(currentProductDiscount1.compareTo(BigDecimal.ZERO) == 0) {
					formatedPriceAfterDiscount1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1.subtract(currentProductPriceAmount1.multiply(currentProductDiscount1.divide(BigDecimal.valueOf(100)))
							), tenantId, getLanguage());
					formatedProductDiscount= "";
					formatedPriceAmoutHidden = "none";
					formatedProductDiscountHidden = "none";
				}
				
				formatedPriceAmout2 = Utilities.doubleToStringCurrency(currentProductPriceAmount2, tenantId, getLanguage());
				 currentProductPriceAmount2 = priceList.get(priceList.size()-1).getPriceAmount();
				 currentProductDiscount2 = priceList.get(priceList.size()-1).getPriceDiscountPercentage();
				
				 BigDecimal discountedAmount2 = currentProductPriceAmount2.multiply(currentProductDiscount2.divide(BigDecimal.valueOf(100)));
					if(getLanguage().equals("vi")) {
						discountedAmount = discountedAmount.setScale(0, RoundingMode.FLOOR);
					}
					
				if(currentProductDiscount2.compareTo(BigDecimal.ZERO) > 0 && currentProductDiscount2.compareTo(BigDecimal.valueOf(100)) <= 0) {
					formatedPriceAfterDiscount2 = Utilities.doubleToStringCurrency(currentProductPriceAmount2.subtract(discountedAmount2), tenantId, getLanguage());
					formatedProductDiscount = "-" + currentProductDiscount2.stripTrailingZeros().toPlainString() + "*";
					formatedPriceAmoutHidden = "";
					formatedProductDiscountHidden = "";
				}else if(currentProductDiscount2.compareTo(BigDecimal.ZERO) == 0) {
					formatedPriceAfterDiscount2 = Utilities.doubleToStringCurrency(currentProductPriceAmount2.subtract(currentProductPriceAmount2.multiply(currentProductDiscount2.divide(BigDecimal.valueOf(100)))), tenantId, getLanguage());
					formatedProductDiscount= "";
					formatedPriceAmoutHidden = "none";
					formatedProductDiscountHidden = "none";
				}
				
				formatedPriceAfterDiscount = formatedPriceAfterDiscount1 + " - " + formatedPriceAfterDiscount2;
				formatedPriceAmout2 = Utilities.doubleToStringCurrency(currentProductPriceAmount1, tenantId, getLanguage());
				formatedPriceAmout = formatedPriceAmout1 + " - " + formatedPriceAmout2;
				
			}
			
			
		}else if(seletedPrice.getId() > 0) {
			
			 currentProductPriceAmount1 = seletedPrice.getPriceAmount();
			 currentProductDiscount1 = seletedPrice.getPriceDiscountPercentage();
			 BigDecimal discountedAmount = currentProductPriceAmount1.multiply(currentProductDiscount1.divide(BigDecimal.valueOf(100)));
				if(getLanguage().equals("vi")) {
					discountedAmount = discountedAmount.setScale(0, RoundingMode.FLOOR);
				}
				
			if(isDiscountable(currentProductDiscount1) ) {
				
				BigDecimal sellingAmount  = (currentProductPriceAmount1.subtract(discountedAmount));
				if(getLanguage().equals("vi")) {
					sellingAmount = sellingAmount.setScale(0, RoundingMode.FLOOR);
				}else {
					sellingAmount =    sellingAmount.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.FLOOR).divide(BigDecimal.valueOf(100));
				}
				formatedPriceAfterDiscount1 = Utilities.doubleToStringCurrency(sellingAmount, tenantId, getLanguage());

				formatedProductDiscount = "-" + currentProductDiscount1.stripTrailingZeros().toPlainString() + "*";
				formatedPriceAmoutHidden = "";
				formatedProductDiscountHidden = "";
			}else if(currentProductDiscount1.compareTo(BigDecimal.ZERO) == 0) {
				formatedPriceAfterDiscount1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1.subtract(currentProductPriceAmount1.multiply(currentProductDiscount1.divide(BigDecimal.valueOf(100)))), tenantId, getLanguage());
				formatedProductDiscount= "";
				formatedPriceAmoutHidden = "none";
				formatedProductDiscountHidden = "none";
				
				formatedPriceAmoutMajor = "";
				formatedPriceAmoutMinor = "";
			}
			
			formatedPriceAfterDiscount = formatedPriceAfterDiscount1;
			formatedPriceAmout1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1, tenantId, getLanguage());
			formatedPriceAmout = formatedPriceAmout1;
			
		}else {
			
			 currentProductPriceAmount1 = getProductPriceAmount();
			 currentProductDiscount1 = getProductDiscount();
			BigDecimal discountedAmount = currentProductPriceAmount1.multiply(currentProductDiscount1.divide(BigDecimal.valueOf(100)));
			if(getLanguage().equals("vi")) {
				discountedAmount = discountedAmount.setScale(0, RoundingMode.FLOOR);;
			}
			 
			if(isDiscountable(currentProductDiscount1)) {
				formatedPriceAfterDiscount1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1.subtract(discountedAmount), tenantId, getLanguage());
				formatedProductDiscount = "-" + currentProductDiscount1.stripTrailingZeros().toPlainString() + "*";
				formatedPriceAmoutHidden = "";
				formatedProductDiscountHidden = "";
			}else if(currentProductDiscount1.compareTo(BigDecimal.ZERO) == 0) {
				formatedPriceAfterDiscount1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1.subtract(currentProductPriceAmount1.multiply(currentProductDiscount1.divide(BigDecimal.valueOf(100)))), tenantId, getLanguage());
				formatedProductDiscount= "";
				formatedPriceAmoutHidden = "hidden";
				formatedProductDiscountHidden = "none";
			}
			if(getProductPriceAmount().compareTo(BigDecimal.ZERO) == 0) {
				formatedPriceAmoutHidden = "hidden";
			}
			
			formatedPriceAfterDiscount = formatedPriceAfterDiscount1;
			formatedPriceAmout1 = Utilities.doubleToStringCurrency(currentProductPriceAmount1, tenantId, getLanguage());
			formatedPriceAmout = formatedPriceAmout1;
		}
		
		
		formatedPriceAmoutMajor = getFormattedPriceMajor(formatedPriceAmout);
		formatedPriceAmoutMinor = getFormattedPriceMinor(formatedPriceAmout);
		
		formatedPriceAfterDiscountMajor = getFormattedPriceMajor(formatedPriceAfterDiscount);
		formatedPriceAfterDiscountMinor = getFormattedPriceMinor(formatedPriceAfterDiscount);
		
		if(newProduct) {
			newProductString = "NEW";
			newProductStringHidden = " inline-block;\n"
					+ "														    padding: 50px 29px;\n"
					+ "														    color: white;\n"
					+ "														    font-weight: bold;\n"
					+ "														    background: yellow;\n"
					+ "														    clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); color:black;";
		}else {
			newProductString ="";
			newProductStringHidden = "none";
			
		}
		
		rebuildProductImageGalleries(normalizeProductImageLines(productImageUrl1));
		
	}

	private boolean isDiscountable(BigDecimal currentProductDiscount1) {
		return currentProductDiscount1.compareTo(BigDecimal.ZERO) > 0 && currentProductDiscount1.compareTo(BigDecimal.valueOf(100)) < 0;
	}
	
	public String getFormattedPriceMajor(String formatedPrice) {
		if(formatedPrice.length()>3) {
			return  formatedPrice.substring(0, formatedPrice.length() - 3);
		}else {
			return formatedPrice;
		}
    }

    public String getFormattedPriceMinor(String formatedPrice) {
    	if(formatedPrice.length()>3) {
    		return formatedPrice.substring(formatedPrice.length() - 3);
    	}else {
			return formatedPrice;
		}
    }
 
	public void setProductDiscount(BigDecimal productDiscount) {
		
		if(productDiscount !=null) {
			this.productDiscount = productDiscount;
		}
	}

	public BigDecimal getProductDiscount() {
		return productDiscount==null?BigDecimal.ZERO:productDiscount;
	} 
 
	public void setProductPriceCurrency(String productPriceCurrency) {
		this.productPriceCurrency = Utilities.ValidateInputValue(productPriceCurrency);
	}

	public String getProductPriceCurrency() {
		return  productPriceCurrency==null?"":productPriceCurrency;
	} 

	public void setProductStockQty(BigDecimal productStockQty) {
		this.productStockQty = productStockQty == null ? BigDecimal.ZERO : productStockQty;
	}

	public BigDecimal getProductStockQty() {
		return productStockQty == null ? BigDecimal.ZERO : productStockQty;
	}
 
	public void setLanguage(String language) {
		if(language != null) {
			this.language = Utilities.ValidateInputValue(language);
		}
	}

	public String getLanguage() {
		return  language==null?"vi":language;
	} 
 
	public void setPath(String path) {
		this.path = Utilities.ValidateInputValue(path);
	}

	public String getPath() {
		return  path==null?"":path;
	} 
 
	public List<String> getImageList() {
		imageList = normalizeProductImageLines(productImageUrl1);
		return imageList;
	}

	public void setImageList(List<String> imageList) {
		String imageLines = imageList == null ? "" : String.join("\n", imageList);
		this.imageList = normalizeProductImageLines(imageLines);
	}

	public LocalDateTime getCreatedTime() {
		return createdTime;
	}

	public LocalDateTime getModifiedTime() {
		return modifiedTime;
	}

	public Boolean getPublicPrice() {
		return Boolean.TRUE.equals(publicPrice);
	}

	public void setPublicPrice(Boolean publicPrice) {
		this.publicPrice = Boolean.TRUE.equals(publicPrice);
	}

	public Boolean getVisible() {
		return visible;
	}

	public Boolean getApproved() {
		return approved;
	}

	public Boolean getLocked() {
		return locked;
	}

	public Boolean getNewProduct() {
		return newProduct;
	}

	public void isNewProduct(Boolean  newProduct) {
		this.newProduct = newProduct;
	}
	
	public void setNewProduct(Boolean  newProduct) {
		this.newProduct = newProduct;
	}

	public void setCreatedTime(LocalDateTime createdTime) {
		this.createdTime = createdTime;
	}

	public void setModifiedTime(LocalDateTime modifiedTime) {
		this.modifiedTime = modifiedTime;
	}

	public LocalDateTime getLastPostTime() {
		return lastPostTime;
	}

	public void setLastPostTime(LocalDateTime lastPostTime) {
		this.lastPostTime = lastPostTime;
	}

	public Integer getTiktokPostCount() {
		return tiktokPostCount == null ? 0 : tiktokPostCount;
	}

	public void setTiktokPostCount(Integer tiktokPostCount) {
		this.tiktokPostCount = tiktokPostCount == null ? 0 : tiktokPostCount;
	}

	public Integer getYoutubePostCount() {
		return youtubePostCount == null ? 0 : youtubePostCount;
	}

	public void setYoutubePostCount(Integer youtubePostCount) {
		this.youtubePostCount = youtubePostCount == null ? 0 : youtubePostCount;
	}

	public Integer getFacebookPostCount() {
		return facebookPostCount == null ? 0 : facebookPostCount;
	}

	public void setFacebookPostCount(Integer facebookPostCount) {
		this.facebookPostCount = facebookPostCount == null ? 0 : facebookPostCount;
	}

	public LocalDateTime getLastPostTimeTiktok() {
		return lastPostTimeTiktok;
	}

	public void setLastPostTimeTiktok(LocalDateTime lastPostTimeTiktok) {
		this.lastPostTimeTiktok = lastPostTimeTiktok;
	}

	public LocalDateTime getLastPostTimeYoutube() {
		return lastPostTimeYoutube;
	}

	public void setLastPostTimeYoutube(LocalDateTime lastPostTimeYoutube) {
		this.lastPostTimeYoutube = lastPostTimeYoutube;
	}

	public LocalDateTime getLastPostTimeYoutubeShort() {
		return lastPostTimeYoutubeShort;
	}

	public void setLastPostTimeYoutubeShort(LocalDateTime lastPostTimeYoutubeShort) {
		this.lastPostTimeYoutubeShort = lastPostTimeYoutubeShort;
	}

	public LocalDateTime getLastPostTimeFacebook() {
		return lastPostTimeFacebook;
	}

	public void setLastPostTimeFacebook(LocalDateTime lastPostTimeFacebook) {
		this.lastPostTimeFacebook = lastPostTimeFacebook;
	}

	public Integer getYoutubeShortPostCount() {
		return youtubeShortPostCount == null ? 0 : youtubeShortPostCount;
	}

	public void setYoutubeShortPostCount(Integer youtubeShortPostCount) {
		this.youtubeShortPostCount = youtubeShortPostCount == null ? 0 : youtubeShortPostCount;
	}

	public void recordScheduledPost(String platform, LocalDateTime postedAt) {
		LocalDateTime effectivePostTime = postedAt == null ? LocalDateTime.now() : postedAt;
		lastPostTime = effectivePostTime;
		if (platform == null) {
			return;
		}
		String normalized = platform.trim().toLowerCase();
		if (normalized.contains("tiktok")) {
			lastPostTimeTiktok = effectivePostTime;
			tiktokPostCount = getTiktokPostCount() + 1;
		} else if (normalized.contains("youtube") && normalized.contains("short")) {
			lastPostTimeYoutubeShort = effectivePostTime;
			youtubeShortPostCount = getYoutubeShortPostCount() + 1;
			setProductVideoType("YouTube Short");
		} else if (normalized.contains("youtube")) {
			lastPostTimeYoutube = effectivePostTime;
			youtubePostCount = getYoutubePostCount() + 1;
			setProductVideoType("YouTube Video");
		} else if (normalized.contains("facebook")) {
			lastPostTimeFacebook = effectivePostTime;
			facebookPostCount = getFacebookPostCount() + 1;
		}
	}

	public LocalDateTime getPublishedTime() {
		return publishedTime;
	}

	public void setPublishedTime(LocalDateTime publishedTime) {
		this.publishedTime = publishedTime;
	}

	public void isVisible(Boolean  visible) {
		
		this.visible = visible;
	}

	public void isApproved(Boolean  approved) {
		this.approved = approved;
	}

	public void isLocked(Boolean  locked) {
		this.locked = locked;
	}

	public String getFormatedPriceAmout() {
		return formatedPriceAmout;
	}

	public String getFormatedProductDiscount() {
		return formatedProductDiscount;
	}

	public String getFormatedPriceAfterDiscount() {
		return formatedPriceAfterDiscount;
	}

	public void setFormatedPriceAmout(String formatedPriceAmout) {
		this.formatedPriceAmout = formatedPriceAmout;
	}

	public void setFormatedProductDiscount(String formatedProductDiscount) {
		this.formatedProductDiscount = formatedProductDiscount;
	}

	public void setFormatedPriceAfterDiscount(String formatedPriceAfterDiscount) {
		this.formatedPriceAfterDiscount = formatedPriceAfterDiscount;
	}

	public String getProductSubCatalog() {
		return productSubCatalog;
	}

	public String getPageKeyword() {
		return pageKeyword;
	}

	public void setProductSubCatalog(String productSubCatog) {
		if(Utilities.ValidateInputValue(productSubCatog).length() > 0) {
			this.productSubCatalog = productSubCatog;
		}
	}

	public void setPageKeyword(String pageKeyword) {
		this.pageKeyword = pageKeyword;
	}

	public String getNewProductString() {
		return newProductString;
	}

	public void setNewProductString(String newProductString) {
		this.newProductString = newProductString;
	}

	public String getFormatedPriceAmoutHidden() {
		return formatedPriceAmoutHidden;
	}

	public String getFormatedProductDiscountHidden() {
		return formatedProductDiscountHidden;
	}

	public String getNewProductStringHidden() {
		return newProductStringHidden;
	}

	public void setFormatedPriceAmoutHidden(String formatedPriceAmoutHidden) {
		this.formatedPriceAmoutHidden = formatedPriceAmoutHidden;
	}

	public void setFormatedProductDiscountHidden(String formatedProductDiscountHidden) {
		this.formatedProductDiscountHidden = formatedProductDiscountHidden;
	}

	public void setNewProductStringHidden(String newProductStringHidden) {
		this.newProductStringHidden = newProductStringHidden;
	}

	public String getProductBrand() {
		return productBrand;
	}

	public void setProductBrand(String productBrand) {
		this.productBrand = productBrand;
	}

	public ProductCatalog getProductCategory() {
		return productCategory;
	}

	public ProductBrand getProductBrandEntity() {
		return productBrandEntity;
	}

	public void setProductCategory(ProductCatalog productCategory) {
		productCatalog = productCategory.getCatalogCode();
		this.productCategory = productCategory;
	}

	public void setProductBrandEntity(ProductBrand productBrandEntity) {
		productBrand = productBrandEntity.getBrandCode();
		this.productBrandEntity = productBrandEntity;
	}

	public List<ProductColor> getColorList() {
		return colorList;
	}

	public void setColorList(List<ProductColor> colorList) {
		for (ProductColor color : colorList) {
			if(tenantId!=null && color.getColorImageDesUrl().contains(tenantId)) {
				color.setColorImageDesUrlThumbnail( Utilities.appendResolutionToFilename(color.getColorImageDesUrl(), "_rslt_64x64"));
			}else {
				color.setColorImageDesUrlThumbnail( color.getColorImageDesUrl());
			}
		}
		this.colorList = colorList;
	}

	public List<ProductPrice> getPriceList() {
		return priceList;
	}

	public void setPriceList(List<ProductPrice> priceList) {
		this.priceList = priceList;
		formatPrice(tenantId) ;
	}

	public ProductPrice getSeletedPrice() {
		return seletedPrice;
	}

	public void setSeletedPrice(ProductPrice seletedPrice) {
		this.seletedPrice = seletedPrice == null ? new ProductPrice() : seletedPrice;
		String selectedImage = normalizeProductImageUrl(this.seletedPrice.getPriceImage());
		List<String> normalizedImages = normalizeProductImageLines(productImageUrl1);
		if(!selectedImage.isEmpty()) {
			normalizedImages.removeIf(img -> img.equals(selectedImage));
			normalizedImages.add(0, selectedImage);
			setProductImageUrl1(String.join("\n", normalizedImages));
		}else if(normalizedImages.size()>0) {
			setProductImageUrl1(String.join("\n", normalizedImages));
		}
		formatPrice(tenantId);
	}

	public String getTenantId() {
		return tenantId;
	}

	public void setTenantId(String tenantId) {
		this.tenantId = Utilities.ValidateInputValue(tenantId);
	}

	public List<ProductSize> getSizeList() {
		return sizeList;
	}

	public void setSizeList(List<ProductSize> sizeList) {
		this.sizeList = sizeList;
	}

	public List<ImageGalary> getImageGalaryList() {
		return imageGalaryList;
	}

	public void setImageGalaryList(List<ImageGalary> imageGalaryList) {
		this.imageGalaryList = imageGalaryList;
	}

	public String getProductGroupString() {
		return productGroupString==null?"":productGroupString;
	}
	

	public void setProductGroupString(String productGroupString) {
		this.productGroupString = productGroupString;
	}
	
	
	public String getProductTagString() {
		return productSubCatalog==null?"":productSubCatalog;
	}
	
	public void setProductTagString(String productSubCatalog) {
		if(Utilities.ValidateInputValue(productSubCatalog).length()>0) {
			this.productSubCatalog = productSubCatalog;
		}
	}

	public String getFormatedPriceAmoutMajor() {
		return formatedPriceAmoutMajor;
	}

	public void setFormatedPriceAmoutMajor(String formatedPriceAmoutMajor) {
		this.formatedPriceAmoutMajor = formatedPriceAmoutMajor;
	}

	public String getFormatedPriceAmoutMinor() {
		return formatedPriceAmoutMinor;
	}

	public void setFormatedPriceAmoutMinor(String formatedPriceAmoutMinor) {
		this.formatedPriceAmoutMinor = formatedPriceAmoutMinor;
	}

	public String getFormatedPriceAfterDiscountMajor() {
		return formatedPriceAfterDiscountMajor;
	}

	public void setFormatedPriceAfterDiscountMajor(String formatedPriceAfterDiscountMajor) {
		this.formatedPriceAfterDiscountMajor = formatedPriceAfterDiscountMajor;
	}

	public String getFormatedPriceAfterDiscountMinor() {
		return formatedPriceAfterDiscountMinor;
	}

	public void setFormatedPriceAfterDiscountMinor(String formatedPriceAfterDiscountMinor) {
		this.formatedPriceAfterDiscountMinor = formatedPriceAfterDiscountMinor;
	}

	public Product deepCopy() {
						Product copy = new Product();
				        copy.setId(this.id);
				        copy.setProductName(this.productName);
				        copy.setProductGroupString(productGroupString);
				        copy.setProductCode(this.productCode);
				        copy.setProductCatalog(this.productCatalog);
				        copy.setProductShortDes(this.productShortDes);
				        copy.setProductLongDes(this.productLongDes);
				        copy.setProductImageUrl1(this.productImageUrl1);
				        copy.setProductImageUrl2(this.productImageUrl2);
				        copy.setProductImageDesUrl(this.productImageDesUrl);
				        copy.setProductVideoAdd(this.productVideoAdd);
				        copy.setYoutubeVideoURL(this.youtubeVideoURL);
				        copy.setProductVideoType(this.productVideoType);
				        copy.setLastPostTime(this.lastPostTime);
				        copy.setTiktokPostCount(this.tiktokPostCount);
				        copy.setYoutubePostCount(this.youtubePostCount);
				        copy.setFacebookPostCount(this.facebookPostCount);
				        copy.setLastPostTimeTiktok(this.lastPostTimeTiktok);
				        copy.setLastPostTimeYoutube(this.lastPostTimeYoutube);
				        copy.setLastPostTimeYoutubeShort(this.lastPostTimeYoutubeShort);
				        copy.setLastPostTimeFacebook(this.lastPostTimeFacebook);
				        copy.setYoutubeShortPostCount(this.youtubeShortPostCount);
				        copy.setProductPriceAmount(this.productPriceAmount);
				        copy.setPublicPrice(this.publicPrice);
				        copy.setProductDiscount(this.productDiscount);
				        copy.setProductPriceCurrency(this.productPriceCurrency);
				        copy.setProductStockQty(this.productStockQty);
				        copy.setLanguage(this.language);
				        copy.setPath(this.path);
				        copy.setTenantId(tenantId);
	return copy;
	}

    /**
     * Extracts the Dailymotion video ID from the productVideoAdd URL if present.
     * If productVideoAdd is of the form '...video=xxxx', returns 'xxxx'.
     */
    public String getDailymotionVideoId() {
        if (productVideoAdd == null) return null;
        int idx = productVideoAdd.indexOf("video=");
        if (idx >= 0) {
            String id = productVideoAdd.substring(idx + 6);
            return cleanDailymotionVideoId(id);
        }
        int pathIdx = productVideoAdd.indexOf("/video/");
        if (pathIdx >= 0) {
            String id = productVideoAdd.substring(pathIdx + 7);
            int slash = id.indexOf('/');
            if (slash >= 0) id = id.substring(0, slash);
            return cleanDailymotionVideoId(id);
        }
        int shortIdx = productVideoAdd.indexOf("dai.ly/");
        if (shortIdx >= 0) {
            String id = productVideoAdd.substring(shortIdx + 7);
            int slash = id.indexOf('/');
            if (slash >= 0) id = id.substring(0, slash);
            return cleanDailymotionVideoId(id);
        }
        return null;
    }

    private String cleanDailymotionVideoId(String id) {
        if (id == null) return null;
        int amp = id.indexOf('&');
        if (amp > 0) id = id.substring(0, amp);
        int question = id.indexOf('?');
        if (question > 0) id = id.substring(0, question);
        int underscore = id.indexOf('_');
        if (underscore > 0) id = id.substring(0, underscore);
        id = id.replaceAll("[^A-Za-z0-9]", "").trim();
        return id.isBlank() ? null : id;
    }
} 
