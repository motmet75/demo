package com.ams.bomcore.ghtk;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/ghtk")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class GHTKController {

    private final GHTKService ghtkService;

    public GHTKController(GHTKService ghtkService) {
        this.ghtkService = ghtkService;
    }

    @GetMapping("/token")
    public ResponseEntity<?> getToken() {
        Map<String, Object> resp = new HashMap<>();
        resp.put("success", true);
        resp.put("token", ghtkService.getDefaultToken());
        resp.put("partner", ghtkService.getDefaultPartner());
        resp.put("message", "Using pre-configured GHTK token — replace DEFAULT_TOKEN/DEFAULT_PARTNER in GHTKService");
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/token")
    public ResponseEntity<?> setToken(@RequestBody Map<String, String> body) {
        Map<String, Object> resp = new HashMap<>();
        String token = body.get("token");
        if (token == null || token.isBlank()) {
            resp.put("success", false); resp.put("message", "token is required");
            return ResponseEntity.badRequest().body(resp);
        }
        String userId = body.getOrDefault("userId", "default");
        ghtkService.storeToken(userId, token, "manual");
        resp.put("success", true); resp.put("userId", userId);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/shipment-fee")
    public ResponseEntity<?> shipmentFee(@RequestHeader(value = "Authorization", required = false) String authHeader,
                                          @RequestBody GHTKDTO.FeeRequest req) {
        Map<String, Object> resp = new HashMap<>();
        try {
            String token = authHeader != null ? authHeader.replace("Bearer ", "") : ghtkService.getDefaultToken();
            String partner = ghtkService.getDefaultPartner();
            var options = ghtkService.getShipmentOptions(token, partner, req);
            resp.put("success", true);
            resp.put("data", options);
            return ResponseEntity.ok(resp);
        } catch (Exception e) {
            resp.put("success", false); resp.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(resp);
        }
    }

    @GetMapping("/admin/tokens")
    public ResponseEntity<?> adminTokens() {
        var tokens = ghtkService.getAllTokens().entrySet().stream()
                .map(e -> Map.of("userId", e.getKey(), "createdAt", e.getValue().getCreatedAt(),
                        "hasToken", e.getValue().getToken() != null))
                .toList();
        return ResponseEntity.ok(Map.of("success", true, "tokens", tokens));
    }

    @PostMapping("/admin/clean-tokens")
    public ResponseEntity<?> cleanTokens() {
        int cleaned = ghtkService.cleanExpiredTokens();
        return ResponseEntity.ok(Map.of("success", true, "message", "Cleaned " + cleaned + " expired tokens"));
    }
}
