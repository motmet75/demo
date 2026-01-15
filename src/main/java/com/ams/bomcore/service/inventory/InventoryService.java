package com.ams.bomcore.service.inventory;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStock(String materialCode, String warehouseCode, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to add must be positive");

        Material m = materialRepository.findByMaterialCode(materialCode).orElseThrow(() -> new InventoryException("Material not found: " + materialCode));
        WarehouseEntity w = warehouseRepository.findByCode(warehouseCode).orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseCode));

        Optional<InventoryEntity> existing = inventoryRepository.findByMaterialAndWarehouseCode(m, warehouseCode);
        InventoryEntity inv;
        if (existing.isPresent()) {
            inv = existing.get();
            inv.setQuantityOnHand(inv.getQuantityOnHand().add(qty));
        } else {
            inv = new InventoryEntity();
            inv.setMaterial(m);
            inv.setWarehouse(w);
            inv.setQuantityOnHand(qty);
            inv.setQuantityLocked(BigDecimal.ZERO);
        }

        // prevent negative - adding cannot create negative but keep check
        if (inv.getQuantityOnHand().compareTo(BigDecimal.ZERO) < 0) {
            throw new InventoryException("Resulting quantity would be negative");
        }

        return inventoryRepository.save(inv);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStockByIds(UUID materialId, UUID warehouseId, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to add must be positive");

        Material m = materialRepository.findById(materialId).orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity w = warehouseRepository.findById(warehouseId).orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        // reuse repository method that finds by material and warehouse code
        Optional<InventoryEntity> existing = inventoryRepository.findByMaterialAndWarehouseCode(m, w.getCode());
        InventoryEntity inv;
        if (existing.isPresent()) {
            inv = existing.get();
            inv.setQuantityOnHand(inv.getQuantityOnHand().add(qty));
        } else {
            inv = new InventoryEntity();
            inv.setMaterial(m);
            inv.setWarehouse(w);
            inv.setQuantityOnHand(qty);
            inv.setQuantityLocked(BigDecimal.ZERO);
        }

        if (inv.getQuantityOnHand().compareTo(BigDecimal.ZERO) < 0) {
            throw new InventoryException("Resulting quantity would be negative");
        }

        return inventoryRepository.save(inv);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(String inventoryId, BigDecimal newQuantityOnHand) {
        if (newQuantityOnHand == null || newQuantityOnHand.compareTo(BigDecimal.ZERO) < 0) throw new InventoryException("Quantity must be non-negative");

        InventoryEntity inv = inventoryRepository.findById(java.util.UUID.fromString(inventoryId)).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        // cannot set total less than reserved/locked quantity
        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        if (newQuantityOnHand.compareTo(locked) < 0) {
            throw new InventoryException("New quantity cannot be less than reserved quantity");
        }

        inv.setQuantityOnHand(newQuantityOnHand);
        return inventoryRepository.save(inv);
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
        if (locked.compareTo(qty) < 0) {
            throw new InventoryException("Cannot release more than locked quantity");
        }

        inv.setQuantityLocked(locked.subtract(qty));
        return inventoryRepository.save(inv);
    }

    // Reserve by inventory id (for controller endpoint convenience)
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity reserveById(String inventoryId, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to reserve must be positive");
        InventoryEntity inv = inventoryRepository.findById(java.util.UUID.fromString(inventoryId)).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));
        BigDecimal available = inv.getQuantityOnHand().subtract(inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked());
        if (available.compareTo(qty) < 0) throw new InventoryException("Insufficient available quantity to reserve");
        inv.setQuantityLocked((inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked()).add(qty));
        return inventoryRepository.save(inv);
    }

    // Release by inventory id
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity releaseById(String inventoryId, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to release must be positive");
        InventoryEntity inv = inventoryRepository.findById(java.util.UUID.fromString(inventoryId)).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));
        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        if (locked.compareTo(qty) < 0) throw new InventoryException("Cannot release more than locked quantity");
        inv.setQuantityLocked(locked.subtract(qty));
        return inventoryRepository.save(inv);
    }
}