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
        registry.addInterceptor(contextInterceptor)
            // apply to business and authenticated shop staff endpoints
            .addPathPatterns("/bom/**", "/shop/staff/**")
            // exclude endpoints that must work without tenant/company context
            .excludePathPatterns(
                "/bom/tenants",
                "/bom/tenants/**",
                "/bom/companies",
                "/bom/companies/**"
            );
    }
}

