package com.ams.bomcore.controller.supplier;

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

import com.ams.bomcore.domain.supplier.Supplier;
import com.ams.bomcore.repository.SupplierRepository;
import com.ams.bomcore.repository.SupplierIssueRepository;
import com.ams.bomcore.service.supplier.SupplierService;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.company.Company;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/suppliers")
public class SupplierController {

    private final SupplierService supplierService;
    private final SupplierRepository supplierRepository;
    private final SupplierIssueRepository supplierIssueRepository;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;

    public SupplierController(SupplierService supplierService, SupplierRepository supplierRepository, SupplierIssueRepository supplierIssueRepository, TenantRepository tenantRepository, CompanyRepository companyRepository) {
        this.supplierService = supplierService;
        this.supplierRepository = supplierRepository;
        this.supplierIssueRepository = supplierIssueRepository;
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
    public List<Supplier> list(@RequestParam(value = "tenantId", required = false) UUID tenantId,
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

        return supplierRepository.findAllByTenantIdAndCompanyId(tenant.getId(), company.getId());
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody Supplier supplier,
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

            // set tenant/company on supplier (now stored as UUIDs)
            supplier.setTenantId(tenant.getId());
            supplier.setCompanyId(company.getId());

            Supplier saved = supplierService.create(supplier);
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
    public ResponseEntity<?> update(@PathVariable("id") UUID id, @Valid @RequestBody Supplier supplier,
                                    @RequestParam(value = "tenantId", required = false) UUID tenantId,
                                    @RequestParam(value = "companyId", required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
                                    @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {
        try {
            if (!supplierRepository.existsById(id)) {
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

            supplier.setTenantId(tenant.getId());
            supplier.setCompanyId(company.getId());
            Supplier saved = supplierService.update(id, supplier);
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
        if (!supplierRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        // prevent delete if supplier has related supplier issues (interpreted as "supplier have record in inventory")
        if (supplierIssueRepository.existsBySupplierId(id)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", "Supplier has related issues and cannot be deleted"));
        }

        try {
            supplierService.delete(id);
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
}