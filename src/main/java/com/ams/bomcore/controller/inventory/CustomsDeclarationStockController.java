package com.ams.bomcore.controller.inventory;

import com.ams.bomcore.service.inventory.CustomsDeclarationStockService;
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

@RestController
@RequestMapping("/bom/inventory/customs-declaration")
public class CustomsDeclarationStockController {
    private final CustomsDeclarationStockService customs;
    private final InvoiceStockOutService scopeService;
    public CustomsDeclarationStockController(CustomsDeclarationStockService customs,
                                             InvoiceStockOutService scopeService) {
        this.customs=customs;this.scopeService=scopeService;
    }
    private Scope allowed(UUID tenant,UUID company,Authentication auth) {
        if(auth==null||!auth.isAuthenticated()||auth.getAuthorities().stream()
                .noneMatch(a->List.of("ROLE_ADMIN","ROLE_SUPER_ADMIN","ROLE_USER")
                    .contains(a.getAuthority())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,"Không có quyền quản lý kho HQ.");
        return scopeService.scope(auth,tenant,company);
    }
    @PostMapping(value="/upload",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
    public Map<String,Object> upload(@RequestParam("file") MultipartFile file,
        @RequestHeader("X-Tenant-Id") UUID tenant,@RequestHeader("X-Company-Id") UUID company,
        Authentication auth)throws Exception {
        return customs.upload(allowed(tenant,company,auth),file);
    }
    @GetMapping("/{id}")
    public Map<String,Object> document(@PathVariable UUID id,
        @RequestHeader("X-Tenant-Id") UUID tenant,@RequestHeader("X-Company-Id") UUID company,
        Authentication auth) {
        return customs.document(allowed(tenant,company,auth),id);
    }
    @GetMapping("/history")
    public List<Map<String,Object>> history(
        @RequestHeader("X-Tenant-Id") UUID tenant,@RequestHeader("X-Company-Id") UUID company,
        Authentication auth) {
        return customs.history(allowed(tenant,company,auth));
    }
    @PostMapping(value="/confirm",consumes=MediaType.APPLICATION_JSON_VALUE)
    public Map<String,Object> confirm(@RequestBody CustomsDeclarationStockService.Confirm request,
        @RequestHeader("X-Tenant-Id") UUID tenant,@RequestHeader("X-Company-Id") UUID company,
        Authentication auth) {
        return customs.confirm(allowed(tenant,company,auth),request);
    }
}
