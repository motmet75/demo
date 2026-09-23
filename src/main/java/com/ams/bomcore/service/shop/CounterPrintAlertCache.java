package com.ams.bomcore.service.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Ephemeral latest customer-order print alert per tenant/company. Public counter screens poll
 * this channel and decide locally whether to open the browser print preview.
 */
@Component
public class CounterPrintAlertCache {

    private static final long TTL_SECONDS = 600;

    public record CachedAlert(ShopOrderResponseDto order, Instant pushedAt) {}

    private final Map<String, CachedAlert> cache = new ConcurrentHashMap<>();

    public void push(UUID tenantId, UUID companyId, ShopOrderResponseDto order) {
        if (tenantId == null || companyId == null || order == null) return;
        cache.put(key(tenantId, companyId), new CachedAlert(order, Instant.now()));
    }

    public Optional<CachedAlert> latest(UUID tenantId, UUID companyId) {
        CachedAlert alert = cache.get(key(tenantId, companyId));
        if (alert == null) return Optional.empty();
        if (alert.pushedAt().isBefore(Instant.now().minusSeconds(TTL_SECONDS))) {
            cache.remove(key(tenantId, companyId));
            return Optional.empty();
        }
        return Optional.of(alert);
    }

    private String key(UUID tenantId, UUID companyId) {
        return tenantId + ":" + companyId;
    }
}
