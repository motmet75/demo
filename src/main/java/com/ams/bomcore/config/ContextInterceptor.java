package com.ams.bomcore.config;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import com.ams.bomcore.context.TenantContext;
import com.ams.bomcore.context.UserContext;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.CompanyUsageService;
import com.ams.bomcore.service.TenantValidationService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
public class ContextInterceptor implements HandlerInterceptor {

    private final CompanyRepository companyRepository;
    private final TenantRepository tenantRepository;
    private final TenantValidationService tenantValidationService;
    private final CompanyUsageService companyUsageService;

    public ContextInterceptor(CompanyRepository companyRepository,
                              TenantRepository tenantRepository,
                              TenantValidationService tenantValidationService,
                              CompanyUsageService companyUsageService) {
        this.companyRepository = companyRepository;
        this.tenantRepository = tenantRepository;
        this.tenantValidationService = tenantValidationService;
        this.companyUsageService = companyUsageService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String path = request.getRequestURI();
        // allow public endpoints
        if (path.startsWith("/api/bom/tenants") || path.startsWith("/api/bom/companies")) {
			return true;
		}

        String tenantHeader = request.getHeader("X-Tenant-Id");
        String companyHeader = request.getHeader("X-Company-Id");

        if (tenantHeader == null || tenantHeader.isBlank()) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Missing X-Tenant-Id header");
            return false;
        }

        // validate tenant exists and is active
        if (!tenantValidationService.existsAndActive(tenantHeader)) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Invalid or inactive tenant");
            return false;
        }

        // set tenant context for downstream services/repositories
        TenantContext.setTenantId(tenantHeader);

        // capture logged-in username from header (set by frontend/gateway)
        String usernameHeader = request.getHeader("X-Username");
        if (usernameHeader != null && !usernameHeader.isBlank()) {
            UserContext.setUsername(usernameHeader);
        }

        if (companyHeader == null || companyHeader.isBlank()) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Missing X-Company-Id header");
            return false;
        }

        // validate company belongs to tenant
        try {
            UUID companyId = UUID.fromString(companyHeader);
            var companyOpt = companyRepository.findById(companyId);
            if (companyOpt.isEmpty()) {
                response.sendError(HttpStatus.BAD_REQUEST.value(), "Company not found");
                return false;
            }
            var company = companyOpt.get();
            var tenant = company.getTenant();
            if (tenant == null || tenant.getId() == null) {
                response.sendError(HttpStatus.BAD_REQUEST.value(), "Company has no tenant");
                return false;
            }
            UUID tenantUuid;
            try {
                tenantUuid = UUID.fromString(tenantHeader);
            } catch (IllegalArgumentException ex) {
                response.sendError(HttpStatus.BAD_REQUEST.value(), "Invalid UUID in tenant header");
                return false;
            }
            if (!tenant.getId().equals(tenantUuid)) {
                response.sendError(HttpStatus.BAD_REQUEST.value(), "Company does not belong to tenant");
                return false;
            }
            if (!companyUsageService.isUsable(company)) {
                response.setStatus(HttpStatus.PAYMENT_REQUIRED.value());
                response.setContentType("application/json");
                response.getWriter().write("{\"error\":\"" + CompanyUsageService.EXPIRED_MESSAGE
                        + "\",\"message\":\"" + CompanyUsageService.EXPIRED_MESSAGE
                        + "\",\"validUntil\":\"" + company.getValidUntil() + "\"}");
                return false;
            }
        } catch (IllegalArgumentException ex) {
            response.sendError(HttpStatus.BAD_REQUEST.value(), "Invalid UUID in headers");
            return false;
        }

        return true;
    }

    @Override
    public void afterCompletion(HttpServletRequest request, HttpServletResponse response, Object handler, Exception ex) throws Exception {
        TenantContext.clear();
        UserContext.clear();
    }
}
