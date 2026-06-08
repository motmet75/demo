package com.ams.bomcore.ghtk;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class GHTKService {

    private static final String API_BASE = "https://services.giaohangtietkiem.vn/services/shipment/fee";

    // TODO: replace with your own GHTK merchant token / partner code — do not commit real credentials
    private static final String DEFAULT_TOKEN = "YOUR_GHTK_TOKEN_HERE";
    private static final String DEFAULT_PARTNER = "YOUR_GHTK_PARTNER_CODE_HERE";

    private final Map<String, GHTKToken> tokenStorage = new ConcurrentHashMap<>();
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public GHTKService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(30))
                .build();
        this.objectMapper = new ObjectMapper();
        tokenStorage.put("default", new GHTKToken("default", DEFAULT_TOKEN, "ghtk_user"));
    }

    public String getDefaultToken() { return DEFAULT_TOKEN; }
    public String getDefaultPartner() { return DEFAULT_PARTNER; }

    public void storeToken(String userId, String token, String username) {
        tokenStorage.put(userId, new GHTKToken(userId, token, username));
    }

    public GHTKToken getToken(String userId) {
        GHTKToken token = tokenStorage.get(userId);
        if (token != null && !token.isExpired()) {
            token.updateLastUsed();
            return token;
        }
        return null;
    }

    public boolean hasValidToken(String userId) {
        GHTKToken token = tokenStorage.get(userId);
        return token != null && !token.isExpired();
    }

    public Map<String, GHTKToken> getAllTokens() { return new HashMap<>(tokenStorage); }

    public int cleanExpiredTokens() {
        int cleaned = 0;
        Iterator<Map.Entry<String, GHTKToken>> it = tokenStorage.entrySet().iterator();
        while (it.hasNext()) {
            if (it.next().getValue().isExpired()) { it.remove(); cleaned++; }
        }
        return cleaned;
    }

    public List<GHTKDTO.ShipmentOption> getShipmentOptions(String token, String partner, GHTKDTO.FeeRequest req) throws Exception {
        List<GHTKDTO.ShipmentOption> options = new ArrayList<>();
        for (String transport : new String[]{"road", "fly"}) {
            try {
                req.setTransport(transport);
                String json = objectMapper.writeValueAsString(req);
                HttpRequest httpReq = HttpRequest.newBuilder()
                        .uri(URI.create(API_BASE + "?" + buildQuery(req)))
                        .header("Token", token)
                        .header("X-Client-Source", partner)
                        .header("Content-Type", "application/json")
                        .GET()
                        .build();
                HttpResponse<String> resp = httpClient.send(httpReq, HttpResponse.BodyHandlers.ofString());
                JsonNode node = objectMapper.readTree(resp.body());
                if (node.has("fee") && node.get("success").asBoolean(false)) {
                    GHTKDTO.FeeData data = objectMapper.treeToValue(node.get("fee"), GHTKDTO.FeeData.class);
                    String name = "road".equals(transport) ? "Đường bộ" : "Hàng không";
                    options.add(new GHTKDTO.ShipmentOption(transport, name, data));
                }
            } catch (Exception ignored) {}
        }
        return options;
    }

    private String buildQuery(GHTKDTO.FeeRequest req) {
        return "pick_province=" + enc(req.getPickProvince())
                + "&pick_district=" + enc(req.getPickDistrict())
                + "&province=" + enc(req.getProvince())
                + "&district=" + enc(req.getDistrict())
                + "&weight=" + req.getWeight()
                + "&value=" + req.getValue()
                + "&transport=" + enc(req.getTransport());
    }

    private String enc(String s) {
        if (s == null) return "";
        try { return java.net.URLEncoder.encode(s, "UTF-8"); } catch (Exception e) { return s; }
    }
}
