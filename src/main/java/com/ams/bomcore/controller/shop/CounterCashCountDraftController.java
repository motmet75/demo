package com.ams.bomcore.controller.shop;

import com.ams.bomcore.domain.user.User;
import com.ams.bomcore.service.shop.CounterCashCountDraftCache;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

import static org.springframework.http.HttpStatus.BAD_REQUEST;
import static org.springframework.http.HttpStatus.FORBIDDEN;

@RestController
@RequestMapping("/shop/staff/counter/cash-count-draft")
public class CounterCashCountDraftController {
    public record DraftPayload(Map<String,Object> denominationCounts) {}

    private final JdbcTemplate db;
    private final CounterCashCountDraftCache cache;

    public CounterCashCountDraftController(JdbcTemplate db, CounterCashCountDraftCache cache) {
        this.db = db;
        this.cache = cache;
    }

    @GetMapping
    public ResponseEntity<?> get(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                 @RequestHeader("X-Company-Id") UUID companyId,
                                 @RequestParam String scopeId,
                                 Authentication authentication) {
        validateScope(tenantId, companyId, authentication);
        return cache.get(tenantId, companyId, authentication.getName(), scopeId)
                .<ResponseEntity<?>>map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    public ResponseEntity<?> save(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                  @RequestHeader("X-Company-Id") UUID companyId,
                                  @RequestParam String scopeId,
                                  Authentication authentication,
                                  @RequestBody DraftPayload payload) {
        validateScope(tenantId, companyId, authentication);
        if (payload == null || payload.denominationCounts() == null) {
            throw new ResponseStatusException(BAD_REQUEST, "Thiếu chi tiết kiểm đếm");
        }
        try {
            return ResponseEntity.ok(cache.save(tenantId, companyId, authentication.getName(),
                    scopeId, payload.denominationCounts()));
        } catch (IllegalArgumentException error) {
            throw new ResponseStatusException(BAD_REQUEST, error.getMessage());
        }
    }

    @DeleteMapping
    public ResponseEntity<?> clear(@RequestHeader("X-Tenant-Id") UUID tenantId,
                                   @RequestHeader("X-Company-Id") UUID companyId,
                                   @RequestParam String scopeId,
                                   Authentication authentication) {
        validateScope(tenantId, companyId, authentication);
        return ResponseEntity.ok(Map.of("cleared",
                cache.clear(tenantId, companyId, authentication.getName(), scopeId)));
    }

    private void validateScope(UUID tenantId, UUID companyId, Authentication authentication) {
        if (authentication == null) throw new ResponseStatusException(FORBIDDEN, "Chưa đăng nhập");
        if (authentication.getPrincipal() instanceof User user
                && authentication.getAuthorities().stream().noneMatch(a -> a.getAuthority().equals("ROLE_SUPER_ADMIN"))) {
            if (!tenantId.toString().equals(user.getAssignedTenantId())
                    || (user.getAssignedCompanyId() != null && !user.getAssignedCompanyId().isBlank()
                    && !companyId.toString().equals(user.getAssignedCompanyId()))) {
                throw new ResponseStatusException(FORBIDDEN, "Không có quyền truy cập cửa hàng");
            }
        }
        Boolean valid = db.queryForObject(
                "SELECT EXISTS(SELECT 1 FROM company WHERE id=? AND tenant_id=?)",
                Boolean.class, companyId, tenantId);
        if (!Boolean.TRUE.equals(valid)) throw new ResponseStatusException(BAD_REQUEST, "Cửa hàng không hợp lệ");
    }
}
