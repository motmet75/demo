package com.ams.bomcore.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final ContextInterceptor contextInterceptor;

    @Autowired
    public WebConfig(ContextInterceptor contextInterceptor) {
        this.contextInterceptor = contextInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        // apply to all /bom/** endpoints — covers inventory, movements, materials, etc.
        // public tenant/company endpoints are allowed inside the interceptor itself
        registry.addInterceptor(contextInterceptor).addPathPatterns("/api/bom/**", "/bom/**", "/admin/**", "/api/**", "/api/auth/**", "/api/admin/**");
    }
}
