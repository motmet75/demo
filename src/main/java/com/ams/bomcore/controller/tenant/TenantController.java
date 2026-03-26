package com.ams.bomcore.controller.tenant;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.TenantRepository;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
@RequestMapping("/bom/tenants")
public class TenantController {

    private final TenantRepository tenantRepository;

    public TenantController(TenantRepository tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    @GetMapping
    public List<TenantDto> list() {
        return tenantRepository.findAll().stream()
                .map(t -> new TenantDto(t.getId(), t.getTenantCode(), t.getTenantName(), t.getIsActive(), t.getMaxCompanies(), t.getCreatedAt()))
                .collect(Collectors.toList());
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> create(@RequestBody CreateTenantDto dto) {
        var existing = tenantRepository.findByTenantCode(dto.tenantCode);
        if (existing.isPresent()) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("tenantCode already exists"));
        Tenant t = new Tenant();
        t.setTenantCode(dto.tenantCode);
        t.setTenantName(dto.tenantName);
        t.setIsActive(dto.isActive == null ? Boolean.TRUE : dto.isActive);
        t.setMaxCompanies(dto.maxCompanies == null || dto.maxCompanies < 1 ? 1 : dto.maxCompanies);
        tenantRepository.save(t);
        return ResponseEntity.status(HttpStatus.CREATED).body(new TenantDto(t.getId(), t.getTenantCode(), t.getTenantName(), t.getIsActive(), t.getMaxCompanies(), t.getCreatedAt()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> update(@PathVariable("id") UUID id, @RequestBody CreateTenantDto dto) {
        var opt = tenantRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        var t = opt.get();
        if (dto.tenantCode != null && !dto.tenantCode.equals(t.getTenantCode())) {
            var conflict = tenantRepository.findByTenantCode(dto.tenantCode);
            if (conflict.isPresent() && !conflict.get().getId().equals(id)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("tenantCode already exists"));
            }
            t.setTenantCode(dto.tenantCode);
        }
        if (dto.tenantName != null) t.setTenantName(dto.tenantName);
        if (dto.isActive != null) t.setIsActive(dto.isActive);
        if (dto.maxCompanies != null && dto.maxCompanies >= 1) t.setMaxCompanies(dto.maxCompanies);
        tenantRepository.save(t);
        return ResponseEntity.ok(new TenantDto(t.getId(), t.getTenantCode(), t.getTenantName(), t.getIsActive(), t.getMaxCompanies(), t.getCreatedAt()));
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<?> activate(@PathVariable("id") UUID id, @RequestBody ActivateDto dto) {
        var opt = tenantRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        var t = opt.get();
        t.setIsActive(dto.isActive == null ? Boolean.TRUE : dto.isActive);
        tenantRepository.save(t);
        return ResponseEntity.ok(new TenantDto(t.getId(), t.getTenantCode(), t.getTenantName(), t.getIsActive(), t.getMaxCompanies(), t.getCreatedAt()));
    }

    public static class TenantDto {
        public final UUID id;
        public final String tenantCode;
        public final String tenantName;
        public final Boolean isActive;
        public final Integer maxCompanies;
        public final java.time.Instant createdAt;
        public TenantDto(UUID id, String tenantCode, String tenantName, Boolean isActive, Integer maxCompanies, java.time.Instant createdAt) {
            this.id = id; this.tenantCode = tenantCode; this.tenantName = tenantName;
            this.isActive = isActive; this.maxCompanies = maxCompanies; this.createdAt = createdAt;
        }
    }

    public static class CreateTenantDto {
        public String tenantCode;
        public String tenantName;
        public Boolean isActive;
        public Integer maxCompanies;
    }

    public static class ActivateDto {
        public Boolean isActive;
    }

    public static class ErrorDto {
        public final String message;
        public ErrorDto(String message) { this.message = message; }
    }
}