package com.ams.bomcore.controller.invoice;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
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

import com.ams.bomcore.domain.invoice.InvoiceEntity;
import com.ams.bomcore.service.invoice.InvoiceService;

/**
 * REST controller for Invoice management.
 *
 * <pre>
 * GET    /bom/api/invoices              – paginated list (filters: invoiceType, status)
 * GET    /bom/api/invoices/all          – flat list (for pickers)
 * GET    /bom/api/invoices/{id}         – get by id
 * POST   /bom/api/invoices              – create
 * PUT    /bom/api/invoices/{id}         – update
 * DELETE /bom/api/invoices/{id}         – delete
 * </pre>
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/invoices")
public class InvoiceController {

    private final InvoiceService invoiceService;

    public InvoiceController(InvoiceService invoiceService) {
        this.invoiceService = invoiceService;
    }

    private UUID resolveTenant(UUID tenantId, String h) {
        if (h != null && !h.isBlank()) try { return UUID.fromString(h); } catch (Exception ignored) {}
        return tenantId;
    }

    private UUID resolveCompany(UUID companyId, String h) {
        if (h != null && !h.isBlank()) try { return UUID.fromString(h); } catch (Exception ignored) {}
        return companyId;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(value = "tenantId",     required = false) UUID tenantId,
            @RequestParam(value = "companyId",    required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String ht,
            @RequestHeader(value = "X-Company-Id",required = false) String hc,
            @RequestParam(value = "invoiceType",  required = false) String invoiceType,
            @RequestParam(value = "status",       required = false) String status,
            @RequestParam(value = "page",  defaultValue = "0")  int page,
            @RequestParam(value = "size",  defaultValue = "20") int size) {
        tenantId  = resolveTenant(tenantId, ht);
        companyId = resolveCompany(companyId, hc);
        if (tenantId == null || companyId == null)
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
        Page<InvoiceEntity> result = invoiceService.list(tenantId, companyId, invoiceType, status,
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt")));
        return ResponseEntity.ok(result);
    }

    /** Flat list – used by pickers in inventory forms */
    @GetMapping("/all")
    public ResponseEntity<?> listAll(
            @RequestParam(value = "tenantId",     required = false) UUID tenantId,
            @RequestParam(value = "companyId",    required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String ht,
            @RequestHeader(value = "X-Company-Id",required = false) String hc) {
        tenantId  = resolveTenant(tenantId, ht);
        companyId = resolveCompany(companyId, hc);
        if (tenantId == null || companyId == null)
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
        List<InvoiceEntity> result = invoiceService.listAll(tenantId, companyId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> getById(
            @PathVariable UUID id,
            @RequestParam(value = "tenantId",     required = false) UUID tenantId,
            @RequestParam(value = "companyId",    required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String ht,
            @RequestHeader(value = "X-Company-Id",required = false) String hc) {
        tenantId  = resolveTenant(tenantId, ht);
        companyId = resolveCompany(companyId, hc);
        try {
            return ResponseEntity.ok(invoiceService.getById(id, tenantId, companyId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(
            @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId",     required = false) UUID tenantId,
            @RequestParam(value = "companyId",    required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String ht,
            @RequestHeader(value = "X-Company-Id",required = false) String hc) {
        tenantId  = resolveTenant(tenantId, ht);
        companyId = resolveCompany(companyId, hc);
        if (tenantId == null || companyId == null)
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
        try {
            InvoiceEntity saved = invoiceService.create(body, tenantId, companyId);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(
            @PathVariable UUID id,
            @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId",     required = false) UUID tenantId,
            @RequestParam(value = "companyId",    required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String ht,
            @RequestHeader(value = "X-Company-Id",required = false) String hc) {
        tenantId  = resolveTenant(tenantId, ht);
        companyId = resolveCompany(companyId, hc);
        try {
            return ResponseEntity.ok(invoiceService.update(id, body, tenantId, companyId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(
            @PathVariable UUID id,
            @RequestParam(value = "tenantId",     required = false) UUID tenantId,
            @RequestParam(value = "companyId",    required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String ht,
            @RequestHeader(value = "X-Company-Id",required = false) String hc) {
        tenantId  = resolveTenant(tenantId, ht);
        companyId = resolveCompany(companyId, hc);
        try {
            invoiceService.delete(id, tenantId, companyId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
        }
    }
}
