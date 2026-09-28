package com.ams.bomcore.service.shop;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Per-user Redis draft for progressive counter cash denomination counting. */
@Component
public class CounterCashCountDraftCache {
    private static final String KEY_PREFIX = "shop:counter-cash-count-draft:";
    private static final Duration TTL = Duration.ofDays(7);
    private static final ObjectMapper JSON = new ObjectMapper();
    private static final Set<String> DENOMINATIONS = Set.of(
            "500000", "200000", "100000", "50000", "20000", "10000", "5000", "2000", "1000", "500");

    public record DraftView(String scopeId, Map<String,String> denominationCounts,
                            String username, String updatedAt) {}

    private final StringRedisTemplate redis;

    public CounterCashCountDraftCache(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public DraftView save(UUID tenantId, UUID companyId, String username, String scopeId,
                          Map<String,?> rawCounts) {
        String safeScope = required(scopeId, "Thiếu phạm vi ca cho bản nháp kiểm tiền");
        String safeUser = required(username, "Không xác định được người dùng");
        Map<String,String> counts = new LinkedHashMap<>();
        if (rawCounts != null) for (var entry : rawCounts.entrySet()) {
            String denomination = String.valueOf(entry.getKey());
            if (!DENOMINATIONS.contains(denomination)) continue;
            String raw = entry.getValue() == null ? "" : String.valueOf(entry.getValue()).replace(",", "").trim();
            if (raw.isEmpty()) { counts.put(denomination, ""); continue; }
            long count;
            try { count = Long.parseLong(raw); }
            catch (NumberFormatException error) { throw new IllegalArgumentException("Số lượng mệnh giá không hợp lệ"); }
            if (count < 0 || count > 1_000_000) throw new IllegalArgumentException("Số lượng mệnh giá ngoài phạm vi cho phép");
            counts.put(denomination, Long.toString(count));
        }
        DraftView draft = new DraftView(safeScope, Map.copyOf(counts), safeUser, Instant.now().toString());
        redis.opsForValue().set(key(tenantId, companyId, safeUser, safeScope), encode(draft), TTL);
        return draft;
    }

    public Optional<DraftView> get(UUID tenantId, UUID companyId, String username, String scopeId) {
        return decode(redis.opsForValue().get(key(tenantId, companyId,
                required(username, "Không xác định được người dùng"),
                required(scopeId, "Thiếu phạm vi ca cho bản nháp kiểm tiền"))));
    }

    public boolean clear(UUID tenantId, UUID companyId, String username, String scopeId) {
        return Boolean.TRUE.equals(redis.delete(key(tenantId, companyId,
                required(username, "Không xác định được người dùng"),
                required(scopeId, "Thiếu phạm vi ca cho bản nháp kiểm tiền"))));
    }

    private String key(UUID tenantId, UUID companyId, String username, String scopeId) {
        return KEY_PREFIX + tenantId + ":" + companyId + ":" + token(username) + ":" + token(scopeId);
    }

    private String token(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private String required(String value, String message) {
        if (value == null || value.isBlank() || value.length() > 200) throw new IllegalArgumentException(message);
        return value.trim();
    }

    private String encode(DraftView draft) {
        try { return JSON.writeValueAsString(draft); }
        catch (JsonProcessingException error) { throw new IllegalStateException("Không thể lưu bản nháp kiểm tiền vào Redis", error); }
    }

    private Optional<DraftView> decode(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        try { return Optional.of(JSON.readValue(value, DraftView.class)); }
        catch (JsonProcessingException error) { throw new IllegalStateException("Bản nháp kiểm tiền trong Redis không hợp lệ", error); }
    }
}
