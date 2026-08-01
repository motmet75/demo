package com.ams.bomcore.controller.tenant;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;

@RestController
@CrossOrigin(origins = "*", allowCredentials = "false")
@RequestMapping("/bom/tenants")
public class TenantController {

    private static final Logger log = LoggerFactory.getLogger(TenantController.class);

    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;

    public TenantController(TenantRepository tenantRepository, CompanyRepository companyRepository) {
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
    }

    @GetMapping
    public ResponseEntity<?> list() {
        try {
            List<TenantDto> result = tenantRepository.findAll().stream()
                    .map(t -> toDto(t, null))
                    .collect(Collectors.toList());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Failed to list tenants", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ErrorDto("Failed to load tenants: " + e.getMessage()));
        }
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ResponseEntity<?> create(@RequestBody CreateTenantDto dto) {
        var existing = tenantRepository.findByTenantCode(dto.tenantCode);
        if (existing.isPresent()) {
			return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("tenantCode already exists"));
		}
        Tenant t = new Tenant();
        t.setTenantCode(dto.tenantCode);
        t.setTenantName(dto.tenantName);
        t.setIsActive(dto.isActive == null ? Boolean.TRUE : dto.isActive);
        t.setMaxCompanies(dto.maxCompanies == null || dto.maxCompanies < 1 ? 1 : dto.maxCompanies);
        tenantRepository.save(t);

        Company company = new Company();
        company.setTenant(t);
        company.setCompanyCode(hasText(dto.companyCode) ? dto.companyCode.trim() : dto.tenantCode.trim());
        company.setCompanyName(hasText(dto.companyName) ? dto.companyName.trim() : dto.tenantName.trim());
        companyRepository.save(company);

        return ResponseEntity.status(HttpStatus.CREATED).body(toDto(t, company.getId()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable("id") UUID id, @RequestBody CreateTenantDto dto) {
        var opt = tenantRepository.findById(id);
        if (opt.isEmpty()) {
			return ResponseEntity.notFound().build();
		}
        var t = opt.get();
        if (dto.tenantCode != null && !dto.tenantCode.equals(t.getTenantCode())) {
            var conflict = tenantRepository.findByTenantCode(dto.tenantCode);
            if (conflict.isPresent() && !conflict.get().getId().equals(id)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("tenantCode already exists"));
            }
            t.setTenantCode(dto.tenantCode);
        }
        if (dto.tenantName != null) {
			t.setTenantName(dto.tenantName);
		}
        if (dto.isActive != null) {
			t.setIsActive(dto.isActive);
		}
        if (dto.maxCompanies != null && dto.maxCompanies >= 1) {
			t.setMaxCompanies(dto.maxCompanies);
		}
        tenantRepository.save(t);
        return ResponseEntity.ok(toDto(t, null));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> activate(@PathVariable("id") UUID id, @RequestBody ActivateDto dto) {
        var opt = tenantRepository.findById(id);
        if (opt.isEmpty()) {
			return ResponseEntity.notFound().build();
		}
        var t = opt.get();
        t.setIsActive(dto.isActive == null ? Boolean.TRUE : dto.isActive);
        tenantRepository.save(t);
        return ResponseEntity.ok(toDto(t, null));
    }

    private TenantDto toDto(Tenant tenant, UUID companyId) {
        return new TenantDto(tenant.getId(), companyId, tenant.getTenantCode(), tenant.getTenantName(),
                tenant.getIsActive(), tenant.getMaxCompanies(), tenant.getCreatedAt());
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    public static class TenantDto {
        public final UUID id;
        public final UUID companyId;
        public final String tenantCode;
        public final String tenantName;
        public final Boolean isActive;
        public final Integer maxCompanies;
        public final java.time.Instant createdAt;
        public TenantDto(UUID id, UUID companyId, String tenantCode, String tenantName, Boolean isActive, Integer maxCompanies, java.time.Instant createdAt) {
            this.id = id; this.companyId = companyId; this.tenantCode = tenantCode; this.tenantName = tenantName;
            this.isActive = isActive; this.maxCompanies = maxCompanies; this.createdAt = createdAt;
        }
    }

    public static class CreateTenantDto {
        public String tenantCode;
        public String tenantName;
        public Boolean isActive;
        public Integer maxCompanies;
        public String companyCode;
        public String companyName;
    }

    public static class ActivateDto {
        public Boolean isActive;
    }

    public static class ErrorDto {
        public final String message;
        public ErrorDto(String message) { this.message = message; }
    }
}
