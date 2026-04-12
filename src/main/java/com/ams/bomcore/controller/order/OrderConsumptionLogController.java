package com.ams.bomcore.controller.order;

import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.controller.order.dto.OrderConsumptionLogDto;
import com.ams.bomcore.repository.OrderConsumptionLogRepository;

/**
 * REST endpoint for reading order_consumption_log rows.
 *
 * <p>GET /bom/order-consumption-log?tenantId=&companyId=
 * <p>GET /bom/order-consumption-log/by-order/{orderId}
 */
@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/order-consumption-log")
public class OrderConsumptionLogController {

    private final OrderConsumptionLogRepository repository;

    public OrderConsumptionLogController(OrderConsumptionLogRepository repository) {
        this.repository = repository;
    }

    private UUID resolve(UUID param, String header) {
        if (header != null && !header.isBlank()) {
            try { return UUID.fromString(header); } catch (Exception ignored) {}
        }
        return param;
    }

    /** List all consumption logs for a tenant+company (includes deducted_inventory_id). */
    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(value = "tenantId",      required = false) UUID tenantId,
            @RequestParam(value = "companyId",     required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String ht,
            @RequestHeader(value = "X-Company-Id", required = false) String hc) {

        tenantId  = resolve(tenantId, ht);
        companyId = resolve(companyId, hc);

        if (tenantId == null || companyId == null)
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("tenantId and companyId are required");

        List<OrderConsumptionLogDto> rows =
                repository.findDtoByTenantIdAndCompanyId(tenantId, companyId);
        return ResponseEntity.ok(rows);
    }

    /** List consumption logs for a single order. */
    @GetMapping("/by-order/{orderId}")
    public ResponseEntity<?> byOrder(@PathVariable UUID orderId) {
        List<OrderConsumptionLogDto> rows = repository.findDtoByOrderId(orderId);
        return ResponseEntity.ok(rows);
    }
}
