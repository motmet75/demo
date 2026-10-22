package com.ams.bomcore.integration.vinhoadon;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Low-level VIN-HOADON v12.1 HTTP gateway.
 *
 * <p>This class intentionally does not map the application's invoice entity to
 * a fiscal invoice. That mapping depends on the registered invoice template,
 * tax treatment, signing mode, and a complete set of invoice lines. It does
 * provide the authenticated operations needed by that later mapping layer.</p>
 */
@Service
public class VinHoadonClient {

    static final String TOKEN_PATH = "/api/services/hddtws/Authentication/GetToken";
    static final String ISSUE_ORIGINAL_HSM_PATH =
            "/api/services/hddtws/QuanLyHoaDon/GuiVaKyHoadonGocHSM";
    static final String SEND_ORIGINAL_PATH =
            "/api/services/hddtws/QuanLyHoaDon/LapHoaDonGoc";
    static final String ISSUE_REPLACEMENT_HSM_PATH =
            "/api/services/hddtws/QuanLyHoaDon/GuiVaKyHoaDonThayTheHSM";
    static final String ISSUE_ADJUSTMENT_HSM_PATH =
            "/api/services/hddtws/QuanLyHoaDon/GuiVaKyHoaDonDieuChinhHSM";
    static final String LOOKUP_PATH =
            "/api/services/hddtws/TraCuuHoaDon/TraThongTinHoaDon";
    static final String DOWNLOAD_APPROVED_PDF_PATH =
            "/api/services/hddtws/TraCuuHoaDon/TaiHoaDonPdf";
    static final String DOWNLOAD_SIGNED_PDF_PATH =
            "/api/services/hddtws/TraCuuHoaDon/TaiHoaDonPdfKhongCanThueDuyet";
    static final String DOWNLOAD_SIGNED_XML_PATH =
            "/api/services/hddtws/TraCuuHoaDon/TaiXmlDaKy";

    private static final int MAX_ERROR_BODY_LENGTH = 4_096;

    private final ObjectMapper objectMapper;
    private final VinHoadonProperties properties;
    private final HttpClient httpClient;
    private final Clock clock;
    private final Map<String, CachedToken> tokenCache = new ConcurrentHashMap<>();

    @Autowired
    public VinHoadonClient(Optional<ObjectMapper> objectMapper, VinHoadonProperties properties) {
        this(objectMapper.orElseGet(ObjectMapper::new), properties,
                HttpClient.newBuilder().connectTimeout(properties.getConnectTimeout()).build(),
                Clock.systemUTC());
    }

    VinHoadonClient(ObjectMapper objectMapper, VinHoadonProperties properties,
                    HttpClient httpClient, Clock clock) {
        this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
        this.properties = Objects.requireNonNull(properties, "properties");
        this.httpClient = Objects.requireNonNull(httpClient, "httpClient");
        this.clock = Objects.requireNonNull(clock, "clock");
    }

    public TokenResponse authenticate(VinHoadonCredentials credentials) {
        ensureEnabled();
        ObjectNode request = objectMapper.createObjectNode()
                .put("doanhnghiep_mst", credentials.taxCode())
                .put("username", credentials.username())
                .put("password", credentials.password());
        JsonNode response;
        try {
            response = post(TOKEN_PATH, request, null);
        } catch (VinHoadonApiException exception) {
            if (exception.getStatusCode() <= 0) throw exception;
            throw new VinHoadonApiException(
                    "VIN-HOADON token endpoint returned HTTP " + exception.getStatusCode(),
                    exception.getStatusCode(), exception.getResponseBody());
        }
        JsonNode payload = unwrapResult(response);

        String accessToken = requiredText(payload, "access_token");
        long vendorExpiry = payload.path("expire_in_seconds").asLong(300);
        long expirySeconds = normalizeExpirySeconds(vendorExpiry);
        long skewSeconds = Math.min(60, Math.max(1, expirySeconds / 10));
        CachedToken cached = new CachedToken(accessToken,
                clock.instant().plusSeconds(Math.max(1, expirySeconds - skewSeconds)));
        tokenCache.put(credentials.cacheKey(), cached);

        return new TokenResponse(
                accessToken,
                textOrNull(payload, "encrypted_access_token"),
                vendorExpiry,
                textOrNull(payload, "token_type"));
    }

    public JsonNode issueOriginalHsm(JsonNode invoice, VinHoadonCredentials credentials) {
        return authorizedInvoicePost(ISSUE_ORIGINAL_HSM_PATH, invoice, credentials);
    }

    /** Saves an unsigned original invoice in VIN-HOADON for review and later signing. */
    public JsonNode sendOriginal(JsonNode invoice, VinHoadonCredentials credentials) {
        return authorizedInvoicePost(SEND_ORIGINAL_PATH, invoice, credentials);
    }

    public JsonNode issueReplacementHsm(JsonNode invoice, VinHoadonCredentials credentials) {
        return authorizedInvoicePost(ISSUE_REPLACEMENT_HSM_PATH, invoice, credentials);
    }

    public JsonNode issueAdjustmentHsm(JsonNode invoice, VinHoadonCredentials credentials) {
        return authorizedInvoicePost(ISSUE_ADJUSTMENT_HSM_PATH, invoice, credentials);
    }

    public JsonNode lookupInvoice(InvoiceReference reference, VinHoadonCredentials credentials) {
        return authorizedPost(LOOKUP_PATH, referencePayload(reference, credentials), credentials);
    }

    public JsonNode downloadApprovedPdf(InvoiceReference reference, VinHoadonCredentials credentials) {
        return authorizedPost(DOWNLOAD_APPROVED_PDF_PATH, referencePayload(reference, credentials), credentials);
    }

    public JsonNode downloadSignedPdf(InvoiceReference reference, VinHoadonCredentials credentials) {
        return authorizedPost(DOWNLOAD_SIGNED_PDF_PATH, referencePayload(reference, credentials), credentials);
    }

    public JsonNode downloadSignedXml(InvoiceReference reference, VinHoadonCredentials credentials) {
        return authorizedPost(DOWNLOAD_SIGNED_XML_PATH, referencePayload(reference, credentials), credentials);
    }

    public void invalidateToken(VinHoadonCredentials credentials) {
        tokenCache.remove(credentials.cacheKey());
    }

    private JsonNode authorizedInvoicePost(String path, JsonNode invoice,
                                           VinHoadonCredentials credentials) {
        if (invoice == null || !invoice.isObject()) {
            throw new IllegalArgumentException("VIN-HOADON invoice payload must be a JSON object");
        }
        ObjectNode payload = ((ObjectNode) invoice).deepCopy();
        JsonNode suppliedTaxCode = payload.get("doanhnghiep_mst");
        if (suppliedTaxCode != null && !credentials.taxCode().equals(suppliedTaxCode.asText())) {
            throw new IllegalArgumentException("Invoice seller tax code does not match VIN-HOADON credentials");
        }
        payload.put("doanhnghiep_mst", credentials.taxCode());
        return authorizedPost(path, payload, credentials);
    }

    private ObjectNode referencePayload(InvoiceReference reference,
                                        VinHoadonCredentials credentials) {
        Objects.requireNonNull(reference, "reference");
        if (isBlank(reference.transactionId()) && isBlank(reference.externalInvoiceId())) {
            throw new IllegalArgumentException("VIN-HOADON transactionId or externalInvoiceId is required");
        }
        ObjectNode payload = objectMapper.createObjectNode()
                .put("doanhnghiep_mst", credentials.taxCode());
        if (!isBlank(reference.transactionId())) {
            payload.put("magiaodich", reference.transactionId().trim());
        }
        if (!isBlank(reference.externalInvoiceId())) {
            payload.put("ma_hoadon", reference.externalInvoiceId().trim());
        }
        return payload;
    }

    private JsonNode authorizedPost(String path, JsonNode payload,
                                    VinHoadonCredentials credentials) {
        ensureEnabled();
        String token = tokenFor(credentials);
        try {
            return unwrapResult(post(path, payload, token));
        } catch (VinHoadonApiException exception) {
            if (exception.getStatusCode() != 401) {
                throw exception;
            }
            invalidateToken(credentials);
            String refreshedToken = authenticate(credentials).accessToken();
            return unwrapResult(post(path, payload, refreshedToken));
        }
    }

    private String tokenFor(VinHoadonCredentials credentials) {
        CachedToken cached = tokenCache.get(credentials.cacheKey());
        if (cached != null && clock.instant().isBefore(cached.expiresAt())) {
            return cached.accessToken();
        }
        return authenticate(credentials).accessToken();
    }

    private JsonNode post(String path, JsonNode payload, String bearerToken) {
        HttpRequest.Builder requestBuilder = HttpRequest.newBuilder(resolve(path))
                .timeout(properties.getRequestTimeout())
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(writeJson(payload)));
        if (!isBlank(bearerToken)) {
            requestBuilder.header("Authorization", "Bearer " + bearerToken);
        }

        final HttpResponse<String> response;
        try {
            response = httpClient.send(requestBuilder.build(), HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new VinHoadonApiException("VIN-HOADON request was interrupted", exception);
        } catch (IOException exception) {
            throw new VinHoadonApiException("VIN-HOADON request failed", exception);
        }

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            String body = truncate(response.body());
            throw new VinHoadonApiException(
                    "VIN-HOADON returned HTTP " + response.statusCode(),
                    response.statusCode(), body);
        }
        try {
            return objectMapper.readTree(response.body());
        } catch (JsonProcessingException exception) {
            throw new VinHoadonApiException("VIN-HOADON returned invalid JSON", exception);
        }
    }

    private JsonNode unwrapResult(JsonNode response) {
        JsonNode result = response == null ? null : response.get("result");
        if (result == null || result.isNull()) {
            return response;
        }
        if (!result.isTextual()) {
            return result;
        }
        try {
            return objectMapper.readTree(result.asText());
        } catch (JsonProcessingException exception) {
            throw new VinHoadonApiException("VIN-HOADON result envelope contains invalid JSON", exception);
        }
    }

    private URI resolve(String path) {
        if (path == null || !path.startsWith("/api/services/hddtws/")) {
            throw new IllegalArgumentException("Unsupported VIN-HOADON API path");
        }
        return URI.create(properties.getBaseUrl().toString() + path);
    }

    private String writeJson(JsonNode payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Unable to serialize VIN-HOADON request", exception);
        }
    }

    private void ensureEnabled() {
        if (!properties.isEnabled()) {
            throw new IllegalStateException("VIN-HOADON integration is disabled");
        }
    }

    private static long normalizeExpirySeconds(long value) {
        if (value <= 0) {
            return 300;
        }
        // The v12.1 document labels this field "seconds" but describes it as
        // milliseconds. Values over seven days are treated as milliseconds.
        return value > Duration.ofDays(7).toSeconds() ? Math.max(1, value / 1_000) : value;
    }

    private static String requiredText(JsonNode node, String field) {
        String value = textOrNull(node, field);
        if (isBlank(value)) {
            throw new VinHoadonApiException("VIN-HOADON response is missing " + field, 200,
                    truncate(node == null ? null : node.toString()));
        }
        return value;
    }

    private static String textOrNull(JsonNode node, String field) {
        if (node == null || !node.hasNonNull(field)) {
            return null;
        }
        return node.get(field).asText();
    }

    private static String truncate(String value) {
        if (value == null || value.length() <= MAX_ERROR_BODY_LENGTH) {
            return value;
        }
        return value.substring(0, MAX_ERROR_BODY_LENGTH) + "...";
    }

    private static boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    public record TokenResponse(String accessToken, String encryptedAccessToken,
                                long expiresIn, String tokenType) {}

    public record InvoiceReference(String transactionId, String externalInvoiceId) {}

    private record CachedToken(String accessToken, Instant expiresAt) {}
}
