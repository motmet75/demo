package com.ams.bomcore.service.shop;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ShopWebPushServiceTest {
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
