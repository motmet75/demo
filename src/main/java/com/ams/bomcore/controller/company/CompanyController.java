package com.ams.bomcore.controller.company;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
@RequestMapping("/bom/api/companies")
public class CompanyController {

    private final CompanyRepository companyRepository;
    private final TenantRepository tenantRepository;

    public CompanyController(CompanyRepository companyRepository, TenantRepository tenantRepository) {
        this.companyRepository = companyRepository;
        this.tenantRepository = tenantRepository;
    }

    @GetMapping
    public List<CompanyDto> list(@RequestParam(value = "tenantId", required = false) UUID tenantId,
                                 @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        // prefer header if present
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try {
                tenantId = UUID.fromString(headerTenantId);
            } catch (Exception e) {
                // ignore and fall through to query param
            }
        }

        if (tenantId == null) {
            throw new IllegalArgumentException("tenantId is required");
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));

        List<Company> companies = companyRepository.findAllByTenant(tenant);
        return companies.stream().map(c -> new CompanyDto(c.getId(), c.getCompanyCode(), c.getCompanyName())).collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateCompanyDto dto, @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId) {
        UUID tenantId = null;
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { tenantId = UUID.fromString(headerTenantId); } catch (Exception e) { }
        }
        if (dto.tenantId != null) tenantId = dto.tenantId;
        if (tenantId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("tenantId is required"));
        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));

        // unique code check
        var existing = companyRepository.findByCompanyCodeAndTenantId(dto.companyCode, tenant.getId());
        if (existing.isPresent()) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("companyCode already exists for tenant"));

        Company c = new Company();
        c.setTenant(tenant);
        c.setCompanyCode(dto.companyCode);
        c.setCompanyName(dto.companyName);
        companyRepository.save(c);
        return ResponseEntity.status(HttpStatus.CREATED).body(new CompanyDto(c.getId(), c.getCompanyCode(), c.getCompanyName()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") UUID id, @RequestBody CreateCompanyDto dto) {
        var opt = companyRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        var c = opt.get();
        if (dto.companyCode != null && !dto.companyCode.equals(c.getCompanyCode())) {
            // determine tenant id to scope uniqueness check (use dto.tenantId if changing tenant)
            UUID scopeTenantId = dto.tenantId != null ? dto.tenantId : (c.getTenant() != null ? c.getTenant().getId() : null);
            var conflict = scopeTenantId != null ? companyRepository.findByCompanyCodeAndTenantId(dto.companyCode, scopeTenantId) : companyRepository.findByCompanyCode(dto.companyCode);
            if (conflict.isPresent() && !conflict.get().getId().equals(id)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("companyCode already exists for tenant"));
            }
            c.setCompanyCode(dto.companyCode);
        }
        if (dto.companyName != null) c.setCompanyName(dto.companyName);
        // allow changing tenant if provided
        if (dto.tenantId != null) {
            Tenant t = tenantRepository.findById(dto.tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
            c.setTenant(t);
        }
        companyRepository.save(c);
        return ResponseEntity.ok(new CompanyDto(c.getId(), c.getCompanyCode(), c.getCompanyName()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") UUID id) {
        var opt = companyRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        companyRepository.delete(opt.get());
        return ResponseEntity.noContent().build();
    }

    public static class CompanyDto {
        public final UUID id;
        public final String code;
        public final String name;
        public CompanyDto(UUID id, String code, String name) { this.id = id; this.code = code; this.name = name; }
    }

    public static class CreateCompanyDto {
        public UUID tenantId;
        public String companyCode;
        public String companyName;
    }

    public static class ErrorDto {
        public final String message;
        public ErrorDto(String message) { this.message = message; }
    }
}