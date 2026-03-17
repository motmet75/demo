package com.demo.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    @Bean
    public WebMvcConfigurer corsConfigurer() {
        return new WebMvcConfigurer() {
        	@Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/bom/api/**")
                        .allowedOrigins(
                        		"https://192.168.100.175", 
                        		"http://localhost:5173",
                            "http://15.165.215.69:5173",
                            "https://anhmedia.vn"
                        )
                        .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
                        .allowedHeaders("*")
                        .allowCredentials(true);
                registry.addMapping("/api/orders/**")
                .allowedOrigins(
                		"https://192.168.100.175", 
                		"http://localhost:5173",
                    "http://15.165.215.69:5173",
                    "https://anhmedia.vn"
                )
                .allowedMethods("GET","POST","PUT","DELETE","OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true);
            }
        };
    }
}
