package com.ams.bomcore.controller.admin;

import com.ams.bomcore.service.portalcontent.PortalPublicSnapshotService;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** The private snapshot must never be exposed through a public API route. */
class PortalPublicBridgeControllerTest {
    private static final String TOKEN = "test-token-over-thirty-two-characters-long";

    @Test
    void failsClosedWhenTokenNotConfigured() {
        var service = mock(PortalPublicSnapshotService.class);
        var controller = new PortalPublicBridgeController(service, "");
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        assertThrows(ResponseStatusException.class,
                () -> controller.home("nncminhchau.vn", "vi", TOKEN, request));
        verifyNoInteractions(service);
    }

    @Test
    void rejectsNoTokenAndNonLoopbackEvenWithValidToken() {
        var service = mock(PortalPublicSnapshotService.class);
        var controller = new PortalPublicBridgeController(service, TOKEN);
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        assertThrows(ResponseStatusException.class,
                () -> controller.home("anhmedia.vn", "en", null, request));
        request.setRemoteAddr("10.0.0.9");
        assertThrows(ResponseStatusException.class,
                () -> controller.home("anhmedia.vn", "en", TOKEN, request));
        verifyNoInteractions(service);
    }

    @Test
    void forwardsOnlyTokenVerifiedLoopbackRequestsWithExplicitTenant() {
        var service = mock(PortalPublicSnapshotService.class);
        when(service.home("anhmedia.vn", "vi"))
                .thenReturn(Map.of("tenantId", "anhmedia.vn", "articles", java.util.List.of()));
        var controller = new PortalPublicBridgeController(service, TOKEN);
        var request = new MockHttpServletRequest();
        request.setRemoteAddr("127.0.0.1");
        assertEquals("anhmedia.vn",
                controller.home("anhmedia.vn", "vi", TOKEN, request).get("tenantId"));
        verify(service).home("anhmedia.vn", "vi");
        verifyNoMoreInteractions(service);
    }
}
