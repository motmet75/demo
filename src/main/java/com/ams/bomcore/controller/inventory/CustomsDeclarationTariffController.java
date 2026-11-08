package com.ams.bomcore.controller.inventory;

import com.ams.bomcore.service.inventory.CustomsTariffBridgeService;
import com.ams.bomcore.service.inventory.InvoiceStockOutService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Tenant-authorized read-only tariff preview; never updates customs filings or stock. */
@RestController
@RequestMapping("/bom/inventory/customs-declaration/tariff")
public class CustomsDeclarationTariffController {
    private final CustomsTariffBridgeService tariff;
    private final InvoiceStockOutService scopeService;
    public CustomsDeclarationTariffController(CustomsTariffBridgeService tariff,
                                             InvoiceStockOutService scopeService) {
        this.tariff = tariff;
        this.scopeService = scopeService;
    }

    @GetMapping("/{hsCode}")
    public Map<String,Object> find(@PathVariable String hsCode,
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication auth) {
        if (auth == null || !auth.isAuthenticated() ||
                auth.getAuthorities().stream().noneMatch(a ->
                    List.of("ROLE_ADMIN","ROLE_SUPER_ADMIN","ROLE_USER")
                      .contains(a.getAuthority()))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Không có quyền tra cứu biểu thuế HQ.");
        }
        scopeService.scope(auth,tenant,company);
        return tariff.lookup(hsCode);
    }
}
