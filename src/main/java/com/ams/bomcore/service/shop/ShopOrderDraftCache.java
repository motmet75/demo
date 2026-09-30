package com.ams.bomcore.service.shop;

import com.fasterxml.jackson.annotation.JsonAutoDetect;
import com.fasterxml.jackson.annotation.PropertyAccessor;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Shared Redis-backed table carts. They are never written to the order database. */
@Component
public class ShopOrderDraftCache {
    private static final Duration TTL = Duration.ofHours(12);
    private static final String KEY_PREFIX = "shop:order-draft:";
    private static final ObjectMapper JSON = createJsonMapper();

    public record DraftPayload(String draftId,
                               ShopOrderService.CreateOrderRequest order,
                               List<Map<String,Object>> displayItems) {}

    public record DraftView(String draftId,
                            UUID tableId,
                            ShopOrderService.CreateOrderRequest order,
                            List<Map<String,Object>> displayItems,
                            String updatedBy,
                            Instant updatedAt) {}

    private final StringRedisTemplate redis;

    private static ObjectMapper createJsonMapper() {
        SimpleModule timeModule = new SimpleModule();
        timeModule.addSerializer(Instant.class, new JsonSerializer<>() {
            @Override
            public void serialize(Instant value, JsonGenerator generator, SerializerProvider serializers) throws IOException {
                generator.writeString(value.toString());
            }
        });
        timeModule.addDeserializer(Instant.class, new JsonDeserializer<>() {
            @Override
            public Instant deserialize(JsonParser parser, DeserializationContext context) throws IOException {
                return Instant.parse(parser.getValueAsString());
            }
        });
        return new ObjectMapper()
                .registerModule(timeModule)
                .setVisibility(PropertyAccessor.ALL, JsonAutoDetect.Visibility.NONE)
                .setVisibility(PropertyAccessor.FIELD, JsonAutoDetect.Visibility.ANY);
    }

    public ShopOrderDraftCache(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public DraftView save(UUID tenantId, UUID companyId, UUID tableId, DraftPayload payload, String username) {
        String draftId = payload.draftId() == null || payload.draftId().isBlank()
                ? UUID.randomUUID().toString() : payload.draftId();
        DraftView saved = new DraftView(draftId, tableId, payload.order(),
                payload.displayItems() == null ? List.of() : List.copyOf(payload.displayItems()),
                username, Instant.now());
        redis.opsForValue().set(key(tenantId, companyId, tableId, draftId), encode(saved), TTL);
        String legacyKey = legacyKey(tenantId, companyId, tableId);
        decode(redis.opsForValue().get(legacyKey))
                .filter(legacy -> draftId.equals(legacy.draftId()))
                .ifPresent(ignored -> redis.delete(legacyKey));
        return saved;
    }

    public Optional<DraftView> get(UUID tenantId, UUID companyId, UUID tableId) {
        return list(tenantId, companyId, tableId).stream().findFirst();
    }

    public Optional<DraftView> get(UUID tenantId, UUID companyId, UUID tableId, String draftId) {
        if (draftId == null || draftId.isBlank()) return get(tenantId, companyId, tableId);
        Optional<DraftView> current = decode(redis.opsForValue().get(key(tenantId, companyId, tableId, draftId)));
        if (current.isPresent()) return current;
        return decode(redis.opsForValue().get(legacyKey(tenantId, companyId, tableId)))
                .filter(draft -> draftId.equals(draft.draftId()));
    }

    public Optional<DraftView> take(UUID tenantId, UUID companyId, UUID tableId, String draftId) {
        Optional<DraftView> selected = get(tenantId, companyId, tableId, draftId);
        if (selected.isEmpty()) return Optional.empty();
        DraftView draft = selected.get();
        String currentKey = key(tenantId, companyId, tableId, draft.draftId());
        Optional<DraftView> removed = decode(redis.opsForValue().getAndDelete(currentKey));
        if (removed.isPresent()) return removed;
        return decode(redis.opsForValue().getAndDelete(legacyKey(tenantId, companyId, tableId)))
                .filter(value -> draft.draftId().equals(value.draftId()));
    }

    public List<DraftView> list(UUID tenantId, UUID companyId) {
        Set<String> keys = redis.keys(scopePrefix(tenantId, companyId) + "*");
        if (keys == null || keys.isEmpty()) return List.of();
        List<String> values = redis.opsForValue().multiGet(keys);
        if (values == null) return List.of();
        Map<String,DraftView> unique = new LinkedHashMap<>();
        values.stream()
                .map(ShopOrderDraftCache::decode)
                .flatMap(Optional::stream)
                .sorted(Comparator.comparing(DraftView::updatedAt).reversed())
                .forEach(draft -> unique.putIfAbsent(draft.tableId() + ":" + draft.draftId(), draft));
        return List.copyOf(unique.values());
    }

    public List<DraftView> list(UUID tenantId, UUID companyId, UUID tableId) {
        return list(tenantId, companyId).stream()
                .filter(draft -> tableId.equals(draft.tableId()))
                .toList();
    }

    public void restoreIfAbsent(UUID tenantId, UUID companyId, UUID tableId, DraftView draft) {
        if (draft != null) redis.opsForValue().setIfAbsent(key(tenantId, companyId, tableId, draft.draftId()), encode(draft), TTL);
    }

    public boolean clear(UUID tenantId, UUID companyId, UUID tableId, String draftId) {
        Optional<DraftView> selected = get(tenantId, companyId, tableId, draftId);
        if (selected.isEmpty()) return false;
        DraftView draft = selected.get();
        if (Boolean.TRUE.equals(redis.delete(key(tenantId, companyId, tableId, draft.draftId())))) return true;
        Optional<DraftView> legacy = decode(redis.opsForValue().get(legacyKey(tenantId, companyId, tableId)));
        return legacy.filter(value -> draft.draftId().equals(value.draftId()))
                .map(value -> Boolean.TRUE.equals(redis.delete(legacyKey(tenantId, companyId, tableId))))
                .orElse(false);
    }

    private String key(UUID tenantId, UUID companyId, UUID tableId, String draftId) {
        return scopePrefix(tenantId, companyId) + tableId + ":" + draftId;
    }

    private String legacyKey(UUID tenantId, UUID companyId, UUID tableId) {
        return scopePrefix(tenantId, companyId) + tableId;
    }

    private String scopePrefix(UUID tenantId, UUID companyId) {
        return KEY_PREFIX + tenantId + ":" + companyId + ":";
    }

    static String encode(DraftView draft) {
        try {
            return JSON.writeValueAsString(draft);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Không thể lưu đơn tạm vào Redis", error);
        }
    }

    static Optional<DraftView> decode(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        try {
            return Optional.of(JSON.readValue(value, DraftView.class));
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Dữ liệu đơn tạm trong Redis không hợp lệ", error);
        }
    }
}
