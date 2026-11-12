package com.ams.bomcore.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final ContextInterceptor contextInterceptor;
    private final com.demo.security.ShopTrialInterceptor shopTrialInterceptor;

    @Autowired
    public WebConfig(ContextInterceptor contextInterceptor, com.demo.security.ShopTrialInterceptor shopTrialInterceptor) {
        this.contextInterceptor = contextInterceptor;
        this.shopTrialInterceptor = shopTrialInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(shopTrialInterceptor)
            .addPathPatterns("/bom/**", "/shop/staff/**", "/orders/**", "/order-lines/**",
                "/admin/**", "/api/invoice-desk/**", "/api/vin-hoadon/**",
                "/auth/shop/setup", "/auth/shop/reset", "/auth/profile/order-notification");
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

