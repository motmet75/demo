package com.ams.bomcore.controller.orderline;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.controller.order.OrderController;
import com.ams.bomcore.controller.orderline.dto.OrderLineRequestDto;
import com.ams.bomcore.controller.orderline.dto.OrderLineResponseDto;
import com.ams.bomcore.service.order.exception.OrderNotFoundException;
import com.ams.bomcore.service.orderline.OrderLineService;

import jakarta.validation.Valid;

/**
 * REST controller for standalone OrderLine CRUD.
 *
 * <pre>
 * GET    /api/order-lines                     – list (filter: orderId, lineStatus, lineType)
 * GET    /api/order-lines/{id}                – get by id
 * POST   /api/order-lines                     – create
 * PUT    /api/order-lines/{id}                – full update (lineType immutable)
 * PATCH  /api/order-lines/{id}/status         – status transition only
 * DELETE /api/order-lines/{id}                – delete (PENDING / CANCELLED only)
 * </pre>
 *
 * Multi-tenant: tenant + company resolved from X-Tenant-Id / X-Company-Id headers
 * (or query params as fallback) — identical pattern to {@link OrderController}.
 */
@CrossOrigin(origins = {"http://localhost:5173", "http://15.165.215.69:5173"})
@RestController
@RequestMapping("/order-lines")
public class OrderLineController {

    private final OrderLineService orderLineService;

    public OrderLineController(OrderLineService orderLineService) {
        this.orderLineService = orderLineService;
    }

    // ─────────────────────────────────────────────────────────────────
    // Tenant / Company resolution helpers  (same pattern as OrderController)
    // ─────────────────────────────────────────────────────────────────

    private UUID resolveTenant(UUID tenantId, String headerTenantId) {
        if (headerTenantId != null && !headerTenantId.isBlank()) {
            try { return UUID.fromString(headerTenantId); } catch (Exception ignored) {}
        }
        return tenantId;
    }

    private UUID resolveCompany(UUID companyId, String headerCompanyId) {
        if (headerCompanyId != null && !headerCompanyId.isBlank()) {
            try { return UUID.fromString(headerCompanyId); } catch (Exception ignored) {}
        }
        return companyId;
    }

    private ResponseEntity<ApiError> missingContext() {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(new ApiError("tenantId and companyId are required"));
    }

    // ─────────────────────────────────────────────────────────────────
    // LIST
    // GET /api/order-lines?orderId=&lineStatus=&lineType=
    // ─────────────────────────────────────────────────────────────────

    @GetMapping
    public ResponseEntity<?> listLines(
            @RequestParam(value = "tenantId",   required = false) UUID tenantId,
            @RequestParam(value = "companyId",  required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId,
            @RequestParam(value = "orderId",    required = false) UUID orderId,
            @RequestParam(value = "lineStatus", required = false) String lineStatus,
            @RequestParam(value = "lineType",   required = false) String lineType) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) {
			return missingContext();
		}

        List<OrderLineResponseDto> result =
                orderLineService.listLines(tenantId, companyId, orderId, lineStatus, lineType);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET BY ID
    // GET /api/order-lines/{id}
    // ─────────────────────────────────────────────────────────────────

    @GetMapping("/{id}")
    public ResponseEntity<?> getLine(
            @PathVariable("id") UUID id,
            @RequestParam(value = "tenantId",   required = false) UUID tenantId,
            @RequestParam(value = "companyId",  required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) {
			return missingContext();
		}

        try {
            return ResponseEntity.ok(orderLineService.getById(id, tenantId, companyId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CREATE
    // POST /api/order-lines
    // ─────────────────────────────────────────────────────────────────

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createLine(
            @Valid @RequestBody OrderLineRequestDto dto,
            @RequestParam(value = "tenantId",   required = false) UUID tenantId,
            @RequestParam(value = "companyId",  required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) {
			return missingContext();
		}

        try {
            OrderLineResponseDto created = orderLineService.createLine(dto, tenantId, companyId);
            return ResponseEntity.status(HttpStatus.CREATED).body(created);
        } catch (OrderNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // UPDATE (full)
    // PUT /api/order-lines/{id}
    // ─────────────────────────────────────────────────────────────────

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateLine(
            @PathVariable("id") UUID id,
            @Valid @RequestBody OrderLineRequestDto dto,
            @RequestParam(value = "tenantId",   required = false) UUID tenantId,
            @RequestParam(value = "companyId",  required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) {
			return missingContext();
		}

        try {
            return ResponseEntity.ok(orderLineService.updateLine(id, dto, tenantId, companyId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // PATCH status
    // PATCH /api/order-lines/{id}/status
    // Body: { "status": "IN_PROGRESS" }
    // ─────────────────────────────────────────────────────────────────

    @PatchMapping(path = "/{id}/status", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateStatus(
            @PathVariable("id") UUID id,
            @RequestBody java.util.Map<String, String> body,
            @RequestParam(value = "tenantId",   required = false) UUID tenantId,
            @RequestParam(value = "companyId",  required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) {
			return missingContext();
		}

        String newStatus = body.get("status");
        try {
            return ResponseEntity.ok(orderLineService.updateStatus(id, newStatus, tenantId, companyId));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // DELETE
    // DELETE /api/order-lines/{id}
    // ─────────────────────────────────────────────────────────────────

    @DeleteMapping("/{id}")
    public ResponseEntity<?> deleteLine(
            @PathVariable("id") UUID id,
            @RequestParam(value = "tenantId",   required = false) UUID tenantId,
            @RequestParam(value = "companyId",  required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) {
			return missingContext();
		}

        try {
            orderLineService.deleteLine(id, tenantId, companyId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Error envelope (mirrors OrderController.ApiError)
    // ─────────────────────────────────────────────────────────────────

    public static class ApiError {
        private final String error;
        private final Instant timestamp = Instant.now();

        public ApiError(String error) { this.error = error; }

        public String getError() { return error; }
        public Instant getTimestamp() { return timestamp; }
    }
}
