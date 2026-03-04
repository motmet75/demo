package com.ams.bomcore.service.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.inventory.InventoryLockEntity;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.repository.InventoryLockRepository;
import com.ams.bomcore.repository.WarehouseRepository;
import com.ams.bomcore.repository.MaterialRepository;

/**
 * Service responsible for creating and releasing inventory locks.
 * Different lock types (BOM, DEFECT, SUPPLIER) will be handled here.
 * This follows the single-responsibility pattern and keeps locking separate from calculation.
 */
@Service
public class InventoryLockService {

    private final InventoryLockRepository inventoryLockRepository;
    private final MaterialRepository materialRepository;
    private final WarehouseRepository warehouseRepository;

    public InventoryLockService(InventoryLockRepository inventoryLockRepository,
                                MaterialRepository materialRepository,
                                WarehouseRepository warehouseRepository) {
        this.inventoryLockRepository = inventoryLockRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
    }

    @Transactional
    public InventoryLockEntity createLock(UUID materialId, UUID warehouseId, String lockType,
                                          BigDecimal quantity, String referenceType, UUID referenceId) {
        return createLock(materialId, warehouseId, lockType, quantity, referenceType, referenceId, null, null);
    }

    @Transactional
    public InventoryLockEntity createLock(UUID materialId, UUID warehouseId, String lockType,
                                          BigDecimal quantity, String referenceType, UUID referenceId,
                                          UUID tenantId, UUID companyId) {
        Material m = materialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Material not found: " + materialId));
        WarehouseEntity w = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new IllegalArgumentException("Warehouse not found: " + warehouseId));

        InventoryLockEntity lock = new InventoryLockEntity();
        lock.setMaterial(m);
        lock.setWarehouse(w);
        lock.setLockType(lockType);
        lock.setQuantity(quantity);
        lock.setReferenceType(referenceType);
        lock.setReferenceId(referenceId);
        lock.setStatus("ACTIVE");
        // Use provided tenantId/companyId; fall back to material's tenant/company if not supplied
        if (tenantId != null) {
            lock.setTenantId(tenantId);
        } else if (m.getTenant() != null) {
            lock.setTenantId(m.getTenant().getId());
        }
        if (companyId != null) {
            lock.setCompanyId(companyId);
        } else if (m.getCompany() != null) {
            lock.setCompanyId(m.getCompany().getId());
        }
        return inventoryLockRepository.save(lock);
    }

    @Transactional
    public InventoryLockEntity releaseLock(UUID lockId) {
        InventoryLockEntity lock = inventoryLockRepository.findById(lockId)
                .orElseThrow(() -> new IllegalArgumentException("Lock not found: " + lockId));
        lock.setStatus("RELEASED");
        return inventoryLockRepository.save(lock);
    }

    public List<InventoryLockEntity> findActiveLocksForMaterial(UUID materialId) {
        return inventoryLockRepository.findByMaterial_IdAndStatus(materialId, "ACTIVE");
    }
}