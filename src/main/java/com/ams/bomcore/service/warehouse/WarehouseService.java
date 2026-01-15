package com.ams.bomcore.service.warehouse;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.repository.WarehouseRepository;

/**
 * Service for Warehouse CRUD. Mirrors MaterialService behaviour and validation.
 */
@Service
public class WarehouseService {

    private final WarehouseRepository warehouseRepository;

    public WarehouseService(WarehouseRepository warehouseRepository) {
        this.warehouseRepository = warehouseRepository;
    }

    public WarehouseEntity create(WarehouseEntity warehouse) {
        if (warehouse == null) throw new IllegalArgumentException("Warehouse is required");
        String code = warehouse.getCode() == null ? null : warehouse.getCode().trim();
        if (code == null || code.isEmpty()) throw new IllegalArgumentException("warehouse code is required");
        if (warehouseRepository.existsByCode(code)) throw new IllegalArgumentException("warehouse code already exists: " + code);
        return warehouseRepository.save(warehouse);
    }

    public List<WarehouseEntity> findAll() {
        return warehouseRepository.findAll();
    }

    @Transactional(rollbackFor = Exception.class)
    public WarehouseEntity update(UUID id, WarehouseEntity warehouse) {
        if (id == null) throw new IllegalArgumentException("id is required");
        if (warehouse == null) throw new IllegalArgumentException("Warehouse is required");
        if (!warehouseRepository.existsById(id)) throw new IllegalArgumentException("Warehouse not found: " + id);

        String code = warehouse.getCode() == null ? null : warehouse.getCode().trim();
        if (code == null || code.isEmpty()) throw new IllegalArgumentException("warehouse code is required");

        Optional<WarehouseEntity> byCode = warehouseRepository.findByCode(code);
        if (byCode.isPresent() && !byCode.get().getId().equals(id)) {
            throw new IllegalArgumentException("warehouse code already exists: " + code);
        }

        warehouse.setId(id);
        return warehouseRepository.save(warehouse);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id) {
        if (id == null) return;
        warehouseRepository.findById(id).ifPresent(w -> {
            try {
                try {
                    w.getClass().getMethod("setIsActive", Boolean.class).invoke(w, Boolean.FALSE);
                    warehouseRepository.save(w);
                    return;
                } catch (NoSuchMethodException nsme) {
                    // fallback to hard delete
                }
            } catch (Exception ex) {
                throw new RuntimeException("Failed to delete warehouse: " + ex.getMessage(), ex);
            }
            warehouseRepository.deleteById(id);
        });
    }
}