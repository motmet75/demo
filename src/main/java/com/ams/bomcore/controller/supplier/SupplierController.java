package com.ams.bomcore.controller.supplier;

import java.util.List;
import java.util.UUID;
import java.util.Optional;
import java.util.Collections;

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

import com.ams.bomcore.domain.supplier.Supplier;
import com.ams.bomcore.repository.SupplierRepository;
import com.ams.bomcore.repository.SupplierIssueRepository;
import com.ams.bomcore.service.supplier.SupplierService;

@CrossOrigin(origins = "http://localhost:5173")
@RestController
@RequestMapping("/bom/api/suppliers")
public class SupplierController {

    private final SupplierService supplierService;
    private final SupplierRepository supplierRepository;
    private final SupplierIssueRepository supplierIssueRepository;

    public SupplierController(SupplierService supplierService, SupplierRepository supplierRepository, SupplierIssueRepository supplierIssueRepository) {
        this.supplierService = supplierService;
        this.supplierRepository = supplierRepository;
        this.supplierIssueRepository = supplierIssueRepository;
    }

    @GetMapping
    public List<Supplier> list() {
        return supplierService.findAll();
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> create(@Valid @RequestBody Supplier supplier) {
        try {
            Supplier saved = supplierService.create(supplier);
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Bad request"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Internal server error"));
        }
    }

    @PutMapping(path = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> update(@PathVariable("id") UUID id, @Valid @RequestBody Supplier supplier) {
        try {
            if (!supplierRepository.existsById(id)) {
                return ResponseEntity.notFound().build();
            }
            Supplier saved = supplierService.update(id, supplier);
            return ResponseEntity.ok(saved);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Bad request"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Internal server error"));
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable("id") UUID id) {
        if (!supplierRepository.existsById(id)) {
            return ResponseEntity.notFound().build();
        }

        // prevent delete if supplier has related supplier issues (interpreted as "supplier have record in inventory")
        if (supplierIssueRepository.existsBySupplierId(id)) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", "Supplier has related issues and cannot be deleted"));
        }

        try {
            supplierService.delete(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Bad request"));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(Collections.singletonMap("message", ex.getMessage() != null ? ex.getMessage() : "Internal server error"));
        }
    }
}