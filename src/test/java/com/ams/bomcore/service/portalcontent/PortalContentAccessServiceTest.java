package com.ams.bomcore.service.portalcontent;

import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PortalContentAccessServiceTest {
    @Test
    void adminCanOnlyUseWebsiteBoundToAssignedTenant() {
        var registry = mock(PortalTenantDataSourceRegistry.class);
        var users = mock(UserRepository.class);
        var tenants = mock(TenantRepository.class);
        UUID tenantId = UUID.randomUUID();
        User user = new User(); user.setAssignedTenantId(tenantId.toString());
        Tenant tenant = new Tenant(); tenant.setId(tenantId); tenant.setPortalContentTenant("migiatruyen.vn");
        when(registry.tenantIds()).thenReturn(List.of("migiatruyen.vn", "other.vn"));
        when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.of(user));
        when(tenants.findById(tenantId)).thenReturn(Optional.of(tenant));
        var service = new PortalContentAccessService(registry, users, tenants);
        var authentication = new TestingAuthenticationToken("admin", "", "ROLE_ADMIN");

        assertEquals(List.of("migiatruyen.vn"), service.allowedTenants(authentication));
        service.require(authentication, "migiatruyen.vn");
        assertThrows(org.springframework.security.access.AccessDeniedException.class,
                () -> service.require(authentication, "other.vn"));
    }

    @Test
    void superAdminCanUseEveryConfiguredWebsiteTenant() {
        var registry = mock(PortalTenantDataSourceRegistry.class);
        when(registry.tenantIds()).thenReturn(List.of("migiatruyen.vn", "other.vn"));
        var service = new PortalContentAccessService(registry, mock(UserRepository.class), mock(TenantRepository.class));
        var authentication = new TestingAuthenticationToken("root", "", "ROLE_SUPER_ADMIN");
        assertEquals(List.of("migiatruyen.vn", "other.vn"), service.allowedTenants(authentication));
    }

    @Test
    void adminNeedsExplicitWebsiteAssignment() {
        var registry = mock(PortalTenantDataSourceRegistry.class);
        var users = mock(UserRepository.class);
        var tenants = mock(TenantRepository.class);
        UUID tenantId = UUID.randomUUID();
        User user = new User(); user.setAssignedTenantId(tenantId.toString());
        Tenant tenant = new Tenant(); tenant.setId(tenantId); tenant.setTenantCode("migiatruyen.vn");
        when(registry.tenantIds()).thenReturn(List.of("migiatruyen.vn"));
        when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.of(user));
        when(tenants.findById(tenantId)).thenReturn(Optional.of(tenant));
        var service = new PortalContentAccessService(registry, users, tenants);

        assertEquals(List.of(), service.allowedTenants(
                new TestingAuthenticationToken("admin", "", "ROLE_ADMIN")));
    }
}
