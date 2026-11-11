package com.ams.bomcore.service.portalcontent;

import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.UserRepository;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@Service
public class PortalContentAccessService {
    private final PortalTenantDataSourceRegistry registry;
    private final UserRepository users;
    private final TenantRepository tenants;

    public PortalContentAccessService(PortalTenantDataSourceRegistry registry, UserRepository users, TenantRepository tenants) {
        this.registry = registry;
        this.users = users;
        this.tenants = tenants;
    }

    public List<String> allowedTenants(Authentication authentication) {
        List<String> configured = registry.tenantIds();
        if (hasRole(authentication, "ROLE_SUPER_ADMIN")) return configured;
        if (!hasRole(authentication, "ROLE_ADMIN") || authentication == null) return List.of();
        var user = users.findByUsernameIgnoreCase(authentication.getName()).orElse(null);
        if (user == null || user.getAssignedTenantId() == null) return List.of();
        final UUID assignedId;
        try { assignedId = UUID.fromString(user.getAssignedTenantId()); }
        catch (IllegalArgumentException exception) { return List.of(); }
        var tenant = tenants.findById(assignedId).orElse(null);
        if (tenant == null) return List.of();
        String website = tenant.getPortalContentTenant();
        // Access must be explicitly assigned by SUPER_ADMIN. Do not infer a
        // website database from the business tenant code.
        if (website == null || website.isBlank()) return List.of();
        String normalized = website.trim().toLowerCase(Locale.ROOT);
        return configured.contains(normalized) ? List.of(normalized) : List.of();
    }

    public void require(Authentication authentication, String tenantId) {
        String normalized = PortalTenantDataSourceRegistry.normalizeTenantId(tenantId);
        if (!allowedTenants(authentication).contains(normalized))
            throw new org.springframework.security.access.AccessDeniedException("Portal tenant is not assigned to this admin");
    }

    private boolean hasRole(Authentication authentication, String role) {
        if (authentication == null) return false;
        Set<String> roles = authentication.getAuthorities().stream()
                .map(authority -> authority.getAuthority()).collect(java.util.stream.Collectors.toSet());
        return roles.contains(role);
    }
}
