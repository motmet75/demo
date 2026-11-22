package com.demo.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.config.oauth2.client.CommonOAuth2Provider;
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository;
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest;

class GoogleAccountChooserTest {

    @Test
    void googleLoginAlwaysAsksWhichAccount() {
        var google = CommonOAuth2Provider.GOOGLE.getBuilder("google").clientId("id").clientSecret("secret").build();
        var resolver = SecurityConfig.googleAccountChooser(new InMemoryClientRegistrationRepository(google));

        var req = new MockHttpServletRequest("GET", "/oauth2/authorization/google");
        req.setServletPath("/oauth2/authorization/google");
        OAuth2AuthorizationRequest auth = resolver.resolve(req);

        assertEquals("select_account", auth.getAdditionalParameters().get("prompt"));
        assertTrue(auth.getAuthorizationRequestUri().contains("prompt=select_account"), auth.getAuthorizationRequestUri());
    }
}
