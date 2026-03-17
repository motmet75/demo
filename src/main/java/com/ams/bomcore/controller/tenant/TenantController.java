package com.ams.bomcore.controller.tenant;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
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
                .map(t -> new TenantDto(t.getId(), t.getTenantCode(), t.getTenantName(), t.getIsActive(), t.getCreatedAt()))
                .collect(Collectors.toList());
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody CreateTenantDto dto) {
        // validate unique code
        var existing = tenantRepository.findByTenantCode(dto.tenantCode);
        if (existing.isPresent()) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("tenantCode already exists"));
        Tenant t = new Tenant();
        t.setTenantCode(dto.tenantCode);
        t.setTenantName(dto.tenantName);
        t.setIsActive(dto.isActive == null ? Boolean.TRUE : dto.isActive);
        tenantRepository.save(t);
        return ResponseEntity.status(HttpStatus.CREATED).body(new TenantDto(t.getId(), t.getTenantCode(), t.getTenantName(), t.getIsActive(), t.getCreatedAt()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable("id") UUID id, @RequestBody CreateTenantDto dto) {
        var opt = tenantRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        var t = opt.get();
        // check unique code if changed
        if (dto.tenantCode != null && !dto.tenantCode.equals(t.getTenantCode())) {
            var conflict = tenantRepository.findByTenantCode(dto.tenantCode);
            if (conflict.isPresent() && !conflict.get().getId().equals(id)) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ErrorDto("tenantCode already exists"));
            }
            t.setTenantCode(dto.tenantCode);
        }
        if (dto.tenantName != null) t.setTenantName(dto.tenantName);
        if (dto.isActive != null) t.setIsActive(dto.isActive);
        tenantRepository.save(t);
        return ResponseEntity.ok(new TenantDto(t.getId(), t.getTenantCode(), t.getTenantName(), t.getIsActive(), t.getCreatedAt()));
    }

    @PatchMapping("/{id}/activate")
    public ResponseEntity<?> activate(@PathVariable("id") UUID id, @RequestBody ActivateDto dto) {
        var opt = tenantRepository.findById(id);
        if (opt.isEmpty()) return ResponseEntity.notFound().build();
        var t = opt.get();
        t.setIsActive(dto.isActive == null ? Boolean.TRUE : dto.isActive);
        tenantRepository.save(t);
        return ResponseEntity.ok(new TenantDto(t.getId(), t.getTenantCode(), t.getTenantName(), t.getIsActive(), t.getCreatedAt()));
    }

    public static class TenantDto {
        public final UUID id;
        public final String tenantCode;
        public final String tenantName;
        public final Boolean isActive;
        public final java.time.Instant createdAt;
        public TenantDto(UUID id, String tenantCode, String tenantName, Boolean isActive, java.time.Instant createdAt) {
            this.id = id; this.tenantCode = tenantCode; this.tenantName = tenantName; this.isActive = isActive; this.createdAt = createdAt;
        }
    }

    public static class CreateTenantDto {
        public String tenantCode;
        public String tenantName;
        public Boolean isActive;
    }

    public static class ActivateDto {
        public Boolean isActive;
    }

    public static class ErrorDto {
        public final String message;
        public ErrorDto(String message) { this.message = message; }
    }
}