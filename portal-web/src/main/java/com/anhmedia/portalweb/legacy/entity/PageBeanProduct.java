package com.anhmedia.portalweb.legacy.entity;

public class PageBeanProduct {
	
	String activeClassString="";
	
	String pageText="";
	int pageNumber = 0;
	public String getActiveClassString() {
		return activeClassString;
	}
	public int getPageNumber() {
		return pageNumber;
	}
	public void setActiveClassString(String activeClassString) {
		this.activeClassString = activeClassString;
	}
	public void setPageNumber(int pageNumber) {
		this.pageNumber = pageNumber;
	}
	public String getPageText() {
		return pageText;
	}
	public void setPageText(String pageText) {
		this.pageText = pageText;
	}

}
