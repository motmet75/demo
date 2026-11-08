package com.ams.bomcore.controller.inventory;

import com.ams.bomcore.service.inventory.InvoicePdfReceivingService;
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
 * PDF-based inbound stock receipts. The OCR service is shared with Invoice
 * Desk; preview and upload have no inventory side effects.
 */
@RestController
@RequestMapping("/bom/inventory/invoice-pdf-receive")
public class InvoicePdfReceivingController {
    private final InvoiceStockOutService ocr;
    private final InvoicePdfReceivingService receive;
    public InvoicePdfReceivingController(InvoiceStockOutService ocr,
                                        InvoicePdfReceivingService receive) {
        this.ocr=ocr; this.receive=receive;
    }
    private Scope authorized(UUID tenant,UUID company,Authentication auth) {
        if(auth==null || !auth.isAuthenticated() || auth.getAuthorities().stream()
          .noneMatch(a->List.of("ROLE_ADMIN","ROLE_SUPER_ADMIN","ROLE_USER")
            .contains(a.getAuthority())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Bạn không có quyền nhập kho.");
        return ocr.scope(auth,tenant,company);
    }
    @GetMapping("/documents")
    public List<Map<String,Object>> documents(@RequestHeader("X-Tenant-Id") UUID tenant,
             @RequestHeader("X-Company-Id") UUID company,Authentication auth) {
        return ocr.documents(authorized(tenant,company,auth));
    }
    @GetMapping("/documents/{id}")
    public Map<String,Object> document(@PathVariable UUID id,
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,Authentication auth) {
        return ocr.document(authorized(tenant,company,auth),id);
    }
    @PostMapping(value="/upload",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> upload(@RequestParam MultipartFile file,
           @RequestHeader("X-Tenant-Id") UUID tenant,
           @RequestHeader("X-Company-Id") UUID company,Authentication auth)throws Exception {
        Scope scope=authorized(tenant,company,auth);
        var document=ocr.upload(scope,file);
        return ocr.document(scope,document.id());
    }
    @GetMapping("/history")
    public List<Map<String,Object>> history(@RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,Authentication auth) {
        return receive.history(authorized(tenant,company,auth));
    }
    @PostMapping(value="/confirm",consumes=MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> confirm(@RequestBody InvoicePdfReceivingService.Confirm body,
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,Authentication auth) {
        return receive.confirm(authorized(tenant,company,auth),body);
    }
}
