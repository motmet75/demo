package com.ams.bomcore.service.inventory;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Read-only reference to Portal /tariff via its protected internal API.
 * No tariff rates are silently treated as legally verified on a filing date.
 */
@Service
public class CustomsTariffBridgeService {
    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(3))
            .followRedirects(HttpClient.Redirect.NEVER).build();
    private final ObjectMapper mapper = new ObjectMapper();
    private final String baseUrl;
    private final String token;

    public CustomsTariffBridgeService(
            @Value("${customs.tariff.bridge-url:}") String baseUrl,
            @Value("${customs.tariff.bridge-token:}") String token) {
        this.baseUrl = Objects.toString(baseUrl, "").trim().replaceAll("/+$", "");
        this.token = Objects.toString(token, "").trim();
    }

    public Map<String,Object> lookup(String hsCode) {
        if (hsCode == null || !hsCode.matches("[0-9]{8}")) {
            return error(hsCode, "INVALID_HS",
                    "Mã HS phải gồm đúng 8 chữ số; không tự đoán hoặc làm tròn mã.");
        }
        if (baseUrl.isBlank() || token.length() < 24) {
            return error(hsCode, "NOT_CONFIGURED",
                    "Chưa cấu hình kết nối đến biểu thuế Portal. " +
                    "Thiết lập customs.tariff.bridge-url và customs.tariff.bridge-token trên Demo.");
        }
        try {
            URI uri = URI.create(baseUrl + "/api/internal/tariff/hs/" + hsCode);
            if (!("https".equalsIgnoreCase(uri.getScheme()) ||
                    ("http".equalsIgnoreCase(uri.getScheme()) &&
                     ("localhost".equalsIgnoreCase(uri.getHost()) ||
                      "127.0.0.1".equals(uri.getHost()))))) {
                return error(hsCode, "BAD_URL",
                        "Đường dẫn biểu thuế phải dùng HTTPS hoặc HTTP localhost.");
            }
            HttpRequest request = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(7))
                    .header("X-Tariff-Bridge-Token", token)
                    .header("Accept", "application/json")
                    .GET().build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 404)
                return classifyPortal404(hsCode, response.body());
            if (response.statusCode() == 403 || response.statusCode() == 401)
                return error(hsCode, "FORBIDDEN",
                        "Portal từ chối kết nối biểu thuế. Kiểm tra quyền hoặc Tariff Bridge Token.");
            if (response.statusCode() != 200)
                return error(hsCode, "UPSTREAM_ERROR",
                        "Portal không trả được biểu thuế (HTTP " + response.statusCode() + ").");
            Map<String,Object> payload = mapper.readValue(response.body(),
                    new TypeReference<Map<String,Object>>() {});
            if (!hsCode.equals(Objects.toString(payload.get("hsCode"), "")))
                return error(hsCode, "MISMATCH",
                        "Dữ liệu HS trả về không khớp mã yêu cầu; không áp dụng thuế suất.");
            Map<String,Object> result = new LinkedHashMap<>(payload);
            result.put("status", "OK");
            return result;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return error(hsCode, "INTERRUPTED", "Kết nối biểu thuế bị ngắt.");
        } catch (Exception e) {
            return error(hsCode, "UNAVAILABLE",
                    "Không kết nối được biểu thuế Portal. Kiểm tra API, URL, TLS và token.");
        }
    }

    // A reverse-proxy 404 (route not deployed) is NOT the same as the
    // tariff endpoint explicitly confirming that the HS code is absent.
    // Only the Portal's authenticated, structured HS_NOT_FOUND response
    // can tell the UI that the tariff table has no matching row.
    Map<String,Object> classifyPortal404(String hsCode, String body) {
        if (body != null && !body.isBlank()) {
            try {
                Map<String,Object> payload = mapper.readValue(body,
                        new TypeReference<Map<String,Object>>() {});
                if ("HS_NOT_FOUND".equals(payload.get("code"))
                        && hsCode.equals(Objects.toString(payload.get("hsCode"), ""))) {
                    return error(hsCode,"NOT_FOUND",
                            Objects.toString(payload.get("message"),
                                    "Không tìm thấy đúng mã HS " + hsCode + " trong biểu thuế Portal."));
                }
            } catch (Exception ignored) {
                // Nginx/Traefik often returns HTML here.
            }
        }
        return error(hsCode,"PORTAL_API_NOT_FOUND",
                "API tra cứu thuế của Portal trả HTTP 404 nhưng không xác nhận thiếu mã HS "
                + hsCode + ". Kiểm tra Portal đã pull/rebuild nhánh master và Nginx đã "
                + "chuyển tiếp /api/internal/tariff/hs/... đến ứng dụng.");
    }

    private static Map<String,Object> error(String hsCode,String status,String message) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("hsCode", Objects.toString(hsCode, ""));
        result.put("status", status);
        result.put("message", message);
        return result;
    }
}
