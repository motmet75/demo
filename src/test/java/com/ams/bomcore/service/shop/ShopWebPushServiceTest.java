package com.ams.bomcore.service.shop;

import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.List;
import com.ams.bomcore.controller.shop.dto.ShopOrderResponseDto;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class ShopWebPushServiceTest {
    @Test void maskedOrderCodeShowsOnlyLastFiveCharacters() {
        assertEquals("…12345", ShopWebPushService.lastFiveCode("2026111800012345"));
        assertEquals("12345", ShopWebPushService.lastFiveCode("12345"));
        assertEquals("42", ShopWebPushService.lastFiveCode("42"));
        assertNull(ShopWebPushService.lastFiveCode(" "));
    }

    @Test void pendingOrderShowsCompanyOrderDetailsWithoutFakeSequence() {
        ShopOrderResponseDto order = mock(ShopOrderResponseDto.class);
        ShopOrderResponseDto.ItemDto main = mock(ShopOrderResponseDto.ItemDto.class);
        ShopOrderResponseDto.ItemDto topping = mock(ShopOrderResponseDto.ItemDto.class);
        when(order.getTableName()).thenReturn("05");
        when(order.getOrderCode()).thenReturn("2026111800012345");
        when(order.getTotalAmount()).thenReturn(new BigDecimal("350000"));
        when(order.getItems()).thenReturn(List.of(main, topping));
        when(main.getQuantity()).thenReturn(new BigDecimal("6"));
        when(topping.getParentItemId()).thenReturn(java.util.UUID.randomUUID());
        when(topping.getQuantity()).thenReturn(new BigDecimal("2"));

        assertEquals("Đơn QR mới · Bàn 05", ShopWebPushService.orderNotificationTitle(order));
        String body = ShopWebPushService.orderNotificationBody(order);
        assertTrue(body.contains("6 món"));
        assertTrue(body.contains("350.000đ"));
        assertTrue(body.endsWith("Mã …12345"));
        assertFalse(body.contains("2026111800012345"));
        assertFalse(body.contains("5 số đơn gần nhất"));
    }

    @Test void numericSequenceTakesPriorityWhenAssigned() {
        ShopOrderResponseDto order = mock(ShopOrderResponseDto.class);
        when(order.getDailySeq()).thenReturn(15);
        when(order.getOrderNumber()).thenReturn(1052);
        when(order.getCustomerTableTag()).thenReturn("B7");
        assertEquals("STT 15 · Bàn B7", ShopWebPushService.orderNotificationTitle(order));
    }

    @Test void acceptsKnownPushGateways() {
        assertTrue(ShopWebPushService.allowedEndpoint("https://web.push.apple.com/QjE2abc"));
        assertTrue(ShopWebPushService.allowedEndpoint("https://fcm.googleapis.com/fcm/send/abc"));
        assertTrue(ShopWebPushService.allowedEndpoint("https://updates.push.services.mozilla.com/wpush/v2/abc"));
    }

    @Test void rejectsUnsafePushGateways() {
        assertFalse(ShopWebPushService.allowedEndpoint("http://127.0.0.1/"));
        assertFalse(ShopWebPushService.allowedEndpoint("https://localhost/admin"));
        assertFalse(ShopWebPushService.allowedEndpoint("https://web.push.apple.com.evil.example/send"));
        assertFalse(ShopWebPushService.allowedEndpoint("https://attacker@web.push.apple.com/send"));
        assertFalse(ShopWebPushService.allowedEndpoint("https://web.push.apple.com:8443/send"));
        assertFalse(ShopWebPushService.allowedEndpoint("file:///etc/passwd"));
        assertFalse(ShopWebPushService.allowedEndpoint(null));
    }
}
