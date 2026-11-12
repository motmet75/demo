package com.demo.security;

import java.util.UUID;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.service.CompanyUsageService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

/** Enforces company validity even on business endpoints without context headers. */
@Component
public class ShopTrialInterceptor implements HandlerInterceptor {
    private final CompanyRepository companies;
    private final CompanyUsageService usage;

    public ShopTrialInterceptor(CompanyRepository companies, CompanyUsageService usage) {
        this.companies = companies;
        this.usage = usage;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        var auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof User user)
                || auth.getAuthorities().stream().anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()))) {
            return true;
        }
        String companyId = user.getAssignedCompanyId();
        if (companyId != null && !companyId.isBlank()) {
            companies.findById(UUID.fromString(companyId)).ifPresent(usage::requireUsable);
        }
        return true;
    }
}
