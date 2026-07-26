package com.demo.security;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.user.Authority;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.UserRepository;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;

/**
 * Auth endpoints used by the React frontend.
 *
 * POST  /auth/login            – session login (BCrypt $2B / 13 via PasswordEncoder bean)
 * POST  /auth/logout           – session invalidation
 * GET   /auth/me               – current session user info (includes lastTenantId, lastCompanyId)
 * POST  /auth/change-password  – verify old password then re-encode with the same PasswordEncoder bean
 * PATCH /auth/last-context     – persist the last-used tenantId and companyId for the current user
 *
 * IMPORTANT: Never instantiate BCryptPasswordEncoder directly in this controller.
 * Always use the injected PasswordEncoder bean which is configured in SecurityConfig as:
 *   new BCryptPasswordEncoder(BCryptVersion.$2B, 13)
 * This keeps encoding consistent with the legacy portal and existing DB hashes.
 */
@RestController
@CrossOrigin(origins = "http://localhost:5173")
@RequestMapping("/auth")
public class AuthController {

    private final AuthenticationManager authenticationManager;
    /**
     * Injected bean = BCryptPasswordEncoder(BCryptVersion.$2B, 13)
     * configured in SecurityConfig – same version/strength as portal SecurityConfig line 235 and line 328.
     * Used for change-password verification and encoding; never instantiated inline.
     */
    private final PasswordEncoder passwordEncoder;
    private final UserRepository userRepository;
    private final PasswordChangeOtpService passwordChangeOtpService;

public AuthController(AuthenticationManager authenticationManager,
                          PasswordEncoder passwordEncoder,
                          UserRepository userRepository,
                          PasswordChangeOtpService passwordChangeOtpService) {
        this.authenticationManager = authenticationManager;
        this.passwordEncoder = passwordEncoder;
        this.userRepository = userRepository;
        this.passwordChangeOtpService = passwordChangeOtpService;
    }

    // -------------------------------------------------------------------------
    // Login
    // -------------------------------------------------------------------------

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody AuthLoginRequest request,
                                              HttpServletRequest httpRequest) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(request.username(), request.password()));
            SecurityContextHolder.getContext().setAuthentication(authentication);
            httpRequest.getSession(true).setAttribute(
                    HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                    SecurityContextHolder.getContext());
            return ResponseEntity.ok(new AuthResponse(true, toView(authentication), "Login successful"));
        } catch (DisabledException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(false, null, "Account is disabled"));
        } catch (LockedException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(false, null, "Account is locked"));
        } catch (BadCredentialsException ex) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(false, null, "Invalid username or password"));
        }
    }

    // -------------------------------------------------------------------------
    // Logout
    // -------------------------------------------------------------------------

    @PostMapping("/logout")
    public ResponseEntity<AuthResponse> logout(HttpServletRequest request, HttpServletResponse response) {
        SecurityContextHolder.clearContext();
        var session = request.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return ResponseEntity.ok(new AuthResponse(false, null, "Logged out"));
    }

    // -------------------------------------------------------------------------
    // Current user
    // -------------------------------------------------------------------------

    @GetMapping("/me")
    public ResponseEntity<AuthResponse> me(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(false, null, "Not authenticated"));
        }
        // Re-fetch from DB so lastTenantId / lastCompanyId are current
        User sessionUser = (User) authentication.getPrincipal();
        User dbUser = userRepository.findByUsernameIgnoreCase(sessionUser.getUsername()).orElse(sessionUser);
        dbUser.setAuthorities(sessionUser.getAuthorities());
        return ResponseEntity.ok(new AuthResponse(true, toView(dbUser), "Authenticated"));
    }

    // -------------------------------------------------------------------------
    // Save last-used tenant + company for the current user
    // PATCH /auth/last-context  { "tenantId": "...", "companyId": "..." }
    // -------------------------------------------------------------------------

    public record LastContextRequest(String tenantId, String companyId) {}

    @PatchMapping("/last-context")
    public ResponseEntity<AuthResponse> saveLastContext(
            @RequestBody LastContextRequest request,
            Authentication authentication) {

        if (authentication == null || !(authentication.getPrincipal() instanceof User sessionUser)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(false, null, "Not authenticated"));
        }

        User user = userRepository.findByUsernameIgnoreCase(sessionUser.getUsername()).orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new AuthResponse(false, null, "User not found"));
        }

        // Always mirror exactly what the frontend has selected.
        // Non-null + non-blank  → save the value.
        // Null or blank         → clear the field (null in DB).
        // This ensures the DB never holds a stale context after the user
        // changes or clears either the tenant or the company.
        user.setLastTenantId(
            (request.tenantId() != null && !request.tenantId().isBlank())
                ? request.tenantId() : null);
        user.setLastCompanyId(
            (request.companyId() != null && !request.companyId().isBlank())
                ? request.companyId() : null);
        userRepository.save(user);

        user.setAuthorities(sessionUser.getAuthorities());
        return ResponseEntity.ok(new AuthResponse(true, toView(user), "Context saved"));
    }

    // -------------------------------------------------------------------------
    // Change password  (mirrors portal GreetingController#profile-update-password)
    //
    // Uses injected PasswordEncoder bean (BCrypt $2B / 13) for both:
    //   - matches(currentPassword, storedHash)   – verifies old password
    //   - encode(newPassword)                    – stores new hash
    // This is identical to how the portal does it except the portal instantiates
    // BCryptPasswordEncoder inline; we use the bean to avoid version drift.
    // -------------------------------------------------------------------------

    public record ChangePasswordRequest(
            @NotBlank String currentPassword,
            @NotBlank String newPassword) {}

    public record PasswordOtpResponse(boolean success, String message, String email, Long expiresInSeconds) {}
    public record ConfirmPasswordOtpRequest(
            @NotBlank String otp,
            @NotBlank String newPassword,
            @NotBlank String confirmPassword) {}

    @PostMapping("/password-otp/request")
    public ResponseEntity<PasswordOtpResponse> requestPasswordOtp(Authentication authentication) {
        User user = currentDbUser(authentication);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new PasswordOtpResponse(false, "Not authenticated", null, null));
        }
        try {
            PasswordChangeOtpService.OtpRequestResult result = passwordChangeOtpService.request(user);
            return ResponseEntity.ok(new PasswordOtpResponse(true, "OTP sent", result.maskedEmail(), result.expiresInSeconds()));
        } catch (PasswordChangeOtpService.OtpException ex) {
            return ResponseEntity.status(ex.status()).body(new PasswordOtpResponse(false, ex.getMessage(), null, null));
        }
    }

    @PostMapping("/password-otp/confirm")
    public ResponseEntity<AuthResponse> confirmPasswordOtp(
            @Valid @RequestBody ConfirmPasswordOtpRequest request,
            Authentication authentication) {
        User user = currentDbUser(authentication);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(false, null, "Not authenticated"));
        }
        if (request.newPassword().length() < 8) {
            return ResponseEntity.badRequest().body(new AuthResponse(false, null, "New password must be at least 8 characters"));
        }
        if (!request.newPassword().equals(request.confirmPassword())) {
            return ResponseEntity.badRequest().body(new AuthResponse(false, null, "Password confirmation does not match"));
        }
        try {
            passwordChangeOtpService.verifyAndConsume(user.getId(), request.otp());
        } catch (PasswordChangeOtpService.OtpException ex) {
            return ResponseEntity.status(ex.status()).body(new AuthResponse(false, null, ex.getMessage()));
        }
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        return ResponseEntity.ok(new AuthResponse(true, null, "Password changed successfully"));
    }
    @PostMapping("/change-password")
    public ResponseEntity<AuthResponse> changePassword(
            @Valid @RequestBody ChangePasswordRequest request,
            Authentication authentication) {

        if (authentication == null || !(authentication.getPrincipal() instanceof User sessionUser)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(false, null, "Not authenticated"));
        }

        if (!StringUtils.hasText(request.newPassword()) || request.newPassword().length() < 6) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(new AuthResponse(false, null, "New password must be at least 6 characters"));
        }

        User user = userRepository.findByUsernameIgnoreCase(sessionUser.getUsername())
                .orElse(null);
        if (user == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND)
                    .body(new AuthResponse(false, null, "User not found"));
        }

        // passwordEncoder.matches uses BCrypt $2B / 13 – same as portal line 5528
        if (!passwordEncoder.matches(request.currentPassword(), user.getPassword())) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(new AuthResponse(false, null, "Current password is incorrect"));
        }

        // passwordEncoder.encode uses BCrypt $2B / 13 – same as portal line 5530
        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);

        return ResponseEntity.ok(new AuthResponse(true, null, "Password changed successfully"));
    }

    // -------------------------------------------------------------------------
    // Internal helpers
    // -------------------------------------------------------------------------

    private User currentDbUser(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User sessionUser)) return null;
        return userRepository.findByUsernameIgnoreCase(sessionUser.getUsername()).orElse(null);
    }
    private AuthUserView toView(Authentication authentication) {
        User user = (User) authentication.getPrincipal();
        return toView(user);
    }

    private AuthUserView toView(User user) {
        List<String> authorities = user.getAuthorities() == null ? List.of() : user.getAuthorities().stream()
                .map(Authority::getAuthority)
                .sorted()
                .toList();
        return new AuthUserView(user.getId(), user.getUsername(), user.getFirstName(),
                user.getLastName(), user.getEmail(), user.isEnabled(), authorities,
                user.getLastTenantId(), user.getLastCompanyId(), user.getAssignedTenantId(), user.getAssignedCompanyId());
    }
}
