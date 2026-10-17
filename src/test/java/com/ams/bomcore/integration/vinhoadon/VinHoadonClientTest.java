package com.ams.bomcore.integration.vinhoadon;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

class VinHoadonClientTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void cachesTokenInjectsSellerTaxCodeAndUnwrapsStringResult() throws Exception {
        AtomicInteger tokenCalls = new AtomicInteger();
        AtomicInteger issueCalls = new AtomicInteger();
        startServer(exchange -> {
            if (exchange.getRequestURI().getPath().equals(VinHoadonClient.TOKEN_PATH)) {
                tokenCalls.incrementAndGet();
                JsonNode request = readJson(exchange);
                assertEquals("0123456789", request.path("doanhnghiep_mst").asText());
                respond(exchange, 200,
                        "{\"result\":{\"access_token\":\"token-1\",\"expire_in_seconds\":3600}}");
                return;
            }

            issueCalls.incrementAndGet();
            assertEquals("Bearer token-1", exchange.getRequestHeaders().getFirst("Authorization"));
            JsonNode request = readJson(exchange);
            assertEquals("0123456789", request.path("doanhnghiep_mst").asText());
            respond(exchange, 200,
                    "{\"result\":\"{\\\"maketqua\\\":\\\"01\\\",\\\"magiaodich\\\":\\\"TX-1\\\"}\"}");
        });

        VinHoadonClient client = client();
        VinHoadonCredentials credentials = credentials();
        JsonNode invoice = objectMapper.createObjectNode().put("ma_hoadon", "LOCAL-1");

        assertEquals("01", client.issueOriginalHsm(invoice, credentials).path("maketqua").asText());
        assertEquals("TX-1", client.issueOriginalHsm(invoice, credentials).path("magiaodich").asText());
        assertEquals(1, tokenCalls.get());
        assertEquals(2, issueCalls.get());
    }

    @Test
    void refreshesTokenAndRetriesOnceAfterUnauthorized() throws Exception {
        AtomicInteger tokenCalls = new AtomicInteger();
        AtomicInteger issueCalls = new AtomicInteger();
        startServer(exchange -> {
            if (exchange.getRequestURI().getPath().equals(VinHoadonClient.TOKEN_PATH)) {
                int call = tokenCalls.incrementAndGet();
                readJson(exchange);
                respond(exchange, 200, "{\"access_token\":\"token-" + call
                        + "\",\"expire_in_seconds\":3600}");
                return;
            }

            readJson(exchange);
            int call = issueCalls.incrementAndGet();
            if (call == 1) {
                assertEquals("Bearer token-1", exchange.getRequestHeaders().getFirst("Authorization"));
                respond(exchange, 401, "{\"error\":\"expired\"}");
                return;
            }
            assertEquals("Bearer token-2", exchange.getRequestHeaders().getFirst("Authorization"));
            respond(exchange, 200, "{\"maketqua\":\"01\"}");
        });

        JsonNode response = client().issueOriginalHsm(
                objectMapper.createObjectNode().put("ma_hoadon", "LOCAL-2"), credentials());

        assertEquals("01", response.path("maketqua").asText());
        assertEquals(2, tokenCalls.get());
        assertEquals(2, issueCalls.get());
    }

    @Test
    void rejectsSellerTaxCodeThatDoesNotMatchCredentials() throws Exception {
        startServer(exchange -> respond(exchange, 500, "{}"));
        JsonNode invoice = objectMapper.createObjectNode().put("doanhnghiep_mst", "wrong");

        IllegalArgumentException error = assertThrows(IllegalArgumentException.class,
                () -> client().issueOriginalHsm(invoice, credentials()));

        assertEquals("Invoice seller tax code does not match VIN-HOADON credentials", error.getMessage());
    }

    private VinHoadonClient client() {
        String baseUrl = "http://127.0.0.1:" + server.getAddress().getPort();
        VinHoadonProperties properties = new VinHoadonProperties(true, baseUrl, 2, 2);
        return new VinHoadonClient(objectMapper, properties,
                HttpClient.newBuilder().connectTimeout(properties.getConnectTimeout()).build(),
                Clock.systemUTC());
    }

    private VinHoadonCredentials credentials() {
        return new VinHoadonCredentials("0123456789", "api-user", "secret");
    }

    private void startServer(ExchangeHandler handler) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            try {
                handler.handle(exchange);
            } catch (Throwable throwable) {
                if (exchange.getResponseCode() == -1) {
                    respond(exchange, 500, "{\"error\":\"test handler failed\"}");
                }
                if (throwable instanceof AssertionError assertionError) {
                    throw assertionError;
                }
                throw new IOException(throwable);
            }
        });
        server.start();
    }

    private JsonNode readJson(HttpExchange exchange) throws IOException {
        return objectMapper.readTree(exchange.getRequestBody());
    }

    private static void respond(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");
        exchange.sendResponseHeaders(status, bytes.length);
        exchange.getResponseBody().write(bytes);
        exchange.close();
    }

    @FunctionalInterface
    private interface ExchangeHandler {
        void handle(HttpExchange exchange) throws Exception;
    }
}
