package com.ams.bomcore.controller.shop;

import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.shop.VinHoadonInvoiceService;
import com.ams.bomcore.util.RequestTimeZone;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/shop/staff/e-invoices")
public class VinHoadonInvoiceController {
    private final VinHoadonInvoiceService service;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;

    public VinHoadonInvoiceController(VinHoadonInvoiceService service, TenantRepository tenantRepository,
                                      CompanyRepository companyRepository) {
        this.service = service;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
    }

    @GetMapping("/config")
    public VinHoadonInvoiceService.ConfigView config(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                                     @RequestHeader("X-Company-Id") UUID companyId) {
        validateScope(tenantId, companyId);
        return service.getConfig(tenantId, companyId);
    }

    @PutMapping("/config")
    public VinHoadonInvoiceService.ConfigView saveConfig(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                                         @RequestHeader("X-Company-Id") UUID companyId,
                                                         @RequestBody VinHoadonInvoiceService.ConfigRequest request) {
        validateScope(tenantId, companyId);
        return service.saveConfig(tenantId, companyId, request);
    }

    @PostMapping("/preview")
    public VinHoadonInvoiceService.Preview preview(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                                   @RequestHeader("X-Company-Id") UUID companyId,
                                                   @RequestBody VinHoadonInvoiceService.IssueRequest request) {
        validateScope(tenantId, companyId);
        return service.preview(tenantId, companyId, request);
    }

    @PostMapping
    public ResponseEntity<VinHoadonInvoiceService.InvoiceView> issue(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                                                     @RequestHeader("X-Company-Id") UUID companyId,
                                                                     @RequestHeader(value = "X-Time-Zone", required = false) String timeZone,
                                                                     @RequestBody VinHoadonInvoiceService.IssueRequest request,
                                                                     Authentication authentication) {
        validateScope(tenantId, companyId);
        var result = service.issue(tenantId, companyId, request,
                authentication == null ? "unknown" : authentication.getName(), RequestTimeZone.resolve(timeZone));
        return ResponseEntity.status(HttpStatus.CREATED).body(result);
    }

    @PostMapping("/status")
    public Map<UUID, VinHoadonInvoiceService.InvoiceView> status(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                                                 @RequestHeader("X-Company-Id") UUID companyId,
                                                                 @RequestBody List<UUID> orderIds) {
        validateScope(tenantId, companyId);
        return service.statuses(tenantId, companyId, orderIds);
    }

    @GetMapping("/{invoiceId}")
    public VinHoadonInvoiceService.InvoiceView get(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                                   @RequestHeader("X-Company-Id") UUID companyId,
                                                   @PathVariable UUID invoiceId) {
        validateScope(tenantId, companyId);
        return service.get(tenantId, companyId, invoiceId);
    }

    @PostMapping("/{invoiceId}/retry")
    public VinHoadonInvoiceService.InvoiceView retry(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                                     @RequestHeader("X-Company-Id") UUID companyId,
                                                     @PathVariable UUID invoiceId) {
        validateScope(tenantId, companyId);
        return service.retry(tenantId, companyId, invoiceId);
    }

    @PostMapping("/{invoiceId}/sync")
    public VinHoadonInvoiceService.InvoiceView sync(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                                    @RequestHeader("X-Company-Id") UUID companyId,
                                                    @PathVariable UUID invoiceId) {
        validateScope(tenantId, companyId);
        return service.sync(tenantId, companyId, invoiceId);
    }

    @GetMapping("/{invoiceId}/download/{format}")
    public ResponseEntity<byte[]> download(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                           @RequestHeader("X-Company-Id") UUID companyId,
                                           @PathVariable UUID invoiceId, @PathVariable String format) {
        validateScope(tenantId, companyId);
        if (!Set.of("pdf", "xml").contains(format.toLowerCase(Locale.ROOT)))
            throw new IllegalArgumentException("Download format must be pdf or xml");
        var file = service.download(tenantId, companyId, invoiceId, format);
        final byte[] bytes;
        try { bytes = Base64.getDecoder().decode(file.base64().replaceAll("\\s+", "")); }
        catch (IllegalArgumentException exception) { throw new IllegalStateException("VIN-HOADON returned invalid base64 content"); }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(file.fileName()).build().toString())
                .body(bytes);
    }

    private void validateScope(UUID tenantId, UUID companyId) {
        if (tenantId == null || companyId == null) throw new IllegalArgumentException("tenantId and companyId are required");
        var tenant = tenantRepository.findById(tenantId).orElseThrow(() -> new IllegalArgumentException("Tenant not found"));
        var company = companyRepository.findById(companyId).orElseThrow(() -> new IllegalArgumentException("Company not found"));
        if (company.getTenant() == null || !tenant.getId().equals(company.getTenant().getId()))
            throw new IllegalArgumentException("Company does not belong to tenant");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<Map<String, String>> badRequest(IllegalArgumentException exception) {
        return error(HttpStatus.BAD_REQUEST, exception);
    }
    @ExceptionHandler({IllegalStateException.class, DataIntegrityViolationException.class})
    ResponseEntity<Map<String, String>> conflict(RuntimeException exception) {
        return error(HttpStatus.CONFLICT, exception);
    }
    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<Map<String, String>> notFound(NoSuchElementException exception) {
        return error(HttpStatus.NOT_FOUND, exception);
    }
    private ResponseEntity<Map<String, String>> error(HttpStatus status, RuntimeException exception) {
        String message = exception.getMessage() == null ? status.getReasonPhrase() : exception.getMessage();
        return ResponseEntity.status(status).body(Map.of("error", message, "message", message));
    }
}
