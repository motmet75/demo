package com.demo.security;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.service.shop.ShopSetupService;

@RestController
@RequestMapping("/auth")
public class ProfileController {

    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;
    private final ShopSetupService shopSetupService;

    public ProfileController(TenantRepository tenantRepository,
                             CompanyRepository companyRepository,
                             ShopSetupService shopSetupService) {
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.shopSetupService = shopSetupService;
    }

    public record ProfileUser(Integer id, String username, String email, String firstName, String lastName, String avatar) {}
    public record ProfileTenant(String id, String tenantCode, String tenantName) {}
    public record ProfileCompany(String id, String companyCode, String companyName, String validUntil) {}
    public record ProfileResponse(ProfileUser user, ProfileTenant tenant, ProfileCompany company) {}
    public record ShopSetupRequest(String type) {}
    public record ShopSetupResponse(boolean success, String message) {}
    public record ShopResetResponse(boolean success, String message) {}

    @GetMapping("/profile")
    public ResponseEntity<ProfileResponse> getProfile(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        ProfileUser profileUser = new ProfileUser(
                user.getId(), user.getUsername(), user.getEmail(),
                user.getFirstName(), user.getLastName(), user.getAvatar());

        String tenantId = user.getAssignedTenantId() != null ? user.getAssignedTenantId() : user.getLastTenantId();
        String companyId = user.getAssignedCompanyId() != null ? user.getAssignedCompanyId() : user.getLastCompanyId();

        ProfileTenant profileTenant = null;
        ProfileCompany profileCompany = null;

        if (tenantId != null) {
            try {
                Tenant t = tenantRepository.findById(UUID.fromString(tenantId)).orElse(null);
                if (t != null) profileTenant = new ProfileTenant(t.getId().toString(), t.getTenantCode(), t.getTenantName());
            } catch (IllegalArgumentException ignored) {}
        }

        if (companyId != null) {
            try {
                Company c = companyRepository.findById(UUID.fromString(companyId)).orElse(null);
                if (c != null) profileCompany = new ProfileCompany(
                        c.getId().toString(), c.getCompanyCode(), c.getCompanyName(),
                        c.getValidUntil() != null ? c.getValidUntil().toString() : null);
            } catch (IllegalArgumentException ignored) {}
        }

        return ResponseEntity.ok(new ProfileResponse(profileUser, profileTenant, profileCompany));
    }

    @PostMapping("/shop/reset")
    public ResponseEntity<ShopResetResponse> resetShop(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String tenantId = user.getAssignedTenantId() != null ? user.getAssignedTenantId() : user.getLastTenantId();
        String companyId = user.getAssignedCompanyId() != null ? user.getAssignedCompanyId() : user.getLastCompanyId();

        if (tenantId == null || companyId == null) {
            return ResponseEntity.badRequest().body(new ShopResetResponse(false, "No tenant/company assigned to this account"));
        }

        try {
            shopSetupService.resetShop(UUID.fromString(tenantId), UUID.fromString(companyId));
            return ResponseEntity.ok(new ShopResetResponse(true, "Shop data cleared — tables, orders, models, BOMs and menu options removed"));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ShopResetResponse(false, "Reset failed: " + e.getMessage()));
        }
    }

    @PostMapping("/shop/setup")
    public ResponseEntity<ShopSetupResponse> setupShop(
            @RequestBody ShopSetupRequest request,
            Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String tenantId = user.getAssignedTenantId() != null ? user.getAssignedTenantId() : user.getLastTenantId();
        String companyId = user.getAssignedCompanyId() != null ? user.getAssignedCompanyId() : user.getLastCompanyId();

        if (tenantId == null || companyId == null) {
            return ResponseEntity.badRequest().body(new ShopSetupResponse(false, "No tenant/company assigned to this account"));
        }

        try {
            UUID tid = UUID.fromString(tenantId);
            UUID cid = UUID.fromString(companyId);

            if ("MATCHA".equalsIgnoreCase(request.type())) {
                shopSetupService.setupMatchaShop(tid, cid);
                return ResponseEntity.ok(new ShopSetupResponse(true, "Matcha shop ready — 6 tables, 3 drinks, BOMs & menu options created"));
            } else if ("QR".equalsIgnoreCase(request.type())) {
                shopSetupService.setupQrShop(tid, cid);
                return ResponseEntity.ok(new ShopSetupResponse(true, "QR shop ready — 10 tables, 3 drinks, BOMs & menu options created"));
            } else {
                return ResponseEntity.badRequest().body(new ShopSetupResponse(false, "Unknown type: " + request.type()));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ShopSetupResponse(false, "Setup failed: " + e.getMessage()));
        }
    }
}
