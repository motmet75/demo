package com.ams.bomcore.controller.warehouse;

import java.util.List;
import java.util.UUID;
import java.util.Optional;
import java.util.Collections;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.repository.WarehouseRepository;
import com.ams.bomcore.service.warehouse.WarehouseService;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.company.Company;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/warehouses")
public class WarehouseController {

    private final WarehouseService warehouseService;
    private final WarehouseRepository warehouseRepository;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;

    public WarehouseController(WarehouseService warehouseService, WarehouseRepository warehouseRepository, TenantRepository tenantRepository, CompanyRepository companyRepository) {
        this.warehouseService = warehouseService;
        this.warehouseRepository = warehouseRepository;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
    }

    private java.util.UUID resolveTenant(java.util.UUID tenantId, String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { return java.util.UUID.fromString(headerTenantId); } catch (Exception e) { }
        }
        return tenantId;
    }

    private java.util.UUID resolveCompany(java.util.UUID companyId, String headerCompanyId) {
        if (headerCompanyId != null && !headerCompanyId.isBlank()) {
            try { return java.util.UUID.fromString(headerCompanyId); } catch (Exception e) { }
        }
        return companyId;
    }

    @GetMapping
    public List<WarehouseEntity> list(@RequestParam(value = "tenantId", required = false) UUID tenantId,
                                      @RequestParam(value = "companyId", required = false) UUID companyId,
                                      @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                      @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);

        if (tenantId == null || companyId == null) {
            throw new IllegalArgumentException("tenantId and companyId are required");
        }

        Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
        Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));
        if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalArgumentException("company does not belong to tenant");
        }

        return warehouseRepository.findAllByTenantIdAndCompanyId(tenant.getId(), company.getId());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody WarehouseEntity warehouse,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            tenantId = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);

            if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Collections.singletonMap("message", "tenantId and companyId are required"));

            Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
            Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));
            if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Collections.singletonMap("message", "company does not belong to tenant"));
            }

            // set tenant/company on warehouse (now stored as UUIDs)
            warehouse.setTenantId(tenant.getId());
            warehouse.setCompanyId(company.getId());

            WarehouseEntity saved = warehouseService.create(warehouse);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Bad request"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Internal server error"));
        }
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable("id") UUID id, @Valid @RequestBody WarehouseEntity warehouse,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            if (!warehouseRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            tenantId = resolveTenant(tenantId, headerTenantId);
            companyId = resolveCompany(companyId, headerCompanyId);
            if (tenantId == null || companyId == null) return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Collections.singletonMap("message", "tenantId and companyId are required"));

            Tenant tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("tenant not found"));
            Company company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("company not found"));
            if (company.getTenant() == null || !company.getTenant().getId().equals(tenant.getId())) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Collections.singletonMap("message", "company does not belong to tenant"));
            }

            warehouse.setTenantId(tenant.getId());
            warehouse.setCompanyId(company.getId());
            WarehouseEntity saved = warehouseService.update(id, warehouse);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Bad request"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Internal server error"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") UUID id) {
        if (!warehouseRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        try {
            warehouseService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Bad request"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Internal server error"));
        }
    }

    // Defensive sanitation: convert literal strings "null"/"undefined"/empty into real nulls and trim values
    private void sanitize(WarehouseEntity w) {
        if (w == null) return;

        w.setCode(nullIfLiteral(w.getCode()));
        w.setName(nullIfLiteral(w.getName()));
        w.setLocation(nullIfLiteral(w.getLocation()));
        // isActive is Boolean; leave as-is. createdAt/id will be handled by JPA/service logic.
    }

    private String nullIfLiteral(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        String low = t.toLowerCase();
        if ("null".equals(low) || "undefined".equals(low)) return null;
        return t;
    }
}
