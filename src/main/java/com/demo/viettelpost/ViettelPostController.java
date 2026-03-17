package com.demo.viettelpost;

import com.demo.viettelpost.ViettelPostDTO.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for Viettel Post API endpoints
 */
@RestController
@RequestMapping("/viettelpost")
@CrossOrigin(origins = "*")
public class ViettelPostController {

    @Autowired
    private ViettelPostService viettelPostService;

    // ========== TOKEN ENDPOINTS ==========

    /**
     * Get the default stored token
     */
    @GetMapping("/token")
    public ResponseEntity<?> getToken() {
        Map<String, Object> response = new HashMap<>();
        response.put("success", true);
        response.put("token", viettelPostService.getDefaultToken());
        response.put("message", "Using pre-configured Viettel Post token");
        return ResponseEntity.ok(response);
    }

    /**
     * Set/update token manually
     */
    @PostMapping("/token")
    public ResponseEntity<?> setToken(@RequestBody TokenRequest request) {
        Map<String, Object> response = new HashMap<>();
        
        if (request.getToken() == null || request.getToken().isEmpty()) {
            response.put("success", false);
            response.put("message", "Token is required");
            return ResponseEntity.badRequest().body(response);
        }

        String userId = request.getUserId() != null ? request.getUserId() : "default";
        viettelPostService.storeToken(userId, request.getToken(), "manual_token");

        response.put("success", true);
        response.put("token", request.getToken());
        response.put("userId", userId);
        response.put("message", "Token stored successfully");
        return ResponseEntity.ok(response);
    }

    /**
     * Login to Viettel Post
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        Map<String, Object> response = new HashMap<>();

        try {
            if (request.getUsername() == null || request.getPassword() == null) {
                response.put("success", false);
                response.put("message", "Username and password are required");
                return ResponseEntity.badRequest().body(response);
            }

            ViettelPostToken token = viettelPostService.login(request.getUsername(), request.getPassword());

            response.put("success", true);
            response.put("token", token.getToken());
            response.put("userId", token.getUserId());
            response.put("message", "Login successful");
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * Check token validity
     */
    @GetMapping("/check-token/{userId}")
    public ResponseEntity<?> checkToken(@PathVariable String userId) {
        Map<String, Object> response = new HashMap<>();
        boolean isValid = viettelPostService.hasValidToken(userId);
        
        response.put("success", true);
        response.put("isValid", isValid);
        if (isValid) {
            ViettelPostToken token = viettelPostService.getToken(userId);
            response.put("tokenData", token);
        }
        return ResponseEntity.ok(response);
    }

    // ========== ADDRESS ENDPOINTS ==========

    /**
     * Get all provinces
     */
    @GetMapping("/provinces")
    public ResponseEntity<?> getProvinces(@RequestHeader("Authorization") String token) {
        Map<String, Object> response = new HashMap<>();

        try {
            List<Province> provinces = viettelPostService.getProvinces(token);
            response.put("status", 200);
            response.put("data", provinces);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * Get districts by province ID
     */
    @GetMapping("/districts/{provinceId}")
    public ResponseEntity<?> getDistricts(
            @RequestHeader("Authorization") String token,
            @PathVariable int provinceId) {
        Map<String, Object> response = new HashMap<>();

        try {
            List<District> districts = viettelPostService.getDistricts(token, provinceId);
            response.put("status", 200);
            response.put("data", districts);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * Get wards by district ID
     */
    @GetMapping("/wards/{districtId}")
    public ResponseEntity<?> getWards(
            @RequestHeader("Authorization") String token,
            @PathVariable int districtId) {
        Map<String, Object> response = new HashMap<>();

        try {
            List<Ward> wards = viettelPostService.getWards(token, districtId);
            response.put("status", 200);
            response.put("data", wards);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * Get complete address
     */
    @GetMapping("/address/complete")
    public ResponseEntity<?> getCompleteAddress(
            @RequestHeader("Authorization") String token,
            @RequestParam int provinceId,
            @RequestParam(required = false) Integer districtId,
            @RequestParam(required = false) Integer wardId) {
        Map<String, Object> response = new HashMap<>();

        try {
            CompleteAddress address = viettelPostService.getCompleteAddress(token, provinceId, districtId, wardId);
            response.put("success", true);
            response.put("data", address);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    // ========== SHIPPING CALCULATION ENDPOINTS ==========

    /**
     * Calculate shipping price for a single service
     */
    @PostMapping("/calculate-price")
    public ResponseEntity<?> calculatePrice(
            @RequestHeader("Authorization") String token,
            @RequestBody PriceRequest request) {
        Map<String, Object> response = new HashMap<>();

        try {
            PriceData priceData = viettelPostService.calculatePrice(token, request);
            if (priceData != null) {
                response.put("status", 200);
                response.put("data", priceData);
            } else {
                response.put("status", 204);
                response.put("message", "Price not available for this route");
            }
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    /**
     * Get all shipment options
     */
    @PostMapping("/shipment-options")
    public ResponseEntity<?> getShipmentOptions(
            @RequestHeader("Authorization") String token,
            @RequestBody PriceRequest request) {
        Map<String, Object> response = new HashMap<>();

        try {
            // Validate required fields
            if (request.getProductWeight() <= 0 || 
                request.getSenderProvince() <= 0 || 
                request.getSenderDistrict() <= 0 ||
                request.getReceiverProvince() <= 0 || 
                request.getReceiverDistrict() <= 0) {
                response.put("success", false);
                response.put("message", "Missing required fields");
                return ResponseEntity.badRequest().body(response);
            }

            List<ShipmentOption> options = viettelPostService.getShipmentOptions(token, request);
            
            response.put("success", true);
            response.put("count", options.size());
            response.put("data", options);
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            response.put("success", false);
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    // ========== ADMIN ENDPOINTS ==========

    /**
     * Get all stored tokens (admin)
     */
    @GetMapping("/admin/tokens")
    public ResponseEntity<?> getAdminTokens() {
        Map<String, Object> response = new HashMap<>();
        
        var tokens = viettelPostService.getAllTokens();
        var sanitized = tokens.entrySet().stream()
            .map(e -> Map.of(
                "userId", e.getKey(),
                "createdAt", e.getValue().getCreatedAt(),
                "lastUsed", e.getValue().getLastUsed(),
                "hasToken", e.getValue().getToken() != null
            ))
            .toList();

        response.put("success", true);
        response.put("count", sanitized.size());
        response.put("tokens", sanitized);
        return ResponseEntity.ok(response);
    }

    /**
     * Clean expired tokens
     */
    @PostMapping("/admin/clean-tokens")
    public ResponseEntity<?> cleanTokens() {
        Map<String, Object> response = new HashMap<>();
        int cleaned = viettelPostService.cleanExpiredTokens();
        response.put("success", true);
        response.put("message", "Cleaned " + cleaned + " expired tokens");
        return ResponseEntity.ok(response);
    }
}
