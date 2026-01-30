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
        // apply to bom APIs and inventory/materials etc. Skip public tenant/company endpoints which the interceptor already allows
        registry.addInterceptor(contextInterceptor).addPathPatterns("/bom/api/**", "/api/**");
    }
}
