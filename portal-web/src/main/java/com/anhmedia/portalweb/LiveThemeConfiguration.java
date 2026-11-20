package com.anhmedia.portalweb;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.thymeleaf.spring6.templateresolver.SpringResourceTemplateResolver;
import org.thymeleaf.templatemode.TemplateMode;

import java.nio.file.Path;

/**
 * Live theme HTML/CSS/JS/images remain external and are never copied into the JAR.
 * This service must be placed behind Nginx and must only receive public-site traffic.
 */
@Configuration
public class LiveThemeConfiguration implements WebMvcConfigurer {
    private final String themeRoot;

    public LiveThemeConfiguration(@Value("${portal.live.root:/opt/portal-live}") String root) {
        this.themeRoot = Path.of(root).toAbsolutePath().normalize().toString();
    }

    @Bean
    SpringResourceTemplateResolver liveTemplateResolver(ApplicationContext context) {
        SpringResourceTemplateResolver resolver = new SpringResourceTemplateResolver();
        resolver.setApplicationContext(context);
        resolver.setPrefix("file:" + themeRoot + "/templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        resolver.setCacheable(false);
        resolver.setCheckExistence(true);
        resolver.setOrder(0);
        return resolver;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Theme paths are already used in HTML: /anhmedia.vn/css/site.css, etc.
        // Only content inside /opt/portal-live/static is publicly exposed.
        registry.addResourceHandler("/**")
                .addResourceLocations("file:" + themeRoot + "/static/")
                .setCachePeriod(300);
    }
}
