package com.ams.bomcore.service.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.controller.inventory.dto.InventoryViewDTO;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.WarehouseRepository;

/**
 * Inventory operations: list, add stock, update stock, reserve, release.
 * All operations are transactional and throw InventoryException on invalid operations.
 */
@Service
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final WarehouseRepository warehouseRepository;

    public InventoryService(InventoryRepository inventoryRepository, MaterialRepository materialRepository, WarehouseRepository warehouseRepository) {
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
    }

    public List<InventoryEntity> listAll() {
        return inventoryRepository.findAll();
    }

    // New projection method for grid
    public List<InventoryViewDTO> listInventoryView(String tenantId, String companyId) {
        return inventoryRepository.findAllInventoryView(tenantId, companyId);
    }

    // New tenant+company scoped listing helpers
    public List<InventoryEntity> listAllByTenantAndCompany(String tenantId, String companyId) {
        // we rely on repository-level queries or application-level filtering; for now return all and let controller ensure context
        // Future improvement: add repository methods to filter by tenantId/companyId
        return inventoryRepository.findAll();
    }

    public List<InventoryViewDTO> listInventoryViewByTenantAndCompany(String tenantId, String companyId) {
        return inventoryRepository.findAllInventoryView(tenantId, companyId);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStock(String materialCode, String warehouseCode, BigDecimal qty, String batchNo, Instant expirationDateTime, Instant productionDateTime, BigDecimal quantityReserved, String tenantId, String companyId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to add must be positive");
        if (batchNo == null || batchNo.trim().isEmpty()) throw new InventoryException("batchNo is required");

        Material m = materialRepository.findByMaterialCode(materialCode)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialCode));
        WarehouseEntity w = warehouseRepository.findByCode(warehouseCode)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseCode));

        // Validate tenant/company ownership where possible
        if (m.getTenant() == null || !m.getTenant().getId().toString().equals(tenantId)) {
            throw new InventoryException("material does not belong to tenant");
        }
        if (w.getTenantId() == null || !w.getTenantId().equals(tenantId)) {
            throw new InventoryException("warehouse does not belong to tenant");
        }

        Optional<InventoryEntity> existing = inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNo(m, warehouseCode, batchNo);
        InventoryEntity inv;
        if (existing.isPresent()) {
            inv = existing.get();
            inv.setQuantityOnHand(inv.getQuantityOnHand().add(qty));
            // if quantityReserved provided, update locked
            if (quantityReserved != null) {
                if (quantityReserved.compareTo(inv.getQuantityOnHand()) > 0) throw new InventoryException("Reserved quantity cannot exceed on-hand quantity");
                inv.setQuantityLocked(quantityReserved);
            }
        } else {
            inv = new InventoryEntity();
            inv.setMaterial(m);
            inv.setWarehouse(w);
            inv.setBatchNo(batchNo);
            inv.setQuantityOnHand(qty);
            inv.setQuantityLocked(quantityReserved == null ? BigDecimal.ZERO : quantityReserved);
            if (inv.getQuantityLocked().compareTo(inv.getQuantityOnHand()) > 0) throw new InventoryException("Reserved quantity cannot exceed on-hand quantity");
            inv.setExpirationDateTime(expirationDateTime);
            inv.setProductionDateTime(productionDateTime);
            // set tenant/company for record scoping
            inv.setTenantId(tenantId);
            inv.setCompanyId(companyId);
        }

        // prevent negative - adding cannot create negative but keep check
        if (inv.getQuantityOnHand().compareTo(BigDecimal.ZERO) < 0) {
            throw new InventoryException("Resulting quantity would be negative");
        }

        return inventoryRepository.save(inv);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStockByIds(UUID materialId, UUID warehouseId, BigDecimal qty, String batchNo, Instant expirationDateTime, Instant productionDateTime, BigDecimal quantityReserved, String tenantId, String companyId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to add must be positive");
        if (batchNo == null || batchNo.trim().isEmpty()) throw new InventoryException("batchNo is required");

        Material m = materialRepository.findById(materialId).orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity w = warehouseRepository.findById(warehouseId).orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        if (m.getTenant() == null || !m.getTenant().getId().toString().equals(tenantId)) {
            throw new InventoryException("material does not belong to tenant");
        }
        if (w.getTenantId() == null || !w.getTenantId().equals(tenantId)) {
            throw new InventoryException("warehouse does not belong to tenant");
        }

        Optional<InventoryEntity> existing = inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNo(m, w.getCode(), batchNo);
        InventoryEntity inv;
        if (existing.isPresent()) {
            inv = existing.get();
            inv.setQuantityOnHand(inv.getQuantityOnHand().add(qty));
            if (quantityReserved != null) {
                if (quantityReserved.compareTo(inv.getQuantityOnHand()) > 0) throw new InventoryException("Reserved quantity cannot exceed on-hand quantity");
                inv.setQuantityLocked(quantityReserved);
            }
        } else {
            inv = new InventoryEntity();
            inv.setMaterial(m);
            inv.setWarehouse(w);
            inv.setBatchNo(batchNo);
            inv.setQuantityOnHand(qty);
            inv.setQuantityLocked(quantityReserved == null ? BigDecimal.ZERO : quantityReserved);
            if (inv.getQuantityLocked().compareTo(inv.getQuantityOnHand()) > 0) throw new InventoryException("Reserved quantity cannot exceed on-hand quantity");
            inv.setExpirationDateTime(expirationDateTime);
            inv.setProductionDateTime(productionDateTime);
            inv.setTenantId(tenantId);
            inv.setCompanyId(companyId);
        }

        if (inv.getQuantityOnHand().compareTo(BigDecimal.ZERO) < 0) {
            throw new InventoryException("Resulting quantity would be negative");
        }

        return inventoryRepository.save(inv);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(String inventoryId, BigDecimal newQuantityOnHand, String batchNo, Instant expirationDateTime, Instant productionDateTime, BigDecimal quantityReserved, String tenantId, String companyId) {
        if (newQuantityOnHand == null || newQuantityOnHand.compareTo(BigDecimal.ZERO) < 0) throw new InventoryException("Quantity must be non-negative");

        InventoryEntity inv = inventoryRepository.findById(java.util.UUID.fromString(inventoryId)).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        // tenant/company check: ensure inventory belongs to tenant/company
        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) throw new InventoryException("inventory does not belong to tenant");
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) throw new InventoryException("inventory does not belong to company");

        // cannot set total less than reserved/locked quantity unless reserved is also being changed
        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        BigDecimal newLocked = quantityReserved == null ? locked : quantityReserved;
        if (newQuantityOnHand.compareTo(newLocked) < 0) {
            throw new InventoryException("New quantity cannot be less than reserved quantity");
        }

        inv.setQuantityOnHand(newQuantityOnHand);
        if (batchNo != null) inv.setBatchNo(batchNo);
        if (expirationDateTime != null) inv.setExpirationDateTime(expirationDateTime);
        if (productionDateTime != null) inv.setProductionDateTime(productionDateTime);
        if (quantityReserved != null) inv.setQuantityLocked(quantityReserved);
        return inventoryRepository.save(inv);
    }

    // Keep previous signature for backward compatibility by delegating (optional)
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(String inventoryId, BigDecimal newQuantityOnHand) {
        return updateStock(inventoryId, newQuantityOnHand, null, null, null, null, null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity reserveQuantity(String materialCode, String warehouseCode, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to reserve must be positive");

        Material m = materialRepository.findByMaterialCode(materialCode).orElseThrow(() -> new InventoryException("Material not found: " + materialCode));
        InventoryEntity inv = inventoryRepository.findByMaterialAndWarehouseCode(m, warehouseCode).orElseThrow(() -> new InventoryException("Inventory not found for material " + materialCode + " in warehouse " + warehouseCode));

        BigDecimal available = inv.getQuantityOnHand().subtract(inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked());
        if (available.compareTo(qty) < 0) {
            throw new InventoryException("Insufficient available quantity to reserve");
        }

        inv.setQuantityLocked((inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked()).add(qty));
        return inventoryRepository.save(inv);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity releaseQuantity(String materialCode, String warehouseCode, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to release must be positive");

        Material m = materialRepository.findByMaterialCode(materialCode).orElseThrow(() -> new InventoryException("Material not found: " + materialCode));
        InventoryEntity inv = inventoryRepository.findByMaterialAndWarehouseCode(m, warehouseCode).orElseThrow(() -> new InventoryException("Inventory not found for material " + materialCode + " in warehouse " + warehouseCode));

        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        if (locked.compareTo(qty) < 0) throw new InventoryException("Cannot release more than locked quantity");

        inv.setQuantityLocked(locked.subtract(qty));
        return inventoryRepository.save(inv);
    }

    // Reserve by inventory id (for controller endpoint convenience)
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity reserveById(String inventoryId, BigDecimal qty, String tenantId, String companyId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to reserve must be positive");
        InventoryEntity inv = inventoryRepository.findById(java.util.UUID.fromString(inventoryId)).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) throw new InventoryException("inventory does not belong to tenant");
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) throw new InventoryException("inventory does not belong to company");

        BigDecimal available = inv.getQuantityOnHand().subtract(inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked());
        if (available.compareTo(qty) < 0) throw new InventoryException("Insufficient available quantity to reserve");
        inv.setQuantityLocked((inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked()).add(qty));
        return inventoryRepository.save(inv);
    }

    // Release by inventory id
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity releaseById(String inventoryId, BigDecimal qty, String tenantId, String companyId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to release must be positive");
        InventoryEntity inv = inventoryRepository.findById(java.util.UUID.fromString(inventoryId)).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) throw new InventoryException("inventory does not belong to tenant");
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) throw new InventoryException("inventory does not belong to company");

        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        if (locked.compareTo(qty) < 0) throw new InventoryException("Cannot release more than locked quantity");
        inv.setQuantityLocked(locked.subtract(qty));
        return inventoryRepository.save(inv);
    }
}
