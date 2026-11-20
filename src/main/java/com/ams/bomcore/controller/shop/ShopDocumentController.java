package com.ams.bomcore.controller.shop;

import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.service.shop.ShopDocumentService;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import java.io.IOException;
import java.util.*;

@RestController
@RequestMapping("/shop/staff/documents")
public class ShopDocumentController {
    private final ShopDocumentService service;
    private final CompanyRepository companies;
    public ShopDocumentController(ShopDocumentService service, CompanyRepository companies) { this.service = service; this.companies = companies; }

    @PostMapping(value = "/buyer", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Object buyer(@RequestHeader("X-Tenant-Id") UUID tenant, @RequestHeader("X-Company-Id") UUID company,
                        Authentication auth, @RequestParam("file") List<MultipartFile> files) throws Exception {
        scope(tenant, company, auth); return service.readBuyer(files);
    }
    @PostMapping(value = "/invoice", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public Object invoice(@RequestHeader("X-Tenant-Id") UUID tenant, @RequestHeader("X-Company-Id") UUID company,
                          Authentication auth, @RequestParam MultipartFile file) throws Exception {
        scope(tenant, company, auth); return service.readInvoice(file);
    }
    @PostMapping("/address")
    public Object address(@RequestHeader("X-Tenant-Id") UUID tenant, @RequestHeader("X-Company-Id") UUID company,
                          Authentication auth, @RequestBody Map<String, String> body) throws Exception {
        scope(tenant, company, auth); return service.convertAddress(body.get("address"));
    }
    private void scope(UUID tenant, UUID company, Authentication auth) {
        if (auth == null || !auth.isAuthenticated()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        if (auth.getPrincipal() instanceof com.ams.bomcore.domain.user.User user && auth.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"))) {
            if (!tenant.toString().equals(user.getAssignedTenantId()) || (user.getAssignedCompanyId() != null && !user.getAssignedCompanyId().isBlank() && !company.toString().equals(user.getAssignedCompanyId())))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        var seller = companies.findById(company).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (seller.getTenant() == null || !tenant.equals(seller.getTenant().getId())) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
    @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
    ResponseEntity<?> invalid(RuntimeException error) { return ResponseEntity.badRequest().body(Map.of("message", Objects.toString(error.getMessage(), "Tài liệu không hợp lệ."))); }
    @ExceptionHandler(IOException.class)
    ResponseEntity<?> unavailable(IOException error) { return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(Map.of("message", "Không đọc được tài liệu hoặc dịch vụ OCR chưa sẵn sàng. Kiểm tra tệp và cấu hình Google Vision.")); }
}
