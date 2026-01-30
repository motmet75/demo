package com.ams.bomcore.controller.bom;

import java.util.List;

import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.service.bom.BomCalculationService;

/**
 * Thin controller that exposes BOM availability check API.
 * It performs minimal request validation and delegates all logic to BomCalculationService.
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/bom")
public class BomCheckController {

    private final BomCalculationService bomCalculationService;

    public BomCheckController(BomCalculationService bomCalculationService) {
        this.bomCalculationService = bomCalculationService;
    }

    @PostMapping(path = "/check", consumes = MediaType.APPLICATION_JSON_VALUE, produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<BomCalculationService.BomCheckResult>> checkAvailability(@Valid @RequestBody BomCheckRequest req) {
        List<BomCalculationService.BomCheckResult> result = bomCalculationService.checkAvailability(req.getModelCode(), req.getQuantity(), req.getTenantId());
        return ResponseEntity.ok(result);
    }
}