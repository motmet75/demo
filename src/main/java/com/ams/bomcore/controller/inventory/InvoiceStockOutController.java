package com.ams.bomcore.controller.inventory;

import com.ams.bomcore.service.inventory.InvoiceStockOutService;
import com.demo.invoicedesk.InvoiceDeskService.Scope;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

/**
 * Stock-out invoices are explicitly reviewed and committed by inventory users.
 * All documents go through the already deployed Invoice Desk OCR pipeline.
 */
@RestController
@RequestMapping("/bom/inventory/invoice-stock-out")
public class InvoiceStockOutController {
    private final InvoiceStockOutService service;

    public InvoiceStockOutController(InvoiceStockOutService service) {
        this.service=service;
    }
    private Scope authorized(UUID tenant, UUID company, Authentication auth) {
        if (auth==null || !auth.isAuthenticated() ||
                auth.getAuthorities().stream().noneMatch(a ->
                        List.of("ROLE_ADMIN","ROLE_SUPER_ADMIN","ROLE_USER").contains(a.getAuthority())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Bạn không có quyền ghi xuất kho theo hóa đơn.");
        return service.scope(auth,tenant,company);
    }

    @GetMapping("/documents")
    public List<Map<String,Object>> documents(
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication auth) {
        return service.documents(authorized(tenant,company,auth));
    }
    @GetMapping("/documents/{id}")
    public Map<String,Object> document(
            @PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication auth) {
        return service.document(authorized(tenant,company,auth),id);
    }
    @PostMapping(path="/upload",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> upload(
            @RequestParam("file") MultipartFile file,
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication auth) throws Exception {
        Scope scope=authorized(tenant,company,auth);
        var document=service.upload(scope,file);
        return service.document(scope,document.id());
    }
    @GetMapping("/inventory-suppliers")
    public List<Map<String,Object>> inventorySuppliers(
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication auth) {
        return service.inventorySuppliers(authorized(tenant,company,auth));
    }

    @GetMapping("/posted")
    public List<Map<String,Object>> posted(
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication auth) {
        return service.posted(authorized(tenant,company,auth));
    }
    @PostMapping(path="/confirm",consumes=MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> confirm(
            @RequestBody InvoiceStockOutService.Confirm body,
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication auth) throws Exception {
        return service.confirm(authorized(tenant,company,auth),body);
    }
}
