package com.demo.security;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.security.crypto.password.PasswordEncoder;
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
        return userRepository.findAll().stream()
                .map(this::toView)
                .toList();
    }

    public AuthUserView createUser(AdminUserRequest request) {
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new IllegalArgumentException("Username already exists");
        }
        if (!StringUtils.hasText(request.password())) {
            throw new IllegalArgumentException("Password is required for new user");
        }

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
        if (StringUtils.hasText(request.assignedTenantId())) {
            user.setAssignedTenantId(request.assignedTenantId().trim());
        }
        if (StringUtils.hasText(request.assignedCompanyId())) {
            user.setAssignedCompanyId(request.assignedCompanyId().trim());
        }

        User saved = userRepository.save(user);
        replaceAuthorities(saved.getUsername(), request.authorities());
        newUserNotificationService.notifyNewUser(saved, "admin");
        return toView(saved);
    }

    public AuthUserView updateUser(Integer id, AdminUserRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

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
        // update assigned tenant (null or blank = clear it)
        user.setAssignedTenantId(StringUtils.hasText(request.assignedTenantId()) ? request.assignedTenantId().trim() : null);
        // update assigned company (null or blank = clear it)
        user.setAssignedCompanyId(StringUtils.hasText(request.assignedCompanyId()) ? request.assignedCompanyId().trim() : null);

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
        replaceAuthorities(saved.getUsername(), request.authorities());
        return toView(saved);
    }

    public void deleteUser(Integer id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
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
        User user = userRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        user.setAssignedTenantId(StringUtils.hasText(tenantId) ? tenantId.trim() : null);
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
}