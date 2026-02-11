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
        // prefer tenant+company scoped uniqueness when tenantId/companyId present
        UUID tenantId = warehouse.getTenantId();
        UUID companyId = warehouse.getCompanyId();
        boolean exists;
        if (tenantId != null && companyId != null) {
            exists = warehouseRepository.existsByCodeAndTenantIdAndCompanyId(code, tenantId, companyId);
        } else if (tenantId != null) {
            exists = warehouseRepository.existsByCodeAndTenantId(code, tenantId);
        } else {
            exists = warehouseRepository.existsByCode(code);
        }
        if (exists) throw new IllegalArgumentException("warehouse code already exists: " + code);
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

        // Use tenant+company scoped lookup if possible to ensure uniqueness within scope
        UUID tenantId = warehouse.getTenantId();
        UUID companyId = warehouse.getCompanyId();
        Optional<WarehouseEntity> byCode = Optional.empty();
        if (tenantId != null && companyId != null) {
            byCode = warehouseRepository.findByCodeAndTenantIdAndCompanyId(code, tenantId, companyId);
        } else if (tenantId != null) {
            byCode = warehouseRepository.findByCodeAndTenantId(code, tenantId);
        } else {
            byCode = warehouseRepository.findByCode(code);
        }

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