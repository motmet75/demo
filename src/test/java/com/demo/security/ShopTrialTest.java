package com.demo.security;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.user.Authority;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.*;
import com.ams.bomcore.service.CompanyUsageService;
import com.ams.bomcore.service.shop.ShopSetupService;
import com.demo.invoicedesk.InvoiceDeskRoleAccessService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.server.ResponseStatusException;

class ShopTrialTest {
    final UserRepository users = mock(UserRepository.class);
    final TenantRepository tenants = mock(TenantRepository.class);
    final CompanyRepository companies = mock(CompanyRepository.class);
    final AuthorityRepository authorities = mock(AuthorityRepository.class);
    final InvoiceDeskRoleAccessService invoices = mock(InvoiceDeskRoleAccessService.class);

    @AfterEach void cleanup() { SecurityContextHolder.clearContext(); }

    @Test void googleSignupCreatesScopedAdminWithSixteenDays() {
        when(tenants.save(any())).thenAnswer(i -> { Tenant t = i.getArgument(0); t.setId(UUID.randomUUID()); return t; });
        when(companies.save(any())).thenAnswer(i -> { Company c = i.getArgument(0); c.setId(UUID.randomUUID()); return c; });
        when(users.save(any())).thenAnswer(i -> i.getArgument(0));
        var service = new GoogleOAuth2UserService(users, tenants, companies, authorities,
            mock(NewUserNotificationService.class), invoices);
        Instant before = Instant.now().plus(16, ChronoUnit.DAYS);
        User user = service.createNewGoogleUser("new@example.com", "New", "Owner", "");
        assertNotNull(user.getAssignedTenantId());
        assertNotNull(user.getAssignedCompanyId());
        verify(companies).save(argThat(c -> !c.getValidUntil().isBefore(before)
            && !c.getValidUntil().isAfter(Instant.now().plus(16, ChronoUnit.DAYS))));
        verify(authorities).saveAndFlush(argThat(a -> a.getAuthority().equals("ROLE_ADMIN")));
    }

    @Test void initializeGrantsAdminImmediatelyAndRetryDoesNotRenewTrial() {
        User user = new User(); user.setUsername("owner");
        when(users.findByUsernameIgnoreCase("owner")).thenReturn(Optional.of(user));
        when(tenants.saveAndFlush(any())).thenAnswer(i -> { Tenant t = i.getArgument(0); t.setId(UUID.randomUUID()); return t; });
        when(companies.saveAndFlush(any())).thenAnswer(i -> { Company c = i.getArgument(0); c.setId(UUID.randomUUID()); return c; });
        when(authorities.findByUsername("owner")).thenReturn(List.of());
        when(authorities.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        var controller = new ProfileController(tenants, companies, users, mock(ShopSetupService.class), invoices, authorities);
        var auth = UsernamePasswordAuthenticationToken.authenticated(user, null, List.of());
        var request = new MockHttpServletRequest();
        Instant before = Instant.now().plus(16, ChronoUnit.DAYS);
        assertTrue(controller.initializeShop(auth, request).getBody().success());
        assertTrue(SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
            .anyMatch(a -> a.getAuthority().equals("ROLE_ADMIN")));
        assertNotNull(request.getSession().getAttribute("SPRING_SECURITY_CONTEXT"));
        assertTrue(controller.initializeShop(auth, request).getBody().success());
        verify(companies, times(1)).saveAndFlush(argThat(c -> !c.getValidUntil().isBefore(before)));
        verify(authorities, times(1)).saveAndFlush(any());
    }

    @Test void expiredShopAdminCannotUseBusinessEndpointsButActiveShopCan() {
        User user = new User(); user.setAssignedCompanyId(UUID.randomUUID().toString());
        Authority role = new Authority(); role.setAuthority("ROLE_ADMIN");
        SecurityContextHolder.getContext().setAuthentication(
            UsernamePasswordAuthenticationToken.authenticated(user, null, List.of(role)));
        Company company = new Company(); company.setValidUntil(Instant.now().minusSeconds(1));
        when(companies.findById(any())).thenReturn(Optional.of(company));
        var interceptor = new ShopTrialInterceptor(companies, new CompanyUsageService(companies));
        assertEquals(402, assertThrows(ResponseStatusException.class,
            () -> interceptor.preHandle(null, null, null)).getStatusCode().value());
        company.setValidUntil(Instant.now().plusSeconds(60));
        assertTrue(interceptor.preHandle(null, null, null));
    }
}
