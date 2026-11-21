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
    private final String legacyResourcesRoot;

    public LiveThemeConfiguration(
            @Value("${portal.live.root:/opt/portal-live}") String root,
            @Value("${portal.web.legacy-resources-root:/opt/tuonghoa/portal/src/main/resources}") String legacyRoot) {
        this.themeRoot = Path.of(root).toAbsolutePath().normalize().toString();
        this.legacyResourcesRoot = Path.of(legacyRoot).toAbsolutePath().normalize().toString();
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

    /**
     * The old Portal stores shared fragments such as nncminhchau.html and
     * tuonghoaimex.html in its packaged resource tree. Use them only when
     * no live template of the same name exists.
     */
    @Bean
    SpringResourceTemplateResolver legacyPortalTemplateResolver(ApplicationContext context) {
        SpringResourceTemplateResolver resolver = new SpringResourceTemplateResolver();
        resolver.setApplicationContext(context);
        resolver.setPrefix("file:" + legacyResourcesRoot + "/templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        resolver.setCacheable(false);
        resolver.setCheckExistence(true);
        resolver.setOrder(1);
        return resolver;
    }

    /** Portal Web's own shared templates (e.g. the fallback login page), packaged in this JAR. */
    @Bean
    org.thymeleaf.templateresolver.ClassLoaderTemplateResolver portalWebSharedTemplateResolver() {
        org.thymeleaf.templateresolver.ClassLoaderTemplateResolver resolver =
                new org.thymeleaf.templateresolver.ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        resolver.setResolvablePatterns(java.util.Set.of("portal-web-shared/*"));
        resolver.setCheckExistence(true);
        resolver.setOrder(2);
        return resolver;
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Live assets take priority. Original packaged assets are a read-only
        // fallback for shared paths such as /img/languageflags/en.png and
        // /portal.tuonghoa-imex.com/fontawesome/css/all.min.css.
        // These directories contain public assets, not tenant credentials.
        registry.addResourceHandler("/**")
                .addResourceLocations(
                        "file:" + themeRoot + "/static/",
                        "file:" + legacyResourcesRoot + "/static/")
                .setCachePeriod(300);
    }
}
