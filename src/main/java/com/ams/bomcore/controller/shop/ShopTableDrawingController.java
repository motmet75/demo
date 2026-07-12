package com.ams.bomcore.controller.shop;

import com.ams.bomcore.domain.shop.ShopTableDrawing;
import com.ams.bomcore.repository.ShopTableDrawingRepository;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.UUID;

@RestController
public class ShopTableDrawingController {

    private final ShopTableDrawingRepository repository;

    public ShopTableDrawingController(ShopTableDrawingRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/shop/staff/table-drawings")
    public ResponseEntity<?> list(@RequestParam(required = false) UUID tenantId,
                                  @RequestParam(required = false) UUID companyId,
                                  @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                  @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);
        return ResponseEntity.ok(repository.findAllByTenantIdAndCompanyIdOrderByCreatedAtAsc(tId, cId));
    }

    @PostMapping("/shop/staff/table-drawings")
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body,
                                    @RequestParam(required = false) UUID tenantId,
                                    @RequestParam(required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                    @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);

        ShopTableDrawing drawing = new ShopTableDrawing();
        drawing.setTenantId(tId);
        drawing.setCompanyId(cId);
        applyBody(drawing, body);
        return ResponseEntity.status(HttpStatus.CREATED).body(repository.save(drawing));
    }

    @PutMapping("/shop/staff/table-drawings/{drawingId}")
    public ResponseEntity<?> update(@PathVariable UUID drawingId,
                                    @RequestBody Map<String, Object> body,
                                    @RequestParam(required = false) UUID tenantId,
                                    @RequestParam(required = false) UUID companyId,
                                    @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                    @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);

        ShopTableDrawing drawing = repository.findByIdAndTenantIdAndCompanyId(drawingId, tId, cId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Drawing not found"));
        applyBody(drawing, body);
        return ResponseEntity.ok(repository.save(drawing));
    }

    @DeleteMapping("/shop/staff/table-drawings/{drawingId}")
    public ResponseEntity<Void> delete(@PathVariable UUID drawingId,
                                       @RequestParam(required = false) UUID tenantId,
                                       @RequestParam(required = false) UUID companyId,
                                       @RequestHeader(value = "X-Tenant-Id", required = false) String hTenant,
                                       @RequestHeader(value = "X-Company-Id", required = false) String hCompany) {
        UUID tId = resolve(tenantId, hTenant);
        UUID cId = resolve(companyId, hCompany);
        validateScope(tId, cId);

        ShopTableDrawing drawing = repository.findByIdAndTenantIdAndCompanyId(drawingId, tId, cId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Drawing not found"));
        repository.delete(drawing);
        return ResponseEntity.noContent().build();
    }

    private static void applyBody(ShopTableDrawing drawing, Map<String, Object> body) {
        String name = stringValue(body.get("drawingName"));
        String layoutJson = stringValue(body.get("layoutJson"));
        if (name == null || name.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "drawingName is required");
        }
        if (layoutJson == null || layoutJson.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "layoutJson is required");
        }
        drawing.setDrawingName(name.trim());
        drawing.setLayoutJson(layoutJson);
    }

    private static String stringValue(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static UUID resolve(UUID queryValue, String headerValue) {
        if (headerValue != null && !headerValue.isBlank()) {
            return UUID.fromString(headerValue);
        }
        return queryValue;
    }

    private static void validateScope(UUID tenantId, UUID companyId) {
        if (tenantId == null || companyId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "tenantId and companyId are required");
        }
    }
}
