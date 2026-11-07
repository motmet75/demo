package com.ams.bomcore.controller.shop;

import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.service.shop.VnAddressDirectoryService;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

/**
 * Read-only address suggestions for invoice users; controlled, explicit data
 * refreshes for super administrators. No customer PII or ViettelPost token output.
 */
@RestController
@RequestMapping("/shop/staff/addresses")
public class VnAddressDirectoryController {
    private final VnAddressDirectoryService directory;
    private final CompanyRepository companies;

    public VnAddressDirectoryController(VnAddressDirectoryService directory, CompanyRepository companies) {
        this.directory = directory;
        this.companies = companies;
    }

    @GetMapping("/suggest")
    public List<Map<String, Object>> suggest(
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication authentication, @RequestParam("q") String query) {
        checkScope(tenant, company, authentication);
        return directory.suggest(query);
    }

    @GetMapping("/status")
    public Map<String, Object> status(
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication authentication) {
        checkScope(tenant, company, authentication);
        return directory.status();
    }

    @PostMapping("/admin/sync-current")
    public Map<String, Object> syncCurrent(
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication authentication) throws Exception {
        checkScope(tenant, company, authentication);
        requireSuperAdmin(authentication);
        return directory.syncCurrent();
    }

    @GetMapping("/admin/viettelpost-provinces")
    public List<Map<String, Object>> viettelPostProvinces(
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication authentication) throws Exception {
        checkScope(tenant, company, authentication);
        requireSuperAdmin(authentication);
        return directory.listViettelPostProvinces();
    }

    /** Import one ViettelPost province per request; old delivery codes are not official codes. */
    @PostMapping("/admin/sync-viettelpost")
    public Map<String, Object> syncViettelPost(
            @RequestHeader("X-Tenant-Id") UUID tenant,
            @RequestHeader("X-Company-Id") UUID company,
            Authentication authentication,
            @RequestParam("provinceId") int provinceId) throws Exception {
        checkScope(tenant, company, authentication);
        requireSuperAdmin(authentication);
        return directory.syncViettelPost(provinceId);
    }

    private void checkScope(UUID tenant, UUID company, Authentication auth) {
        if (auth == null || !auth.isAuthenticated())
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        boolean superAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()));
        if (!superAdmin) {
            if (!(auth.getPrincipal() instanceof User user))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
            if (!tenant.toString().equals(user.getAssignedTenantId())
                    || (user.getAssignedCompanyId() != null
                        && !user.getAssignedCompanyId().isBlank()
                        && !company.toString().equals(user.getAssignedCompanyId())))
                throw new ResponseStatusException(HttpStatus.FORBIDDEN);
        }
        var seller = companies.findById(company)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        if (seller.getTenant() == null || !tenant.equals(seller.getTenant().getId()))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }

    private void requireSuperAdmin(Authentication auth) {
        if (auth.getAuthorities().stream().noneMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority())))
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Chỉ SUPER_ADMIN được cập nhật danh mục hành chính dùng chung.");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Map<String,String> invalid(IllegalArgumentException e) {
        return Map.of("message", e.getMessage() == null ? "Yêu cầu không hợp lệ." : e.getMessage());
    }
}
