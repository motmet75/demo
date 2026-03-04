package com.demo.viettelpost;

import com.demo.viettelpost.ViettelPostDTO.*;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for interacting with Viettel Post API
 */
@Service
public class ViettelPostService {

    private static final String API_BASE = "https://partner.viettelpost.vn/v2";
    
    // Pre-configured token (your token)
    private static final String DEFAULT_TOKEN = "41A7F86612D4357C125529D1878BBE38";
    
    // Token storage (in-memory, can be replaced with database)
    private final Map<String, ViettelPostToken> tokenStorage = new ConcurrentHashMap<>();
    
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;
    
    // Service code to name mapping
    private static final Map<String, String> SERVICE_NAMES = Map.of(
        "VCN", "Chuyển phát nhanh",
        "VCBO", "Chuyển phát nhanh theo bộ",
        "VHT", "Phát hỏa tốc",
        "PTN", "Phát trong ngày",
        "PHS", "Phát hẹn giờ",
        "VBS", "Chuyển phát tiêu chuẩn",
        "SCOD", "Dịch vụ thu hộ COD",
        "VTK", "Tiết kiệm",
        "VBE", "Chuyển phát tiết kiệm"
    );

    public ViettelPostService() {
        this.httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(30))
            .build();
        this.objectMapper = new ObjectMapper();
        
        // Store default token
        ViettelPostToken defaultToken = new ViettelPostToken("default", DEFAULT_TOKEN, "viettelpost_user");
        tokenStorage.put("default", defaultToken);
    }

    /**
     * Get default/stored token
     */
    public String getDefaultToken() {
        return DEFAULT_TOKEN;
    }

    /**
     * Store a token
     */
    public void storeToken(String userId, String token, String username) {
        ViettelPostToken vptToken = new ViettelPostToken(userId, token, username);
        tokenStorage.put(userId, vptToken);
    }

    /**
     * Get token by user ID
     */
    public ViettelPostToken getToken(String userId) {
        ViettelPostToken token = tokenStorage.get(userId);
        if (token != null && !token.isExpired()) {
            token.updateLastUsed();
            return token;
        }
        return null;
    }

    /**
     * Check if token is valid
     */
    public boolean hasValidToken(String userId) {
        ViettelPostToken token = tokenStorage.get(userId);
        return token != null && !token.isExpired();
    }

    /**
     * Login to Viettel Post API
     */
    public ViettelPostToken login(String username, String password) throws Exception {
        // Check if already has valid token
        if (hasValidToken(username)) {
            return getToken(username);
        }

        // Step 1: Login to get temporary token
        Map<String, String> loginBody = Map.of("USERNAME", username, "PASSWORD", password);
        String loginJson = objectMapper.writeValueAsString(loginBody);

        HttpRequest loginRequest = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/user/Login"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(loginJson))
            .build();

        HttpResponse<String> loginResponse = httpClient.send(loginRequest, HttpResponse.BodyHandlers.ofString());
        JsonNode loginData = objectMapper.readTree(loginResponse.body());

        if (loginData.get("status").asInt() != 200 || loginData.get("data") == null) {
            throw new RuntimeException("Invalid credentials");
        }

        String tempToken = loginData.get("data").get("token").asText();

        // Step 2: Get long-term token
        HttpRequest connectRequest = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/user/ownerconnect"))
            .header("Content-Type", "application/json")
            .header("Token", tempToken)
            .POST(HttpRequest.BodyPublishers.ofString("{}"))
            .build();

        HttpResponse<String> connectResponse = httpClient.send(connectRequest, HttpResponse.BodyHandlers.ofString());
        JsonNode connectData = objectMapper.readTree(connectResponse.body());

        if (connectData.get("status").asInt() != 200 || connectData.get("data") == null) {
            throw new RuntimeException("Failed to get long-term token");
        }

        String longTermToken = connectData.get("data").get("token").asText();

        // Store token
        ViettelPostToken vptToken = new ViettelPostToken(username, longTermToken, username);
        tokenStorage.put(username, vptToken);

        return vptToken;
    }

    /**
     * Get all provinces
     */
    public List<Province> getProvinces(String token) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/categories/listProvince"))
            .header("Token", token)
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode data = objectMapper.readTree(response.body());

        if (data.get("status").asInt() == 200 && data.has("data")) {
            return objectMapper.readValue(
                data.get("data").toString(),
                new TypeReference<List<Province>>() {}
            );
        }
        return Collections.emptyList();
    }

    /**
     * Get districts by province ID
     */
    public List<District> getDistricts(String token, int provinceId) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/categories/listDistrict?provinceId=" + provinceId))
            .header("Token", token)
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode data = objectMapper.readTree(response.body());

        if (data.get("status").asInt() == 200 && data.has("data")) {
            return objectMapper.readValue(
                data.get("data").toString(),
                new TypeReference<List<District>>() {}
            );
        }
        return Collections.emptyList();
    }

    /**
     * Get wards by district ID
     */
    public List<Ward> getWards(String token, int districtId) throws Exception {
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/categories/listWards?districtId=" + districtId))
            .header("Token", token)
            .GET()
            .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        JsonNode data = objectMapper.readTree(response.body());

        if (data.get("status").asInt() == 200 && data.has("data")) {
            return objectMapper.readValue(
                data.get("data").toString(),
                new TypeReference<List<Ward>>() {}
            );
        }
        return Collections.emptyList();
    }

    /**
     * Get complete address
     */
    public CompleteAddress getCompleteAddress(String token, int provinceId, Integer districtId, Integer wardId) throws Exception {
        CompleteAddress address = new CompleteAddress();
        
        List<Province> provinces = getProvinces(token);
        Province province = provinces.stream()
            .filter(p -> p.getProvinceId() == provinceId)
            .findFirst()
            .orElse(null);
        address.setProvince(province);

        if (districtId != null) {
            List<District> districts = getDistricts(token, provinceId);
            District district = districts.stream()
                .filter(d -> d.getDistrictId() == districtId)
                .findFirst()
                .orElse(null);
            address.setDistrict(district);

            if (wardId != null && district != null) {
                List<Ward> wards = getWards(token, districtId);
                Ward ward = wards.stream()
                    .filter(w -> w.getWardsId() == wardId)
                    .findFirst()
                    .orElse(null);
                address.setWard(ward);
            }
        }

        // Build full address string
        StringBuilder fullAddr = new StringBuilder();
        if (address.getWard() != null) {
            fullAddr.append(address.getWard().getWardsName()).append(", ");
        }
        if (address.getDistrict() != null) {
            fullAddr.append(address.getDistrict().getDistrictName()).append(", ");
        }
        if (address.getProvince() != null) {
            fullAddr.append(address.getProvince().getProvinceName());
        }
        address.setFullAddress(fullAddr.toString());

        return address;
    }

    /**
     * Calculate price for a single service
     */
    public PriceData calculatePrice(String token, PriceRequest request) throws Exception {
        String requestJson = objectMapper.writeValueAsString(request);

        HttpRequest httpRequest = HttpRequest.newBuilder()
            .uri(URI.create(API_BASE + "/order/getPrice"))
            .header("Content-Type", "application/json")
            .header("Token", token)
            .POST(HttpRequest.BodyPublishers.ofString(requestJson))
            .build();

        HttpResponse<String> response = httpClient.send(httpRequest, HttpResponse.BodyHandlers.ofString());
        JsonNode data = objectMapper.readTree(response.body());

        if (data.get("status").asInt() == 200 && data.has("data")) {
            return objectMapper.readValue(data.get("data").toString(), PriceData.class);
        }
        return null;
    }

    /**
     * Get all available shipment options
     */
    public List<ShipmentOption> getShipmentOptions(String token, PriceRequest baseRequest) throws Exception {
        List<ShipmentOption> options = new ArrayList<>();
        String[] serviceCodes = {"VCN", "VCBO", "VHT", "PTN", "PHS", "VBS", "SCOD"};

        for (String serviceCode : serviceCodes) {
            try {
                PriceRequest request = new PriceRequest();
                request.setProductWeight(baseRequest.getProductWeight());
                request.setProductPrice(baseRequest.getProductPrice());
                request.setMoneyCollection(baseRequest.getMoneyCollection());
                request.setSenderProvince(baseRequest.getSenderProvince());
                request.setSenderDistrict(baseRequest.getSenderDistrict());
                request.setReceiverProvince(baseRequest.getReceiverProvince());
                request.setReceiverDistrict(baseRequest.getReceiverDistrict());
                request.setProductType(baseRequest.getProductType());
                request.setNationalType(baseRequest.getNationalType());
                request.setOrderService(serviceCode);

                PriceData priceData = calculatePrice(token, request);
                if (priceData != null && priceData.getMoneyTotal() > 0) {
                    String serviceName = SERVICE_NAMES.getOrDefault(serviceCode, serviceCode);
                    options.add(new ShipmentOption(serviceCode, serviceName, priceData));
                }
            } catch (Exception e) {
                // Service not available for this route, skip
            }
        }

        return options;
    }

    /**
     * Get service name from code
     */
    public String getServiceName(String code) {
        return SERVICE_NAMES.getOrDefault(code, code);
    }

    /**
     * Get all stored tokens (for admin)
     */
    public Map<String, ViettelPostToken> getAllTokens() {
        return new HashMap<>(tokenStorage);
    }

    /**
     * Remove token
     */
    public void removeToken(String userId) {
        tokenStorage.remove(userId);
    }

    /**
     * Clean expired tokens
     */
    public int cleanExpiredTokens() {
        int cleaned = 0;
        Iterator<Map.Entry<String, ViettelPostToken>> it = tokenStorage.entrySet().iterator();
        while (it.hasNext()) {
            if (it.next().getValue().isExpired()) {
                it.remove();
                cleaned++;
            }
        }
        return cleaned;
    }
}
