package com.ams.bomcore.controller.warehouse;

import java.util.List;
import java.util.UUID;
import java.util.Optional;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.repository.WarehouseRepository;
import com.ams.bomcore.service.warehouse.WarehouseService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/warehouses")
public class WarehouseController {

    private final WarehouseService warehouseService;
    private final WarehouseRepository warehouseRepository;

    public WarehouseController(WarehouseService warehouseService, WarehouseRepository warehouseRepository) {
        this.warehouseService = warehouseService;
        this.warehouseRepository = warehouseRepository;
    }

    @GetMapping
    public List<WarehouseEntity> list() {
        return warehouseService.findAll();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody WarehouseEntity warehouse) {
        try {
            sanitize(warehouse);
            WarehouseEntity saved = warehouseService.create(warehouse);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(java.util.Collections.singletonMap("message", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(java.util.Collections.singletonMap("message", ex.getMessage()));
        }
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable("id") UUID id, @Valid @RequestBody WarehouseEntity warehouse) {
        try {
            if (!warehouseRepository.existsById(id)) return ResponseEntity.notFound().build();
            sanitize(warehouse);
            WarehouseEntity saved = warehouseService.update(id, warehouse);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(java.util.Collections.singletonMap("message", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(java.util.Collections.singletonMap("message", ex.getMessage()));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") UUID id) {
        if (!warehouseRepository.existsById(id)) return ResponseEntity.notFound().build();
        try {
            warehouseService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(java.util.Collections.singletonMap("message", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(java.util.Collections.singletonMap("message", ex.getMessage()));
        }
    }

    // Defensive sanitation: convert literal strings "null"/"undefined"/empty into real nulls and trim values
    private void sanitize(WarehouseEntity w) {
        if (w == null) return;

        w.setCode(nullIfLiteral(w.getCode()));
        w.setName(nullIfLiteral(w.getName()));
        w.setLocation(nullIfLiteral(w.getLocation()));
        // isActive is Boolean; leave as-is. createdAt/id will be handled by JPA/service logic.
    }

    private String nullIfLiteral(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        String low = t.toLowerCase();
        if ("null".equals(low) || "undefined".equals(low)) return null;
        return t;
    }
}