// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity;

import java.time.LocalDateTime;
import java.util.LinkedList;
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
@Table(name = "ProductGroupTb")
@Access(value=AccessType.FIELD)
public class  ProductGroup {

 	@Id
	@Column(name="id")
	@GeneratedValue(strategy=GenerationType.IDENTITY)
	private Long id = (long) 0.0 ;

	@Column(name="stringId")
	private String  stringId = "none" ;

	@Column(name="productGroupCode")
	private String  productGroupCode = "none" ;

	@Column(name="productGroupName")
	private String  productGroupName = "none" ;

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
	@Column(name="isdefault")
	private Boolean isDefault = false ;

//	@jakarta.persistence.Transient
//	List<Product> products = new LinkedList<>();

	@jakarta.persistence.Transient
	List<Product> currentPageProductList = new LinkedList<>();

	@jakarta.persistence.Transient
	int currentPage = 1;

	@jakarta.persistence.Transient
	int pageSize = 10;

	@jakarta.persistence.Transient
	int totalPage = 1;

	@jakarta.persistence.Transient
	List<PageBeanProduct> pageCount = new LinkedList<>();

	@Transient
	String tenantString = "";

	public ProductGroup(String groupCode) {
		setProductGroupCode(groupCode);
	}

	public ProductGroup() {
		// TODO Auto-generated constructor stub
	}

	public List<Product> getPageItems(int pageNp, String domainString) {
		tenantString = domainString;
		//currentPageProductList = Utilities.getPage(products, pageNp, pageSize);
		for (Product p : currentPageProductList) {
			if(p.getProductImageDesUrl()!=null) {
				if(!p.getProductImageDesUrl().isEmpty()) {
					if(p.getProductImageDesUrl().contains(domainString) || p.getProductImageDesUrl().contains("localhost")) {
						if(p.getProductImageDesUrl().contains("300x300")) {
							continue;
						}else {
							p.setProductImageDesUrl(Utilities.appendResolutionToFilename(p.getProductImageDesUrl(), Utilities.getConfig("imagesolutionsaperator")  + "300x300"));
						}
					}
				}
			}

		}
		for (PageBeanProduct p : pageCount) {
			if(p.getPageNumber()==pageNp) {
				p.setActiveClassString("active");
			}else {
				p.setActiveClassString("");
			}

		}
		return currentPageProductList ;
	}

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
		return  stringId==null?"n":Utilities.GetBackStringValue(stringId);
	}

	public void setProductGroupCode(String productGroupCode) {
		this.productGroupCode = Utilities.ValidateInputValue(productGroupCode);
	}

	public String getProductGroupCode() {
		return  productGroupCode==null?"":Utilities.GetBackStringValue(productGroupCode);
	}

	public void setProductGroupName(String productGroupName) {
		this.productGroupName = Utilities.ValidateInputValue(productGroupName);
	}

	public String getProductGroupName() {
		return  productGroupName==null?"":Utilities.GetBackStringValue(productGroupName);
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
	}

	public void setIsDefault(Boolean isDefault) {
		this.isDefault = isDefault;
	}

	public Boolean getIsDefault() {
		return isDefault != null && isDefault;
	}

//	public List<Product> getProducts() {
//		return products;
//	}

	public void setProducts(List<Product> products, int totalRecords) {
	//	this.products = products;
		currentPageProductList = products;
		//currentPageProductList = Utilities.getPage(products, 1, pageSize);
		pageCount = new LinkedList<>();
		totalPage = (totalRecords + pageSize -1 ) /pageSize;
		for (int i = 0; i < totalPage; i++) {
			PageBeanProduct pageBeanProduct = new PageBeanProduct();
			pageBeanProduct.setPageNumber(i+1);
			pageCount.add(pageBeanProduct);
		}
		if( pageCount.size()>0 ) {
			pageCount.get(0).setActiveClassString("active");
		}
		//getPageItems(1, tenantString);

	}

	public void setActivePage(int i) {
		for (int j = 0; j < pageCount.size(); j++) {
			if(pageCount.get(j).getPageNumber() == i+1) {
				pageCount.get(j).setActiveClassString("active");
			}else {
				pageCount.get(j).setActiveClassString("none");
			}
		}

	}

	public List<Product> getCurrentPageProductList() {
		return currentPageProductList;
	}

	public int getCurrentPage() {
		return currentPage;
	}

	public int getPageSize() {
		return pageSize;
	}

	public void setCurrentPageProductList(List<Product> currentPageProductList) {
		this.currentPageProductList = currentPageProductList;
	}

	public void setCurrentPage(int currentPage) {
		this.currentPage = currentPage;
	}

	public void setPageSize(int pageSize) {
		this.pageSize = pageSize;
	}

	public int getTotalPage() {
		return totalPage;
	}

	public void setTotalPage(int totalPage) {
		this.totalPage = totalPage;
	}

	public List<PageBeanProduct> getPageCount() {
		return pageCount;
	}

	public void setPageCount(List<PageBeanProduct> pageCount) {
		this.pageCount = pageCount;
	}

	public ProductGroup deepCopy() {
						ProductGroup copy = new ProductGroup();
				        copy.setId(this.id);
				        copy.setStringId(this.stringId);
				        copy.setProductGroupCode(this.productGroupCode);
				        copy.setProductGroupName(this.productGroupName);
				        copy.setCreatedTime(this.createdTime);
				        copy.setModifiedTime(this.modifiedTime);
				        copy.setApproved(this.approved);
				        copy.setLocked(this.locked);
				        copy.setVisible(this.visible);
			            copy.setIsDefault(this.isDefault);
	return copy;
	}



 }
