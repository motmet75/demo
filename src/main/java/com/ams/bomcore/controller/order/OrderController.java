package com.ams.bomcore.controller.order;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
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

import com.ams.bomcore.controller.order.dto.OrderCreateDto;
import com.ams.bomcore.controller.order.dto.OrderFinishDto;
import com.ams.bomcore.controller.order.dto.OrderResponseDto;
import com.ams.bomcore.controller.order.dto.OrderUpdateDto;
import com.ams.bomcore.service.order.OrderService;
import com.ams.bomcore.service.order.exception.BomNotFoundException;
import com.ams.bomcore.service.order.exception.InsufficientStockException;
import com.ams.bomcore.service.order.exception.InvalidOrderStatusException;
import com.ams.bomcore.service.order.exception.OrderNotFoundException;
import com.ams.bomcore.service.order.exception.QuotaExceededException;

/**
 * REST controller for the Order + Production lifecycle.
 *
 * <pre>
 * POST   /api/orders                     – create order (DRAFT)
 * GET    /api/orders                     – paginated list with filters
 * GET    /api/orders/{id}                – get by id
 * PUT    /api/orders/{id}                – update (DRAFT only)
 * PATCH  /api/orders/{id}/confirm        – DRAFT → CONFIRMED
 * PATCH  /api/orders/{id}/finish         – CONFIRMED/IN_PRODUCTION → COMPLETED
 * PATCH  /api/orders/{id}/deliver        – COMPLETED → DELIVERED
 * PATCH  /api/orders/{id}/cancel         – cancel + partial return
 * </pre>
 *
 * Multi-tenant: tenant + company resolved from headers (X-Tenant-Id, X-Company-Id)
 * or query params, following the same pattern as MaterialController.
 */
@CrossOrigin(origins = {"http://localhost:5173", "http://15.165.215.69:5173"})
@RestController
@RequestMapping("/orders")
public class OrderController {

    private final OrderService orderService;

    public OrderController(OrderService orderService) {
        this.orderService = orderService;
    }

    // ─────────────────────────────────────────────────────────────────
    // Helpers – tenant/company resolution (same pattern as MaterialController)
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
    // CREATE
    // ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/orders
     * Create a new order with header + lines. Calculates provisional BOM consumption.
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createOrder(
            @Valid @RequestBody OrderCreateDto dto,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        try {
            OrderResponseDto result = orderService.createOrder(dto, tenantId, companyId);
            return ResponseEntity.status(HttpStatus.CREATED).body(result);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError(e.getMessage()));
        } catch (BomNotFoundException e) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(new ApiError(e.getMessage()));
        } catch (InsufficientStockException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        } catch (QuotaExceededException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // LIST (paginated + filters)
    // ─────────────────────────────────────────────────────────────────

    /**
     * GET /api/orders?status=&orderType=&fromDate=&toDate=&page=&size=&sort=
     */
    @GetMapping
    public ResponseEntity<?> listOrders(
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "orderType", required = false) String orderType,
            @RequestParam(value = "fromDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant fromDate,
            @RequestParam(value = "toDate", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant toDate,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size,
            @RequestParam(value = "sort", defaultValue = "createdAt") String sort,
            @RequestParam(value = "direction", defaultValue = "desc") String direction) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        Sort.Direction sortDir = "asc".equalsIgnoreCase(direction) ? Sort.Direction.ASC : Sort.Direction.DESC;
        Pageable pageable = PageRequest.of(page, size, Sort.by(sortDir, sort));

        Page<OrderResponseDto> result = orderService.listOrders(
                tenantId, companyId, status, orderType, fromDate, toDate, pageable);
        return ResponseEntity.ok(result);
    }

    // ─────────────────────────────────────────────────────────────────
    // GET BY ID
    // ─────────────────────────────────────────────────────────────────

    /** GET /api/orders/{id} */
    @GetMapping("/{id}")
    public ResponseEntity<?> getById(
            @PathVariable("id") UUID id,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        try {
            return ResponseEntity.ok(orderService.getById(id, tenantId, companyId));
        } catch (OrderNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // UPDATE (DRAFT only)
    // ─────────────────────────────────────────────────────────────────

    /** PUT /api/orders/{id} */
    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateOrder(
            @PathVariable("id") UUID id,
            @Valid @RequestBody OrderUpdateDto dto,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        try {
            return ResponseEntity.ok(orderService.updateOrder(id, dto, tenantId, companyId));
        } catch (OrderNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        } catch (InvalidOrderStatusException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError(e.getMessage()));
        } catch (BomNotFoundException e) {
            return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(new ApiError(e.getMessage()));
        } catch (InsufficientStockException | QuotaExceededException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // LIFECYCLE TRANSITIONS
    // ─────────────────────────────────────────────────────────────────

    /** PATCH /api/orders/{id}/confirm */
    @PatchMapping("/{id}/confirm")
    public ResponseEntity<?> confirmOrder(
            @PathVariable("id") UUID id,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        try {
            return ResponseEntity.ok(orderService.confirmOrder(id, tenantId, companyId));
        } catch (OrderNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        } catch (InvalidOrderStatusException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        }
    }

    /** PATCH /api/orders/{id}/finish */
    @PatchMapping(path = "/{id}/finish", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> finishOrder(
            @PathVariable("id") UUID id,
            @RequestBody(required = false) OrderFinishDto dto,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        try {
            return ResponseEntity.ok(orderService.finishOrder(id, dto, tenantId, companyId));
        } catch (OrderNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        } catch (InvalidOrderStatusException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        }
    }

    /** PATCH /api/orders/{id}/deliver */
    @PatchMapping("/{id}/deliver")
    public ResponseEntity<?> deliverOrder(
            @PathVariable("id") UUID id,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        try {
            return ResponseEntity.ok(orderService.deliverOrder(id, tenantId, companyId));
        } catch (OrderNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        } catch (InvalidOrderStatusException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        }
    }

    /** PATCH /api/orders/{id}/cancel */
    @PatchMapping("/{id}/cancel")
    public ResponseEntity<?> cancelOrder(
            @PathVariable("id") UUID id,
            @RequestParam(value = "tenantId", required = false) UUID tenantId,
            @RequestParam(value = "companyId", required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        try {
            return ResponseEntity.ok(orderService.cancelOrder(id, tenantId, companyId));
        } catch (OrderNotFoundException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new ApiError(e.getMessage()));
        } catch (InvalidOrderStatusException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // CHECK INVENTORY
    // ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/orders/check-inventory
     * Body: { "orderIds": ["uuid1","uuid2"] }
     * Returns per-material availability result without modifying any data.
     */
    @PostMapping(path = "/check-inventory", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> checkInventory(
            @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId",      required = false) UUID tenantId,
            @RequestParam(value = "companyId",     required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        @SuppressWarnings("unchecked")
        List<String> ids = (List<String>) body.get("orderIds");
        if (ids == null || ids.isEmpty())
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError("orderIds required"));

        List<UUID> orderIds = ids.stream().map(UUID::fromString).toList();
        try {
            OrderService.CheckInventoryResult result = orderService.checkInventory(orderIds, tenantId, companyId);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // MOVE TO PRODUCTION
    // ─────────────────────────────────────────────────────────────────

    /**
     * POST /api/orders/move-to-production
     * Body: { "orderIds": ["uuid1","uuid2"], "deliveryDateTime": "ISO instant", "issuedBy": "user" }
     * Checks inventory, deducts stock, creates ISSUE_TO_PRODUCTION movements,
     * sets status → MATERIAL_READY.
     */
    @PostMapping(path = "/move-to-production", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> moveToProduction(
            @RequestBody Map<String, Object> body,
            @RequestParam(value = "tenantId",      required = false) UUID tenantId,
            @RequestParam(value = "companyId",     required = false) UUID companyId,
            @RequestHeader(value = "X-Tenant-Id",  required = false) String headerTenantId,
            @RequestHeader(value = "X-Company-Id", required = false) String headerCompanyId) {

        tenantId  = resolveTenant(tenantId, headerTenantId);
        companyId = resolveCompany(companyId, headerCompanyId);
        if (tenantId == null || companyId == null) return missingContext();

        @SuppressWarnings("unchecked")
        List<String> ids = (List<String>) body.get("orderIds");
        if (ids == null || ids.isEmpty())
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(new ApiError("orderIds required"));

        List<UUID> orderIds = ids.stream().map(UUID::fromString).toList();
        String issuedBy = body.get("issuedBy") != null ? String.valueOf(body.get("issuedBy")) : "system";
        Instant deliveryDateTime = body.get("deliveryDateTime") != null
                ? Instant.parse(String.valueOf(body.get("deliveryDateTime"))) : null;

        try {
            List<OrderResponseDto> results = orderService.moveToProduction(orderIds, deliveryDateTime, issuedBy, tenantId, companyId);
            return ResponseEntity.ok(results);
        } catch (InsufficientStockException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new ApiError(e.getMessage()));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(new ApiError(e.getMessage()));
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Inner error envelope
    // ─────────────────────────────────────────────────────────────────

    public static class ApiError {
        private final String error;
        private final Instant timestamp = Instant.now();

        public ApiError(String error) { this.error = error; }

        public String getError() { return error; }
        public Instant getTimestamp() { return timestamp; }
    }
}
