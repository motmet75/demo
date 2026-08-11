package com.demo.security;

import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder.BCryptVersion;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;

import jakarta.servlet.http.HttpServletRequest;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final GoogleOAuth2UserService googleOAuth2UserService;

    public SecurityConfig(GoogleOAuth2UserService googleOAuth2UserService) {
        this.googleOAuth2UserService = googleOAuth2UserService;
    }

    /** Build origin (scheme + host + optional port) from forwarded headers, falling back to the raw request. */
    private static String origin(HttpServletRequest req) {
        String proto = Optional.ofNullable(req.getHeader("X-Forwarded-Proto"))
                               .filter(s -> !s.isBlank()).orElse(req.getScheme());
        String host  = Optional.ofNullable(req.getHeader("X-Forwarded-Host"))
                               .filter(s -> !s.isBlank())
                               .orElseGet(() -> {
                                   int port = req.getServerPort();
                                   boolean std = (proto.equals("https") && port == 443)
                                              || (proto.equals("http")  && port == 80);
                                   return req.getServerName() + (std ? "" : ":" + port);
                               });
        return proto + "://" + host;
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable())
            .cors(Customizer.withDefaults())
            .sessionManagement(session -> session
                .sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED)
            )
            .securityContext(ctx -> ctx
                .securityContextRepository(securityContextRepository())
            )
            .exceptionHandling(exception -> exception.authenticationEntryPoint((req, res, authException) -> {
                res.setStatus(401);
                res.setContentType("application/json");
                res.getWriter().write("{\"authenticated\":false,\"message\":\"Not authenticated\"}");
            }))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                // The legacy iPad HTML/login shell is public. Its shop staff
                // API calls remain protected by the /shop/staff/** rule below.
                .requestMatchers("/bom-inventory/ipad4", "/bom-inventory/ipad4/**").permitAll()
                .requestMatchers("/auth/quick-login/redeem").permitAll()
                .requestMatchers("/auth/quick-login/generate").authenticated()
                .requestMatchers("/oauth2/**").permitAll()
                .requestMatchers("/dang-nhap/oauth2/**").permitAll()
                .requestMatchers("/bom/**").authenticated()
                .requestMatchers("/auth/password-otp/**").authenticated()
                .requestMatchers("/auth/login", "/auth/login-otp/**", "/auth/login-totp/**", "/auth/logout", "/auth/me", "/auth/change-password", "/auth/last-context", "/auth/profile", "/error").permitAll()
                .requestMatchers("/bom/etl/**").authenticated()
                .requestMatchers(HttpMethod.GET, "/bom/tenants", "/bom/tenants/**").permitAll()
                .requestMatchers("/shop/public/**").permitAll()
                .requestMatchers("/shop/staff/**").authenticated()
                .anyRequest().permitAll()
            )
            .oauth2Login(oauth2 -> oauth2
                .redirectionEndpoint(endpoint -> endpoint
                    .baseUri("/dang-nhap/oauth2/code/*")
                )
                .userInfoEndpoint(userInfo -> userInfo
                    .userService(googleOAuth2UserService)
                )
                .successHandler((req, res, auth) ->
                    res.sendRedirect(origin(req) + "/bom-inventory/profile")
                )
                .failureHandler((req, res, ex) ->
                    res.sendRedirect(origin(req) + "/bom-inventory/login?error=oauth2")
                )
            )
            .formLogin(form -> form.disable())
            .httpBasic(basic -> basic.disable())
            .logout(logout -> logout.disable());
        return http.build();
    }

    @Bean
    public SecurityContextRepository securityContextRepository() {
        return new HttpSessionSecurityContextRepository();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(BCryptVersion.$2B, 13);
    }
}
