package com.demo.security;

import java.util.List;
import java.util.ArrayList;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig {

    private final String relayExtensionOrigin;

    /**
     * Allow only the explicitly paired Chrome installation, and only on VIN relay endpoints.
     * Example extension ID: 32 lowercase letters in the a-p range.
     */
    public CorsConfig(@Value("${vin-hoadon.relay.extension-id:}") String relayExtensionId) {
        String id = relayExtensionId == null ? "" : relayExtensionId.trim();
        if (!id.isEmpty() && !id.matches("[a-p]{32}")) {
            throw new IllegalArgumentException("VIN_HOADON_RELAY_EXTENSION_ID must be a 32-character Chrome extension ID");
        }
        relayExtensionOrigin = id.isEmpty() ? "" : "chrome-extension://" + id;
    }

    private List<String> relayOrigins() {
        List<String> origins = new ArrayList<>(ALLOWED_ORIGINS);
        if (!relayExtensionOrigin.isBlank()) origins.add(relayExtensionOrigin);
        return origins;
    }

	private static final List<String> ALLOWED_ORIGINS = List.of(
		"https://15.165.215.69:8443",
		"https://15.165.215.69",
		"http://15.165.215.69:5173",
		"http://localhost:5173",
		"http://localhost:3000",
		"https://anhmedia.vn:8443",
		"https://anhmedia.vn:443",
		"https://anhmedia.vn",
		"https://anhmedia.vn:5173"
	);

	private static final List<String> ALLOWED_ORIGIN_PATTERNS = List.of(
		"https://*.anhmedia.vn",
		"http://*.anhmedia.vn"
	);

	@Bean
	public CorsConfigurationSource corsConfigurationSource() {
		CorsConfiguration config = new CorsConfiguration();
		config.setAllowedOrigins(ALLOWED_ORIGINS);
		config.setAllowedOriginPatterns(ALLOWED_ORIGIN_PATTERNS);
		config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"));
		config.setAllowedHeaders(List.of("*"));
		config.setAllowCredentials(true);
		config.setMaxAge(3600L);

		UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
		CorsConfiguration relayCors = new CorsConfiguration(config);
        relayCors.setAllowedOrigins(relayOrigins());
        source.registerCorsConfiguration("/api/vin-hoadon/relay/**", relayCors);
		source.registerCorsConfiguration("/**", config);
		return source;
	}


	@Bean
	public WebMvcConfigurer corsConfigurer() {
		return new WebMvcConfigurer() {
			@Override
			public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/vin-hoadon/relay/**")
                    .allowedOrigins(relayOrigins().toArray(new String[0]))
                    .allowedOriginPatterns(ALLOWED_ORIGIN_PATTERNS.toArray(new String[0]))
                    .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
                    .allowedHeaders("*")
                    .allowCredentials(true)
                    .maxAge(3600);
				registry.addMapping("/**")
					.allowedOrigins(ALLOWED_ORIGINS.toArray(new String[0]))
					.allowedOriginPatterns(ALLOWED_ORIGIN_PATTERNS.toArray(new String[0]))
					.allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH")
					.allowedHeaders("*")
					.allowCredentials(true)
					.maxAge(3600);
			}
		};
	}
}
