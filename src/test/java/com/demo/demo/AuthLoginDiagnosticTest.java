package com.demo.demo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.context.WebApplicationContext;

import com.ams.bomcore.domain.user.Authority;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.AuthorityRepository;
import com.ams.bomcore.repository.UserRepository;

/**
 * Diagnostic integration test for login: user=anhmedia, password=Anhmedia@2025
 *
 * Checks every layer that can cause a login failure:
 *  1. User exists in DB
 *  2. User is enabled
 *  3. Account is non-locked / non-expired
 *  4. Stored hash prefix (BCrypt version)
 *  5. BCrypt hash matches the plain-text password
 *  6. Authorities are loaded
 *  7. AuthenticationManager accepts the credentials
 *  8. Full HTTP POST /auth/login returns 200
 */
@SpringBootTest
class AuthLoginDiagnosticTest {

    private static final String USERNAME = "anhmedia";
    private static final String PASSWORD = "Anhmedia@2025";

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuthorityRepository authorityRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private WebApplicationContext webApplicationContext;

    @MockitoBean
    private JavaMailSender mailSender;

    private MockMvc mockMvc;

    @BeforeEach
    void setup() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    // -------------------------------------------------------------------------
    // 1. User must exist
    // -------------------------------------------------------------------------
    @Test
    void step1_userExistsInDatabase() {
        Optional<User> userOpt = userRepository.findByUsernameIgnoreCase(USERNAME);
        org.junit.jupiter.api.Assertions.assertTrue(
                userOpt.isPresent(),
                "FAIL step 1 – user '" + USERNAME + "' not found in userTB. " +
                "Create the user row first.");
    }

    // -------------------------------------------------------------------------
    // 2. User must be enabled
    // -------------------------------------------------------------------------
    @Test
    void step2_userIsEnabled() {
        User user = userRepository.findByUsernameIgnoreCase(USERNAME)
                .orElseThrow(() -> new AssertionError(
                        "FAIL step 2 pre-condition – user '" + USERNAME + "' not found."));

        System.out.println("[DIAG] enabled        = " + user.isEnabled());
        System.out.println("[DIAG] accountNonLocked= " + user.isAccountNonLocked());
        System.out.println("[DIAG] accountNonExpired=" + user.isAccountNonExpired());
        System.out.println("[DIAG] credNonExpired  = " + user.isCredentialsNonExpired());

        org.junit.jupiter.api.Assertions.assertTrue(user.isEnabled(),
                "FAIL step 2 – user is DISABLED (isenabled=false in DB). " +
                "Run: UPDATE \"userTB\" SET isenabled=true WHERE username='anhmedia';");
    }

    // -------------------------------------------------------------------------
    // 3. Account non-locked
    // -------------------------------------------------------------------------
    @Test
    void step3_accountIsNotLocked() {
        User user = userRepository.findByUsernameIgnoreCase(USERNAME)
                .orElseThrow(() -> new AssertionError("Pre-condition: user not found."));

        org.junit.jupiter.api.Assertions.assertTrue(user.isAccountNonLocked(),
                "FAIL step 3 – account is LOCKED (isaccountnonlocked=false). " +
                "Run: UPDATE \"userTB\" SET isaccountnonlocked=true WHERE username='anhmedia';");
    }

    // -------------------------------------------------------------------------
    // 4. Stored hash must be a valid BCrypt hash (starts with $2 prefix)
    // -------------------------------------------------------------------------
    @Test
    void step4_storedHashIsBcrypt() {
        User user = userRepository.findByUsernameIgnoreCase(USERNAME)
                .orElseThrow(() -> new AssertionError("Pre-condition: user not found."));

        String hash = user.getPassword();
        System.out.println("[DIAG] stored password hash = " + hash);
        System.out.println("[DIAG] hash prefix          = " + (hash != null && hash.length() >= 7 ? hash.substring(0, 7) : "<too short or null>"));

        org.junit.jupiter.api.Assertions.assertNotNull(hash, "FAIL step 4 – password is null.");
        org.junit.jupiter.api.Assertions.assertTrue(
                hash.startsWith("$2"),
                "FAIL step 4 – stored hash does NOT look like BCrypt (does not start with '$2'). " +
                "Actual value: [" + hash + "]. " +
                "The password may be stored in plain-text or a different algorithm.");
    }

    // -------------------------------------------------------------------------
    // 5. BCrypt hash must match the plain-text password
    // -------------------------------------------------------------------------
    @Test
    void step5_passwordMatchesStoredHash() {
        User user = userRepository.findByUsernameIgnoreCase(USERNAME)
                .orElseThrow(() -> new AssertionError("Pre-condition: user not found."));

        String hash = user.getPassword();
        boolean matches = passwordEncoder.matches(PASSWORD, hash);

        System.out.println("[DIAG] passwordEncoder.matches(\"" + PASSWORD + "\", hash) = " + matches);

        if (!matches) {
            // Extra diagnostics: try with lower-case password and common alternatives
            System.out.println("[DIAG] matches lower-case variant  = " + passwordEncoder.matches(PASSWORD.toLowerCase(), hash));
            System.out.println("[DIAG] matches plain-text equality = " + PASSWORD.equals(hash));
        }

        org.junit.jupiter.api.Assertions.assertTrue(matches,
                "FAIL step 5 – BCrypt.matches() returned FALSE. " +
                "The stored hash was NOT encoded from '" + PASSWORD + "' using BCryptPasswordEncoder($2B, 13). " +
                "Fix: re-encode and update DB with the correct hash.");
    }

    // -------------------------------------------------------------------------
    // 6. Authorities must be loadable
    // -------------------------------------------------------------------------
    @Test
    void step6_authoritiesExistForUser() {
        User user = userRepository.findByUsernameIgnoreCase(USERNAME)
                .orElseThrow(() -> new AssertionError("Pre-condition: user not found."));

        List<Authority> authorities = authorityRepository.findByUsername(user.getUsername());
        System.out.println("[DIAG] authorities count = " + authorities.size());
        authorities.forEach(a -> System.out.println("[DIAG]   authority = " + a.getAuthority()));

        org.junit.jupiter.api.Assertions.assertFalse(authorities.isEmpty(),
                "FAIL step 6 – no rows found in 'authorities' table for username='" +
                user.getUsername() + "'. Spring Security requires at least one granted authority. " +
                "Insert at least ROLE_USER.");
    }

    // -------------------------------------------------------------------------
    // 7. AuthenticationManager accepts the credentials end-to-end
    // -------------------------------------------------------------------------
    @Test
    void step7_authenticationManagerAcceptsCredentials() {
        try {
            Authentication auth = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(USERNAME, PASSWORD));
            System.out.println("[DIAG] Authentication successful: principal=" + auth.getPrincipal());
            org.junit.jupiter.api.Assertions.assertTrue(auth.isAuthenticated(),
                    "FAIL step 7 – authenticated token has isAuthenticated()=false.");
        } catch (AuthenticationException ex) {
            org.junit.jupiter.api.Assertions.fail(
                    "FAIL step 7 – AuthenticationManager threw " +
                    ex.getClass().getSimpleName() + ": " + ex.getMessage() +
                    ". Check steps 1-6 above.");
        }
    }

    // -------------------------------------------------------------------------
    // 8. Full HTTP POST /auth/login accepts credentials and starts new-device MFA
    // -------------------------------------------------------------------------
    @Test
    void step8_httpLoginEndpointReturns200() throws Exception {
        String body = "{\"username\":\"" + USERNAME + "\",\"password\":\"" + PASSWORD + "\"}";

        MvcResult result = mockMvc.perform(post("/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(jsonPath("$.mfaRequired").value(true))
                .andReturn();

        System.out.println("[DIAG] Response body: " + result.getResponse().getContentAsString());
    }
}
