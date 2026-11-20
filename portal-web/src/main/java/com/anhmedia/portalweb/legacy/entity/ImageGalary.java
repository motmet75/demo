// Copied unchanged from legacy Portal com.vaadin.example.data.entity (only package/imports adapted).
package com.anhmedia.portalweb.legacy.entity;

import jakarta.persistence.Basic;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;

import com.anhmedia.portalweb.legacy.Utilities;


@Entity
public class ImageGalary {
	
	public ImageGalary(int index, String address, String active) {
		setIndex(index);
		setImageAdress(address);
		setActive(active);
	}
	
	@Id
	String imageAdress;
	
	public String getImageAdress() {
		return imageAdress;
	}

	public String getActive() {
		return active;
	}

	public void setImageAdress(String imageAdress) {
		this.imageAdress = Utilities.ValidateInputValue(imageAdress);
	}

	public void setActive(String active) {
		this.active = Utilities.ValidateInputValue(active);
	}

	@Basic
	String active = "";
	
	@Basic
	int index = 0;

	public int getIndex() {
		return index;
	}

	public void setIndex(int index) {
		this.index = index;
	}

}
