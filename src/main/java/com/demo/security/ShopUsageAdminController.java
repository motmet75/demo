package com.demo.security;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.service.CompanyUsageService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.UUID;

@RestController
@RequestMapping("/auth/admin")
@PreAuthorize("hasRole('ADMIN')")
public class ShopUsageAdminController {

    private final CompanyUsageService companyUsageService;

    public ShopUsageAdminController(CompanyUsageService companyUsageService) {
        this.companyUsageService = companyUsageService;
    }

    @PostMapping("/extend-validity")
    public CompanyValidityResponse extendValidity(@RequestBody ExtendValidityRequest request) {
        if (request == null || request.companyId() == null) {
            throw new IllegalArgumentException("companyId is required");
        }
        int days = request.days() == null ? 30 : request.days();
        Company company = companyUsageService.extendValidity(request.companyId(), days);
        return toResponse(company, "Company usage enabled until " + company.getValidUntil());
    }

    private CompanyValidityResponse toResponse(Company company, String message) {
        return new CompanyValidityResponse(
                company.getId(),
                company.getCompanyCode(),
                company.getCompanyName(),
                company.getValidUntil(),
                companyUsageService.isExpired(company),
                companyUsageService.isUsable(company),
                message
        );
    }

    public record ExtendValidityRequest(UUID companyId, Integer days) {}

    public record CompanyValidityResponse(
            UUID companyId,
            String companyCode,
            String companyName,
            Instant validUntil,
            boolean expired,
            boolean usageEnabled,
            String message
    ) {}
}
