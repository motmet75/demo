package com.demo.security;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import com.ams.bomcore.domain.user.Authority;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.AuthorityRepository;
import com.ams.bomcore.repository.UserRepository;

@Service
@Transactional
public class AdminUserService {

    private static final String ROLE_SUPER_ADMIN = "ROLE_SUPER_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";
    private static final String ROLE_USER = "ROLE_USER";
    private static final String ROLE_SHOP_ORDERING = "ROLE_SHOP_ORDERING";
    private static final String ROLE_COUNTER = "ROLE_COUNTER";

    private final UserRepository userRepository;
    private final AuthorityRepository authorityRepository;
    private final PasswordEncoder passwordEncoder;
    private final NewUserNotificationService newUserNotificationService;

    public AdminUserService(UserRepository userRepository,
                            AuthorityRepository authorityRepository,
                            PasswordEncoder passwordEncoder,
                            NewUserNotificationService newUserNotificationService) {
        this.userRepository = userRepository;
        this.authorityRepository = authorityRepository;
        this.passwordEncoder = passwordEncoder;
        this.newUserNotificationService = newUserNotificationService;
    }

    public List<AuthUserView> findAllUsers() {
        User actor = currentActor();
        boolean superAdmin = currentUserIsSuperAdmin();
        return userRepository.findAll().stream()
                .filter(user -> superAdmin || canRegularAdminManage(actor, user))
                .map(this::toView)
                .toList();
    }

    public AuthUserView createUser(AdminUserRequest request) {
        User actor = currentActor();
        boolean superAdmin = currentUserIsSuperAdmin();
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (!StringUtils.hasText(request.password())) {
            throw new IllegalArgumentException("Password is required for new user");
        }
        assertAllowedAuthorities(request.authorities(), superAdmin);

        User user = new User();
        user.setUsername(request.username().trim());
        user.setPassword(passwordEncoder.encode(request.password()));
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setEmail(request.email() == null ? "" : request.email().trim());
        user.setEnabled(request.enabled() == null ? true : request.enabled());
        user.setAccountNonExpired(true);
        user.setAccountNonLocked(true);
        user.setCredentialsNonExpired(true);
        user.setAssignedTenantId(scopedTenantId(actor, request.assignedTenantId(), superAdmin));
        user.setAssignedCompanyId(scopedCompanyId(actor, request.assignedCompanyId(), superAdmin));

        User saved = userRepository.save(user);
        replaceAuthoritiesInternal(saved.getUsername(), authoritiesForSave(request.authorities(), superAdmin));
        newUserNotificationService.notifyNewUser(saved, "admin");
        return toView(saved);
    }

    public AuthUserView updateUser(Integer id, AdminUserRequest request) {
        User actor = currentActor();
        boolean superAdmin = currentUserIsSuperAdmin();
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!superAdmin && !canRegularAdminManage(actor, user)) {
            throw new IllegalArgumentException("Only a super user can manage admin accounts or users outside this admin scope");
        }
        assertAllowedAuthorities(request.authorities(), superAdmin);

        String requestedUsername = request.username().trim();
        if (!user.getUsername().equalsIgnoreCase(requestedUsername) && userRepository.existsByUsernameIgnoreCase(requestedUsername)) {
            throw new IllegalArgumentException("Username already exists");
        }

        String previousUsername = user.getUsername();
        user.setUsername(requestedUsername);
        user.setFirstName(request.firstName().trim());
        user.setLastName(request.lastName().trim());
        user.setEmail(request.email() == null ? "" : request.email().trim());
        user.setEnabled(request.enabled() == null ? user.isEnabled() : request.enabled());
        if (StringUtils.hasText(request.password())) {
            user.setPassword(passwordEncoder.encode(request.password()));
        }
        user.setAssignedTenantId(scopedTenantId(actor, request.assignedTenantId(), superAdmin));
        user.setAssignedCompanyId(scopedCompanyId(actor, request.assignedCompanyId(), superAdmin));

        User saved = userRepository.save(user);
        if (!previousUsername.equals(saved.getUsername())) {
            List<Authority> existingAuthorities = authorityRepository.findByUsername(previousUsername);
            authorityRepository.deleteByUsername(previousUsername);
            for (Authority authority : existingAuthorities) {
                authority.setId(0);
                authority.setUsername(saved.getUsername());
                authorityRepository.save(authority);
            }
        }
        replaceAuthoritiesInternal(saved.getUsername(), authoritiesForSave(request.authorities(), superAdmin));
        return toView(saved);
    }

    public void deleteUser(Integer id) {
        User actor = currentActor();
        boolean superAdmin = currentUserIsSuperAdmin();
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!superAdmin && !canRegularAdminManage(actor, user)) {
            throw new IllegalArgumentException("Only a super user can delete admin accounts or users outside this admin scope");
        }
        authorityRepository.deleteByUsername(user.getUsername());
        userRepository.delete(user);
    }

    public List<String> getAuthorities(String username) {
        return authorityRepository.findByUsername(username).stream()
                .map(Authority::getAuthority)
                .sorted()
                .toList();
    }

    public List<String> replaceAuthorities(String username, List<String> authorities) {
        boolean superAdmin = currentUserIsSuperAdmin();
        if (!superAdmin) {
            throw new IllegalArgumentException("Only a super user can edit authorities directly");
        }
        assertAllowedAuthorities(authorities, true);
        return replaceAuthoritiesInternal(username, authoritiesForSave(authorities, true));
    }

    private List<String> replaceAuthoritiesInternal(String username, List<String> authorities) {
        authorityRepository.deleteByUsername(username);
        Set<String> normalized = normalizeAuthorities(authorities);
        List<Authority> saved = new ArrayList<>();
        for (String role : normalized) {
            Authority authority = new Authority();
            authority.setUsername(username);
            authority.setAuthority(role);
            authority.setDescription(role);
            authority.setVisible(Boolean.TRUE);
            saved.add(authorityRepository.save(authority));
        }
        return saved.stream().map(Authority::getAuthority).toList();
    }

    /** Admin-only: assign or clear a tenant for a user. */
    public AuthUserView assignTenant(Integer id, String tenantId) {
        User actor = currentActor();
        boolean superAdmin = currentUserIsSuperAdmin();
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (!superAdmin && !canRegularAdminManage(actor, user)) {
            throw new IllegalArgumentException("Only a super user can assign admin accounts or users outside this admin scope");
        }
        user.setAssignedTenantId(scopedTenantId(actor, tenantId, superAdmin));
        userRepository.save(user);
        return toView(user);
    }

    private AuthUserView toView(User user) {
        List<String> roles = getAuthorities(user.getUsername());
        return new AuthUserView(user.getId(), user.getUsername(), user.getFirstName(), user.getLastName(),
                user.getEmail(), user.isEnabled(), roles,
                user.getLastTenantId(), user.getLastCompanyId(), user.getAssignedTenantId(), user.getAssignedCompanyId());
    }

    private Set<String> normalizeAuthorities(List<String> authorities) {
        if (authorities == null) {
            return Set.of();
        }
        return authorities.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .map(value -> value.toUpperCase(Locale.ROOT))
                .map(value -> value.startsWith("ROLE_") ? value : "ROLE_" + value)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private List<String> authoritiesForSave(List<String> requested, boolean superAdmin) {
        if (superAdmin) {
            Set<String> normalized = normalizeAuthorities(requested);
            return normalized.isEmpty() ? List.of(ROLE_SHOP_ORDERING) : List.copyOf(normalized);
        }
        Set<String> normalized = normalizeAuthorities(requested);
        List<String> staffRoles = normalized.stream()
                .filter(role -> ROLE_USER.equals(role) || ROLE_COUNTER.equals(role) || ROLE_SHOP_ORDERING.equals(role))
                .toList();
        return staffRoles.isEmpty() ? List.of(ROLE_COUNTER) : staffRoles;
    }

    private void assertAllowedAuthorities(List<String> requested, boolean superAdmin) {
        if (superAdmin) return;
        Set<String> normalized = normalizeAuthorities(requested);
        if (normalized.stream().anyMatch(this::isElevatedRole)) {
            throw new IllegalArgumentException("Only a super user can grant admin roles");
        }
    }

    private boolean canRegularAdminManage(User actor, User target) {
        if (target == null || hasElevatedRole(target.getUsername())) return false;
        return isWithinScope(actor, target.getAssignedTenantId(), target.getAssignedCompanyId());
    }

    private boolean isWithinScope(User actor, String tenantId, String companyId) {
        if (actor == null) return false;
        String actorTenant = trimToNull(actor.getAssignedTenantId());
        String actorCompany = trimToNull(actor.getAssignedCompanyId());
        if (actorTenant != null && !actorTenant.equals(trimToNull(tenantId))) return false;
        if (actorCompany != null && !actorCompany.equals(trimToNull(companyId))) return false;
        return true;
    }

    private String scopedTenantId(User actor, String requestedTenantId, boolean superAdmin) {
        String requested = trimToNull(requestedTenantId);
        if (superAdmin || actor == null || !StringUtils.hasText(actor.getAssignedTenantId())) return requested;
        if (requested != null && !actor.getAssignedTenantId().equals(requested)) {
            throw new IllegalArgumentException("Cannot assign users outside your tenant");
        }
        return actor.getAssignedTenantId();
    }

    private String scopedCompanyId(User actor, String requestedCompanyId, boolean superAdmin) {
        String requested = trimToNull(requestedCompanyId);
        if (superAdmin || actor == null || !StringUtils.hasText(actor.getAssignedCompanyId())) return requested;
        if (requested != null && !actor.getAssignedCompanyId().equals(requested)) {
            throw new IllegalArgumentException("Cannot assign users outside your company");
        }
        return actor.getAssignedCompanyId();
    }

    private boolean currentUserIsSuperAdmin() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch(ROLE_SUPER_ADMIN::equals);
    }

    private User currentActor() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        Object principal = authentication != null ? authentication.getPrincipal() : null;
        return principal instanceof User user ? user : null;
    }

    private boolean hasElevatedRole(String username) {
        return getAuthorities(username).stream().anyMatch(this::isElevatedRole);
    }

    private boolean isElevatedRole(String role) {
        return ROLE_SUPER_ADMIN.equals(role) || ROLE_ADMIN.equals(role);
    }

    private String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
