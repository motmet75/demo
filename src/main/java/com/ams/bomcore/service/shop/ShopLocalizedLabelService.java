package com.ams.bomcore.service.shop;

import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import com.ams.bomcore.domain.shop.ShopLocalizedLabel;
import com.ams.bomcore.repository.ShopLocalizedLabelRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ShopLocalizedLabelService {

    public static final String ORDER_STATUS = "shop_order_status";
    public static final String PAYMENT_STATUS = "shop_payment_status";
    public static final String PAYMENT_METHOD = "shop_payment_method";
    public static final String FULFILLMENT_TYPE = "shop_fulfillment_type";
    public static final String ACTION = "shop_action";

    private static final Map<String, Map<String, String>> FALLBACK_LABELS = Map.ofEntries(
            label(ORDER_STATUS, "PENDING", "Placed", "Vừa đặt món", "已下单"),
            label(ORDER_STATUS, "CONFIRMED", "Confirmed", "Đã xác nhận", "已确认"),
            label(ORDER_STATUS, "PREPARING", "Preparing", "Đang chuẩn bị", "制作中"),
            label(ORDER_STATUS, "READY", "Ready", "Sẵn sàng", "已准备好"),
            label(ORDER_STATUS, "PICKED_UP", "Picked Up", "Đã nhận", "已取餐"),
            label(ORDER_STATUS, "COMPLETED", "Completed", "Hoàn tất", "已完成"),
            label(ORDER_STATUS, "CANCELLED", "Cancelled", "Đã hủy", "已取消"),
            label(PAYMENT_STATUS, "UNPAID", "Unpaid", "Chưa thanh toán", "未付款"),
            label(PAYMENT_STATUS, "PAID", "Paid", "Đã thanh toán", "已付款"),
            label(PAYMENT_METHOD, "CASH", "Cash", "Tiền mặt", "现金"),
            label(PAYMENT_METHOD, "BANK_QR", "Bank QR", "Chuyển khoản QR", "银行二维码"),
            label(PAYMENT_METHOD, "SPLIT", "Split Payment", "Thanh toán tách", "拆分付款"),
            label(FULFILLMENT_TYPE, "DINE_IN", "Dine In", "Ăn tại chỗ", "堂食"),
            label(FULFILLMENT_TYPE, "PICKUP", "Pickup", "Mang đi", "自取"),
            label(FULFILLMENT_TYPE, "DELIVERY", "Delivery", "Giao hàng", "配送"),
            label(ACTION, "VIEW_ORDER", "View Order", "Xem đơn", "查看订单"),
            label(ACTION, "EDIT_ORDER", "Edit Order", "Sửa đơn hàng", "编辑订单"),
            label(ACTION, "PAY", "Pay", "Thanh toán", "付款")
    );

    private final ShopLocalizedLabelRepository localizedLabelRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ShopLocalizedLabelService(ShopLocalizedLabelRepository localizedLabelRepository) {
        this.localizedLabelRepository = localizedLabelRepository;
    }

    @Transactional(readOnly = true)
    public Map<String, Map<String, String>> labelMap(UUID tenantId, UUID companyId) {
        Map<String, Map<String, String>> labels = new LinkedHashMap<>();
        FALLBACK_LABELS.forEach((key, value) -> labels.put(key, new LinkedHashMap<>(value)));

        if (tenantId == null || companyId == null) {
            return labels;
        }

        List<ShopLocalizedLabel> rows = localizedLabelRepository.findActiveForScope(tenantId, companyId);
        for (ShopLocalizedLabel row : rows) {
            String key = labelKey(row.getLabelNamespace(), row.getLabelKey());
            Map<String, String> translations = parseTranslations(row.getTranslations());
            if (row.getDefaultText() != null && !row.getDefaultText().isBlank()) {
                translations.putIfAbsent("en", row.getDefaultText().trim());
            }
            if (!translations.isEmpty()) {
                labels.put(key, translations);
            }
        }
        return labels;
    }

    @Transactional(readOnly = true)
    public ShopOrderResponseDto applyToOrder(ShopOrderResponseDto dto) {
        if (dto == null) return null;
        return applyToOrder(dto, labelMap(dto.getTenantId(), dto.getCompanyId()));
    }

    public ShopOrderResponseDto applyToOrder(ShopOrderResponseDto dto, Map<String, Map<String, String>> labels) {
        if (dto == null) return null;
        dto.setStatusLabels(translations(labels, ORDER_STATUS, dto.getStatus()));
        dto.setPaymentStatusLabels(translations(labels, PAYMENT_STATUS, dto.getPaymentStatus()));
        dto.setPaymentMethodLabels(translations(labels, PAYMENT_METHOD, dto.getPaymentMethod()));
        dto.setFulfillmentTypeLabels(translations(labels, FULFILLMENT_TYPE, dto.getFulfillmentType()));
        return dto;
    }

    public Map<String, String> translations(Map<String, Map<String, String>> labels, String namespace, String key) {
        if (key == null || key.isBlank()) return Map.of();
        Map<String, String> value = labels.get(labelKey(namespace, key));
        return value == null ? Map.of() : value;
    }

    private Map<String, String> parseTranslations(String raw) {
        Map<String, String> result = new LinkedHashMap<>();
        if (raw == null || raw.isBlank()) return result;
        try {
            Map<String, Object> parsed = objectMapper.readValue(raw, new TypeReference<>() {});
            parsed.forEach((key, value) -> {
                if (key != null && value != null && !value.toString().trim().isEmpty()) {
                    result.put(key.trim().toLowerCase(), value.toString().trim());
                }
            });
        } catch (Exception ignored) {
        }
        return result;
    }

    private static Map.Entry<String, Map<String, String>> label(String namespace, String key,
                                                                String en, String vi, String cn) {
        return Map.entry(labelKey(namespace, key), Map.of(
                "en", en,
                "vi", vi,
                "cn", cn,
                "tw", cn
        ));
    }

    private static String labelKey(String namespace, String key) {
        return namespace + "." + key;
    }
}
