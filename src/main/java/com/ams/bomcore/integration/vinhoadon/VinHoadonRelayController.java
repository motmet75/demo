package com.ams.bomcore.integration.vinhoadon;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/vin-hoadon/relay")
public class VinHoadonRelayController {
    private final VinHoadonRelayService service;
    public VinHoadonRelayController(VinHoadonRelayService service) { this.service = service; }

    public record PairRequest(String code, String agentId) {}

    @PostMapping("/pair-code")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','ADMIN','USER')")
    public VinHoadonRelayService.PairCode pairCode() {
        return service.generatePairCode();
    }

    @PostMapping("/handshake")
    public VinHoadonRelayService.Tokens handshake(@RequestBody PairRequest request) {
        return service.pair(request.code(), request.agentId());
    }

    @PostMapping("/renew")
    public VinHoadonRelayService.Tokens renew(@RequestHeader("Authorization") String bearer) {
        return service.renew(bearer);
    }

    @GetMapping("/next")
    public ResponseEntity<VinHoadonRelayService.Job> next(@RequestHeader("Authorization") String bearer) {
        VinHoadonRelayService.Job job = service.take(bearer);
        return job == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(job);
    }

    @PostMapping("/result")
    public ResponseEntity<Void> result(@RequestHeader("Authorization") String bearer,
                                       @RequestBody VinHoadonRelayService.Result result) {
        service.finish(bearer, result);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/status")
    public VinHoadonRelayService.Status status(@RequestHeader("Authorization") String bearer) {
        return service.status(bearer);
    }
}
