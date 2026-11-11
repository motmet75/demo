package com.ams.bomcore.integration.vinhoadon;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class VinHoadonRelayPayloadTest {

    @Test
    void nextJobContainsOriginalCredentialFieldsNotJsonNodeMetadata() throws Exception {
        ObjectMapper mapper = new ObjectMapper();
        VinHoadonRelayService service = new VinHoadonRelayService(
                true, "test-only-relay-signing-secret-at-least-32-bytes", 30,
                new VinHoadonProperties(true, "https://ws.vin-hoadon.com", 10, 30));
        String code = service.generatePairCode().code();
        VinHoadonRelayService.Tokens tokens = service.pair(code, UUID.randomUUID().toString());
        String bearer = "Bearer " + tokens.accessToken();

        // Establish a live agent; this also works before any pending jobs exist.
        service.take(bearer);
        ObjectNode login = mapper.createObjectNode()
                .put("doanhnghiep_mst", "0123456789")
                .put("username", "sample-user")
                .put("password", "sample-password");

        ExecutorService executor = Executors.newSingleThreadExecutor();
        try {
            Future<VinHoadonRelayService.Reply> reply = executor.submit(
                    () -> service.forward("https://demows.vin-hoadon.com", VinHoadonClient.TOKEN_PATH, login, null));
            VinHoadonRelayService.Job job = null;
            for (int i = 0; i < 100 && job == null; i++) {
                job = service.take(bearer);
                if (job == null) Thread.sleep(10);
            }

            assertNotNull(job, "Chrome should receive the queued VIN request");
            assertEquals("https://demows.vin-hoadon.com", job.baseUrl());
            assertEquals(Set.of("doanhnghiep_mst", "username", "password"),
                    job.payload().keySet());
            assertEquals("0123456789", job.payload().get("doanhnghiep_mst"));
            assertEquals("sample-user", job.payload().get("username"));
            assertEquals("sample-password", job.payload().get("password"));
            assertFalse(job.payload().containsKey("nodeType"));
            assertFalse(job.payload().containsKey("containerNode"));

            // The payload is an ordinary Java map, safe for MVC JSON converters
            // that do not have Jackson's custom JsonNode serializer.
            String body = mapper.writeValueAsString(job.payload());
            assertTrue(mapper.readTree(body).has("doanhnghiep_mst"));

            service.finish(bearer, new VinHoadonRelayService.Result(
                    job.id(), 200, "{}", null));
            assertEquals(200, reply.get(3, TimeUnit.SECONDS).status());
        } finally {
            executor.shutdownNow();
        }
    }

    @Test
    void relayAcceptsOnlyOfficialProductionAndDemoOrigins() {
        String secret = "test-only-relay-signing-secret-at-least-32-bytes";
        assertDoesNotThrow(() -> new VinHoadonRelayService(
                true, secret, 30,
                new VinHoadonProperties(true, "https://demows.vin-hoadon.com", 10, 30)));
        assertThrows(IllegalStateException.class, () -> new VinHoadonRelayService(
                true, secret, 30,
                new VinHoadonProperties(true, "https://demows.vin-hoadon.com/untrusted-path", 10, 30)));
        assertThrows(IllegalStateException.class, () -> new VinHoadonRelayService(
                true, secret, 30,
                new VinHoadonProperties(true, "https://example.com", 10, 30)));
    }
}
