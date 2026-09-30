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
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Redis is the source of truth while an order is PENDING. A pending order is
 * removed atomically before it is materialised as a CONFIRMED database order.
 */
@Component
public class ShopPendingOrderCache {
    private static final Duration TTL = Duration.ofHours(24);
    private static final String KEY_PREFIX = "shop:pending-order:";
    private static final ObjectMapper JSON = createJsonMapper();

    public record PendingOrder(
            UUID id,
            String orderCode,
            UUID tenantId,
            UUID companyId,
            ShopOrderService.CreateOrderRequest order,
            String staffName,
            Instant createdAt,
            Instant updatedAt,
            UUID customerId,
            boolean customerEditing,
            Instant customerEditingSince,
            boolean customerCancelled,
            String customerCancelNote,
            Instant pickupScannedAt
    ) {
        public PendingOrder withOrder(ShopOrderService.CreateOrderRequest value) {
            return new PendingOrder(id, orderCode, tenantId, companyId, value, staffName, createdAt,
                    Instant.now(), customerId, false, null, customerCancelled, customerCancelNote, pickupScannedAt);
        }

        public PendingOrder withCustomerEditing(boolean value) {
            return new PendingOrder(id, orderCode, tenantId, companyId, order, staffName, createdAt,
                    Instant.now(), customerId, value, value ? Instant.now() : null,
                    customerCancelled, customerCancelNote, pickupScannedAt);
        }

        public PendingOrder withCustomerCancelled(String note) {
            return new PendingOrder(id, orderCode, tenantId, companyId, order, staffName, createdAt,
                    Instant.now(), customerId, customerEditing, customerEditingSince, true, note, pickupScannedAt);
        }

        public PendingOrder withPickupScannedAt(Instant value) {
            return new PendingOrder(id, orderCode, tenantId, companyId, order, staffName, createdAt,
                    Instant.now(), customerId, customerEditing, customerEditingSince,
                    customerCancelled, customerCancelNote, value);
        }

        public PendingOrder withCustomerId(UUID value) {
            return new PendingOrder(id, orderCode, tenantId, companyId, order, staffName, createdAt,
                    Instant.now(), value, customerEditing, customerEditingSince,
                    customerCancelled, customerCancelNote, pickupScannedAt);
        }
    }

    private final StringRedisTemplate redis;

    public ShopPendingOrderCache(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public PendingOrder save(PendingOrder pending) {
        redis.opsForValue().set(key(pending.tenantId(), pending.companyId(), pending.id()), encode(pending), TTL);
        return pending;
    }

    public Optional<PendingOrder> get(UUID tenantId, UUID companyId, UUID orderId) {
        return decode(redis.opsForValue().get(key(tenantId, companyId, orderId)));
    }

    public Optional<PendingOrder> take(UUID tenantId, UUID companyId, UUID orderId) {
        return decode(redis.opsForValue().getAndDelete(key(tenantId, companyId, orderId)));
    }

    public void restoreIfAbsent(PendingOrder pending) {
        if (pending != null) {
            redis.opsForValue().setIfAbsent(
                    key(pending.tenantId(), pending.companyId(), pending.id()), encode(pending), TTL);
        }
    }

    public boolean delete(UUID tenantId, UUID companyId, UUID orderId) {
        return Boolean.TRUE.equals(redis.delete(key(tenantId, companyId, orderId)));
    }

    public List<PendingOrder> list(UUID tenantId, UUID companyId) {
        return values(scopePrefix(tenantId, companyId) + "*");
    }

    public Optional<PendingOrder> findByCode(String orderCode) {
        if (orderCode == null || orderCode.isBlank()) return Optional.empty();
        return values(KEY_PREFIX + "*").stream()
                .filter(value -> orderCode.equals(value.orderCode()))
                .findFirst();
    }

    public Optional<PendingOrder> findByCode(String orderCode, UUID tenantId, UUID companyId) {
        if (orderCode == null || orderCode.isBlank()) return Optional.empty();
        return list(tenantId, companyId).stream()
                .filter(value -> orderCode.equals(value.orderCode()))
                .findFirst();
    }

    private List<PendingOrder> values(String pattern) {
        Set<String> keys = redis.keys(pattern);
        if (keys == null || keys.isEmpty()) return List.of();
        List<String> values = redis.opsForValue().multiGet(keys);
        if (values == null) return List.of();
        return values.stream()
                .map(ShopPendingOrderCache::decode)
                .flatMap(Optional::stream)
                .sorted(Comparator.comparing(PendingOrder::createdAt).reversed())
                .toList();
    }

    private String key(UUID tenantId, UUID companyId, UUID orderId) {
        return scopePrefix(tenantId, companyId) + orderId;
    }

    private String scopePrefix(UUID tenantId, UUID companyId) {
        return KEY_PREFIX + tenantId + ":" + companyId + ":";
    }

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

    private static String encode(PendingOrder pending) {
        try {
            return JSON.writeValueAsString(pending);
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Không thể lưu đơn chờ vào Redis", error);
        }
    }

    private static Optional<PendingOrder> decode(String value) {
        if (value == null || value.isBlank()) return Optional.empty();
        try {
            return Optional.of(JSON.readValue(value, PendingOrder.class));
        } catch (JsonProcessingException error) {
            throw new IllegalStateException("Dữ liệu đơn chờ trong Redis không hợp lệ", error);
        }
    }
}
