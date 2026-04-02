package com.ams.bomcore.controller.order;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.controller.order.dto.OrderConsumptionDto;
import com.ams.bomcore.repository.OrderConsumptionRepository;

/**
 * REST endpoint for reading order_consumption rows (joined view data).
 * GET /bom/api/order-consumption?tenantId=&companyId=
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/order-consumption")
public class OrderConsumptionController {

    private final OrderConsumptionRepository repository;

    public OrderConsumptionController(OrderConsumptionRepository repository) {
        this.repository = repository;
    }

    private UUID resolve(UUID param, String header) {
        if (header != null && !header.isBlank()) try { return UUID.fromString(header); } catch (Exception ignored) {}
        return param;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(value = "tenantId",     required = false) UUID tenantId,
            @RequestParam(value = "companyId",    required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String ht,
            @RequestHeader(value = "X-Company-Id",required = false) String hc) {
        tenantId  = resolve(tenantId, ht);
        companyId = resolve(companyId, hc);
        if (tenantId == null || companyId == null)
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body("tenantId and companyId are required");
        return ResponseEntity.ok(repository.findDtoByTenantIdAndCompanyId(tenantId, companyId));
    }
}
