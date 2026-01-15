package com.ams.bomcore.service.supplier;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.supplier.Supplier;
import com.ams.bomcore.repository.SupplierRepository;

/**
 * Simple single-responsibility service for Supplier CRUD. Mirrors MaterialService style.
 */
@Service
public class SupplierService {

    private final SupplierRepository supplierRepository;

    public SupplierService(SupplierRepository supplierRepository) {
        this.supplierRepository = supplierRepository;
    }

    public Supplier create(Supplier supplier) {
        if (supplier == null) throw new IllegalArgumentException("Supplier is required");

        String code = supplier.getSupplierCode() == null ? null : supplier.getSupplierCode().trim();
        if (code == null || code.isEmpty()) {
            throw new IllegalArgumentException("supplier code is required");
        }

        if (supplierRepository.existsBySupplierCode(code)) {
            throw new IllegalArgumentException("supplier code already exists: " + code);
        }

        return supplierRepository.save(supplier);
    }

    public List<Supplier> findAll() {
        return supplierRepository.findAll();
    }

    @Transactional(rollbackFor = Exception.class)
    public Supplier update(UUID id, Supplier supplier) {
        if (id == null) throw new IllegalArgumentException("id is required");
        if (supplier == null) throw new IllegalArgumentException("Supplier is required");

        if (!supplierRepository.existsById(id)) {
            throw new IllegalArgumentException("Supplier not found: " + id);
        }

        String code = supplier.getSupplierCode() == null ? null : supplier.getSupplierCode().trim();
        if (code == null || code.isEmpty()) {
            throw new IllegalArgumentException("supplier code is required");
        }

        Optional<Supplier> byCode = supplierRepository.findBySupplierCode(code);
        if (byCode.isPresent() && !byCode.get().getId().equals(id)) {
            throw new IllegalArgumentException("supplier code already exists: " + code);
        }

        supplier.setId(id);
        return supplierRepository.save(supplier);
    }

    /**
     * Soft delete: mark supplier as inactive (if isActive exists). Otherwise perform hard delete.
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id) {
        if (id == null) return;
        supplierRepository.findById(id).ifPresent(s -> {
            try {
                // try soft-delete if field exists
                try {
                    s.getClass().getMethod("setIsActive", Boolean.class).invoke(s, Boolean.FALSE);
                    supplierRepository.save(s);
                    return;
                } catch (NoSuchMethodException nsme) {
                    // soft-delete not supported; fall back to hard delete
                }
            } catch (Exception ex) {
                throw new RuntimeException("Failed to delete supplier: " + ex.getMessage(), ex);
            }
            supplierRepository.deleteById(id);
        });
    }
}