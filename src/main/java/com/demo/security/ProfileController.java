package com.demo.security;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.UserRepository;
import com.ams.bomcore.service.shop.ShopSetupService;
import com.demo.invoicedesk.InvoiceDeskRoleAccessService;
import org.springframework.transaction.annotation.Transactional;

@RestController
@RequestMapping("/auth")
public class ProfileController {
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");

    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;
    private final UserRepository userRepository;
    private final ShopSetupService shopSetupService;
    private final InvoiceDeskRoleAccessService invoiceDeskRoleAccess;

    public ProfileController(TenantRepository tenantRepository,
                             CompanyRepository companyRepository,
                             UserRepository userRepository,
                             ShopSetupService shopSetupService,
                             InvoiceDeskRoleAccessService invoiceDeskRoleAccess) {
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.userRepository = userRepository;
        this.shopSetupService = shopSetupService;
        this.invoiceDeskRoleAccess = invoiceDeskRoleAccess;
    }

    public record ProfileUser(Integer id, String username, String email, String firstName, String lastName, String avatar) {}
    public record ProfileTenant(String id, String tenantCode, String tenantName) {}
    public record ProfileCompany(String id, String companyCode, String companyName, String validUntil,
                                 boolean newOrderNotificationEnabled, String newOrderNotificationEmails) {}
    public record ProfileResponse(ProfileUser user, ProfileTenant tenant, ProfileCompany company) {}
    public record OrderNotificationRequest(Boolean enabled, String email, String emails) {}
    public record OrderNotificationResponse(boolean success, String message,
                                            boolean newOrderNotificationEnabled,
                                            String newOrderNotificationEmails) {}
    public record ShopSetupRequest(String type) {}
    public record ShopSetupResponse(boolean success, String message) {}
    public record ShopInitializeResponse(boolean success, String message, String tenantId, String companyId) {}
    public record ShopResetResponse(boolean success, String message) {}
    private record EmailList(List<String> emails, String invalid) {}

    @PostMapping("/shop/initialize")
    @PreAuthorize("hasRole('USER')")
    @Transactional
    public ResponseEntity<ShopInitializeResponse> initializeShop(Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User sessionUser)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        User user = userRepository.findByUsernameIgnoreCase(sessionUser.getUsername()).orElse(null);
        if (user == null) return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        if (user.getAssignedTenantId() != null && !user.getAssignedTenantId().isBlank()
                && user.getAssignedCompanyId() != null && !user.getAssignedCompanyId().isBlank()) {
            invoiceDeskRoleAccess.sync(user.getUsername());
            return ResponseEntity.ok(new ShopInitializeResponse(true, "Shop and Invoice Desk are already active",
                    user.getAssignedTenantId(), user.getAssignedCompanyId()));
        }
        if ((user.getAssignedTenantId() != null && !user.getAssignedTenantId().isBlank())
                || (user.getAssignedCompanyId() != null && !user.getAssignedCompanyId().isBlank())) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ShopInitializeResponse(false,
                    "The account has an incomplete tenant/company assignment. Ask an administrator to correct it.", null, null));
        }

        String shortId = UUID.randomUUID().toString().replace("-", "").substring(0, 8);
        String displayName = user.getFirstName() != null && !user.getFirstName().isBlank()
                ? user.getFirstName().trim() : user.getUsername().split("@",2)[0];
        Tenant tenant = new Tenant();
        tenant.setTenantCode("shop-" + shortId);tenant.setTenantName(displayName + "'s Shop");
        tenant.setTenantType("SHOP_OWNER");tenant.setMaxCompanies(1);tenant=tenantRepository.saveAndFlush(tenant);
        Company company = new Company();
        company.setTenant(tenant);company.setCompanyCode("co-" + shortId);company.setCompanyName(displayName + "'s Company");
        company.setValidUntil(Instant.now().plus(15, ChronoUnit.DAYS));company=companyRepository.saveAndFlush(company);
        user.setAssignedTenantId(tenant.getId().toString());user.setAssignedCompanyId(company.getId().toString());
        user.setLastTenantId(tenant.getId().toString());user.setLastCompanyId(company.getId().toString());userRepository.saveAndFlush(user);
        sessionUser.setAssignedTenantId(user.getAssignedTenantId());sessionUser.setAssignedCompanyId(user.getAssignedCompanyId());
        sessionUser.setLastTenantId(user.getLastTenantId());sessionUser.setLastCompanyId(user.getLastCompanyId());
        invoiceDeskRoleAccess.sync(user.getUsername());
        return ResponseEntity.ok(new ShopInitializeResponse(true,
                "Shop created. GDT PDF Invoice Desk is active.", tenant.getId().toString(), company.getId().toString()));
    }

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
                        c.getValidUntil() != null ? c.getValidUntil().toString() : null,
                        Boolean.TRUE.equals(c.getNewOrderNotificationEnabled()),
                        c.getNewOrderNotificationEmails() != null ? c.getNewOrderNotificationEmails() : "");
            } catch (IllegalArgumentException ignored) {}
        }

        return ResponseEntity.ok(new ProfileResponse(profileUser, profileTenant, profileCompany));
    }

    @PatchMapping("/profile/order-notification")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','USER')")
    public ResponseEntity<OrderNotificationResponse> updateOrderNotification(
            @RequestBody OrderNotificationRequest request,
            Authentication authentication) {
        if (authentication == null || !(authentication.getPrincipal() instanceof User user)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }

        String companyId = user.getAssignedCompanyId() != null ? user.getAssignedCompanyId() : user.getLastCompanyId();
        if (companyId == null) {
            return ResponseEntity.badRequest().body(new OrderNotificationResponse(
                    false, "No company assigned to this account", false, ""));
        }

        boolean enabled = request != null && Boolean.TRUE.equals(request.enabled());
        String rawEmails = request != null && request.emails() != null ? request.emails() : (request != null ? request.email() : "");
        EmailList emailList = normalizeEmails(rawEmails);
        if (emailList.invalid() != null) {
            return ResponseEntity.badRequest().body(new OrderNotificationResponse(
                    false, "Invalid notification email: " + emailList.invalid(), enabled, rawEmails != null ? rawEmails.trim() : ""));
        }
        if (enabled && emailList.emails().isEmpty()) {
            return ResponseEntity.badRequest().body(new OrderNotificationResponse(
                    false, "At least one notification email is required", enabled, ""));
        }

        try {
            Company company = companyRepository.findById(UUID.fromString(companyId)).orElse(null);
            if (company == null) {
                return ResponseEntity.badRequest().body(new OrderNotificationResponse(
                        false, "Company not found", false, ""));
            }
            company.setNewOrderNotificationEnabled(enabled);
            company.setNewOrderNotificationEmails(String.join("\n", emailList.emails()));
            Company saved = companyRepository.save(company);
            return ResponseEntity.ok(new OrderNotificationResponse(
                    true,
                    enabled ? "New order email notification enabled" : "New order email notification disabled",
                    Boolean.TRUE.equals(saved.getNewOrderNotificationEnabled()),
                    saved.getNewOrderNotificationEmails() != null ? saved.getNewOrderNotificationEmails() : ""));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(new OrderNotificationResponse(
                    false, "Invalid company assigned to this account", false, ""));
        }
    }

    private EmailList normalizeEmails(String raw) {
        if (raw == null || raw.isBlank()) return new EmailList(List.of(), null);
        LinkedHashMap<String, String> unique = new LinkedHashMap<>();
        for (String part : raw.split("[\\s,;]+")) {
            String email = part != null ? part.trim() : "";
            if (email.isEmpty()) continue;
            if (!EMAIL_PATTERN.matcher(email).matches()) {
                return new EmailList(List.of(), email);
            }
            unique.putIfAbsent(email.toLowerCase(), email);
        }
        return new EmailList(List.copyOf(unique.values()), null);
    }

    @PostMapping("/shop/reset")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','USER')")
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
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','USER')")
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
            } else if ("RICE".equalsIgnoreCase(request.type())) {
                shopSetupService.setupRiceShop(tid, cid);
                return ResponseEntity.ok(new ShopSetupResponse(true, "Quán cơm ready — 6 tables, Cơm Tấm với topping sườn/bì/chả/trứng, thêm hành/ớt/tốp mỡ"));
            } else {
                return ResponseEntity.badRequest().body(new ShopSetupResponse(false, "Unknown type: " + request.type()));
            }
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(new ShopSetupResponse(false, "Setup failed: " + e.getMessage()));
        }
    }
}
