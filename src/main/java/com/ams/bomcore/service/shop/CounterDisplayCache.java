package com.ams.bomcore.service.shop;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Ephemeral, in-memory cache of the "latest order pushed to the counter display" per
 * tenant/company. Backs cross-device sync for CounterDisplayPage so a push made from any
 * staff device (order created, split payment, voucher redeemed, live cart preview, etc.)
 * is visible on a counter-display TV running in a completely different browser/device.
 *
 * Deliberately not persisted: pushes can fire on every keystroke of a live cart preview,
 * so writing to the database here would be wasteful. Losing the cache on restart is fine —
 * the next staff action re-pushes it.
 */
@Component
public class CounterDisplayCache {

    private static final long TTL_SECONDS = 600; // matches the 10-minute TTL already used client-side

    public record CachedPush(Object payload, Instant pushedAt) {}

    private final Map<String, CachedPush> cache = new ConcurrentHashMap<>();

    public void push(UUID tenantId, UUID companyId, Object payload) {
        String k = key(tenantId, companyId);
        if (payload == null) {
            cache.remove(k);
            return;
        }
        cache.put(k, new CachedPush(payload, Instant.now()));
    }

    public Optional<CachedPush> latest(UUID tenantId, UUID companyId) {
        CachedPush p = cache.get(key(tenantId, companyId));
        if (p == null) return Optional.empty();
        if (p.pushedAt().isBefore(Instant.now().minusSeconds(TTL_SECONDS))) {
            cache.remove(key(tenantId, companyId));
            return Optional.empty();
        }
        return Optional.of(p);
    }

    private String key(UUID tenantId, UUID companyId) {
        return tenantId + ":" + companyId;
    }
}