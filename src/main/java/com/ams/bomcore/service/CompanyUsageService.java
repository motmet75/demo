package com.ams.bomcore.service;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.repository.CompanyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

@Service
public class CompanyUsageService {

    public static final String EXPIRED_MESSAGE = "Company usage time expired. Ask an admin to extend it.";

    private final CompanyRepository companyRepository;

    public CompanyUsageService(CompanyRepository companyRepository) {
        this.companyRepository = companyRepository;
    }

    public boolean isExpired(Company company) {
        return company != null
                && company.getValidUntil() != null
                && !company.getValidUntil().isAfter(Instant.now());
    }

    public boolean isUsable(Company company) {
        return !isExpired(company);
    }

    public void requireUsable(Company company) {
        if (isExpired(company)) {
            throw new ResponseStatusException(HttpStatus.PAYMENT_REQUIRED, EXPIRED_MESSAGE);
        }
    }

    public Company requireScopedUsableCompany(UUID tenantId, UUID companyId) {
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found"));
        if (company.getTenant() == null || !tenantId.equals(company.getTenant().getId())) {
            throw new IllegalArgumentException("Company does not belong to tenant");
        }
        requireUsable(company);
        return company;
    }

    @Transactional
    public Company extendValidity(UUID companyId, int days) {
        if (days < 1) {
            throw new IllegalArgumentException("days must be at least 1");
        }
        Company company = companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found"));
        Instant now = Instant.now();
        Instant base = company.getValidUntil() != null && company.getValidUntil().isAfter(now)
                ? company.getValidUntil()
                : now;
        company.setValidUntil(base.plus(days, ChronoUnit.DAYS));
        return companyRepository.save(company);
    }
}
