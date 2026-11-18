package com.ams.bomcore.controller.shop;

import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.service.shop.ShopWebPushService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

/**
 * Staff-only Web Push registration. Company and tenant must match the
 * authenticated staff user's assignment, not merely client-supplied headers.
 * Spring Security already protects /shop/staff/** with shop staff roles.
 */
@RestController
@RequestMapping("/shop/staff/push")
public class ShopPushController {
    public record Keys(String p256dh, String auth) {}
    public record Subscription(String endpoint, Keys keys) {}

    private final ShopWebPushService push;
    private final JdbcTemplate jdbc;

    public ShopPushController(ShopWebPushService push, JdbcTemplate jdbc) {
        this.push = push;
        this.jdbc = jdbc;
    }

    @GetMapping("/public-key")
    public Map<String, String> publicKey() {
        return Map.of("publicKey", push.publicKey());
    }

    @PostMapping("/subscriptions")
    public ResponseEntity<?> subscribe(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                       @RequestHeader("X-Company-Id") UUID companyId,
                                       Authentication authentication,
                                       @RequestBody Subscription subscription) {
        validateScope(tenantId, companyId, authentication);
        if (subscription == null || subscription.keys() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing subscription");
        }
        push.subscribe(tenantId, companyId, authentication.getName(),
                subscription.endpoint(), subscription.keys().p256dh(),
                subscription.keys().auth());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/subscriptions")
    public ResponseEntity<?> unsubscribe(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                         @RequestHeader("X-Company-Id") UUID companyId,
                                         Authentication authentication,
                                         @RequestBody Subscription subscription) {
        validateScope(tenantId, companyId, authentication);
        if (subscription == null || subscription.endpoint() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Missing endpoint");
        }
        push.unsubscribe(tenantId, companyId, authentication.getName(), subscription.endpoint());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/test")
    public ResponseEntity<?> test(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                  @RequestHeader("X-Company-Id") UUID companyId,
                                  Authentication authentication) {
        validateScope(tenantId, companyId, authentication);
        push.enqueueTest(tenantId, companyId, authentication.getName());
        return ResponseEntity.accepted().body(Map.of("queued", true));
    }

    private void validateScope(UUID tenantId, UUID companyId, Authentication auth) {
        if (auth == null || !auth.isAuthenticated() || "anonymousUser".equals(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Login required");
        }
        boolean superAdmin = auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_SUPER_ADMIN".equals(a.getAuthority()));
        if (!superAdmin) {
            if (!(auth.getPrincipal() instanceof User user)) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Authenticated staff account required");
            }
            if (!tenantId.toString().equals(user.getAssignedTenantId())
                    || (user.getAssignedCompanyId() != null
                        && !user.getAssignedCompanyId().isBlank()
                        && !companyId.toString().equals(user.getAssignedCompanyId()))) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "No access to this shop");
            }
        }
        Boolean exists = jdbc.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM company WHERE id=? AND tenant_id=?)",
                Boolean.class, companyId, tenantId);
        if (!Boolean.TRUE.equals(exists)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid company scope");
        }
    }
}
