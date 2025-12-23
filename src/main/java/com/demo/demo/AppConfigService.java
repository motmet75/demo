package com.demo.demo;

import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

@Service
public class AppConfigService {
	
	 public String getAppName() {
	        return "Portal System";
	    }
	 
	 @PostConstruct
	 public void init() {
	     System.out.println("AppConfigService instance: " + this.hashCode());
	 }
	 

}
