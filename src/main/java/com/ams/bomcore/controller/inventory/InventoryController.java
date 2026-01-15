package com.ams.bomcore.controller.inventory;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.service.inventory.InventoryException;
import com.ams.bomcore.service.inventory.InventoryService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/inventory")
public class InventoryController {

    private final InventoryService inventoryService;

    public InventoryController(InventoryService inventoryService) {
        this.inventoryService = inventoryService;
    }

    @GetMapping
    public List<InventoryEntity> list() {
        return inventoryService.listAll();
    }

    /**
     * Add stock by materialCode + warehouseCode OR by materialId + warehouseId
     * Body: { "materialCode": "M-001", "warehouseCode": "WH-1", "quantity": 10 }
     * Or:   { "materialId": "<uuid>", "warehouseId": "<uuid>", "quantity": 10 }
     */
    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> addStock(@Valid @RequestBody Map<String, Object> body) {
        try {
            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));

            // prefer ids when provided
            Object mid = body.get("materialId");
            Object wid = body.get("warehouseId");
            if (mid != null && wid != null) {
                UUID materialId = UUID.fromString(String.valueOf(mid));
                UUID warehouseId = UUID.fromString(String.valueOf(wid));
                InventoryEntity saved = inventoryService.addStockByIds(materialId, warehouseId, qty);
                return ResponseEntity.status(HttpStatus.CREATED).body(saved);
            }

            // fallback to codes for backward compatibility
            String materialCode = (String) body.get("materialCode");
            String warehouseCode = (String) body.get("warehouseCode");
            InventoryEntity saved = inventoryService.addStock(materialCode, warehouseCode, qty);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Update stock by inventory id
     * Body: { "quantity": 12 }
     */
    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> updateStock(@PathVariable("id") String id, @Valid @RequestBody Map<String, Object> body) {
        try {
            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));
            InventoryEntity updated = inventoryService.updateStock(id, qty);
            return ResponseEntity.ok(updated);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Reserve quantity on an inventory record
     * Body: { "quantity": 5 }
     */
    @PostMapping(path = "/{id}/reserve", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> reserve(@PathVariable("id") String id, @Valid @RequestBody Map<String, Object> body) {
        try {
            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));
            InventoryEntity updated = inventoryService.reserveById(id, qty);
            return ResponseEntity.ok(updated);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }

    /**
     * Release quantity on an inventory record
     * Body: { "quantity": 5 }
     */
    @PostMapping(path = "/{id}/release", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> release(@PathVariable("id") String id, @Valid @RequestBody Map<String, Object> body) {
        try {
            BigDecimal qty = new BigDecimal(String.valueOf(body.get("quantity")));
            InventoryEntity updated = inventoryService.releaseById(id, qty);
            return ResponseEntity.ok(updated);
        } catch (InventoryException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(ex.getMessage());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(ex.getMessage());
        }
    }
}