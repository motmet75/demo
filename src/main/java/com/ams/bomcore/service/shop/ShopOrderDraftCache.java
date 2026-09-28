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
        redis.opsForValue().set(key(tenantId, companyId, tableId), encode(saved), TTL);
        return saved;
    }

    public Optional<DraftView> get(UUID tenantId, UUID companyId, UUID tableId) {
        return decode(redis.opsForValue().get(key(tenantId, companyId, tableId)));
    }

    public Optional<DraftView> take(UUID tenantId, UUID companyId, UUID tableId) {
        return decode(redis.opsForValue().getAndDelete(key(tenantId, companyId, tableId)));
    }

    public List<DraftView> list(UUID tenantId, UUID companyId) {
        Set<String> keys = redis.keys(scopePrefix(tenantId, companyId) + "*");
        if (keys == null || keys.isEmpty()) return List.of();
        List<String> values = redis.opsForValue().multiGet(keys);
        if (values == null) return List.of();
        return values.stream()
                .map(ShopOrderDraftCache::decode)
                .flatMap(Optional::stream)
                .sorted(Comparator.comparing(DraftView::updatedAt).reversed())
                .toList();
    }

    public void restoreIfAbsent(UUID tenantId, UUID companyId, UUID tableId, DraftView draft) {
        if (draft != null) redis.opsForValue().setIfAbsent(key(tenantId, companyId, tableId), encode(draft), TTL);
    }

    public boolean clear(UUID tenantId, UUID companyId, UUID tableId, String draftId) {
        String key = key(tenantId, companyId, tableId);
        if (draftId == null || draftId.isBlank()) return Boolean.TRUE.equals(redis.delete(key));
        String removed = redis.opsForValue().getAndDelete(key);
        Optional<DraftView> removedDraft = decode(removed);
        if (removedDraft.isEmpty()) return false;
        if (draftId.equals(removedDraft.get().draftId())) return true;
        redis.opsForValue().setIfAbsent(key, removed, TTL);
        return false;
    }

    private String key(UUID tenantId, UUID companyId, UUID tableId) {
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
