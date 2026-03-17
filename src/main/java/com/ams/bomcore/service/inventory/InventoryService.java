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
    private final InventoryMovementService movementService;

    public InventoryService(InventoryRepository inventoryRepository,
                            MaterialRepository materialRepository,
                            WarehouseRepository warehouseRepository,
                            InventoryMovementService movementService) {
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
        this.movementService = movementService;
    }

    public List<InventoryEntity> listAll() {
        return inventoryRepository.findAll();
    }

    // New projection method for grid
    public List<InventoryViewDTO> listInventoryView(UUID tenantId, UUID companyId) {
        return inventoryRepository.findAllInventoryView(tenantId, companyId);
    }

    // New tenant+company scoped listing helpers
    public List<InventoryEntity> listAllByTenantAndCompany(UUID tenantId, UUID companyId) {
        return inventoryRepository.findByTenantIdAndCompanyId(tenantId, companyId);
    }

    public List<InventoryViewDTO> listInventoryViewByTenantAndCompany(UUID tenantId, UUID companyId) {
        return inventoryRepository.findAllInventoryView(tenantId, companyId);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStock(String materialCode, String warehouseCode, BigDecimal qty, String batchNo, Instant expirationDateTime, Instant productionDateTime, BigDecimal quantityReserved, UUID tenantId, UUID companyId) {
        return addStock(materialCode, warehouseCode, qty, batchNo, expirationDateTime, productionDateTime, quantityReserved, tenantId, companyId, "Manual add stock", "system", null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStock(String materialCode, String warehouseCode, BigDecimal qty, String batchNo,
                                     Instant expirationDateTime, Instant productionDateTime, BigDecimal quantityReserved,
                                     UUID tenantId, UUID companyId, String reason, String createdBy, String notes) {
        return addStock(materialCode, warehouseCode, qty, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, tenantId, companyId, reason, createdBy, notes, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStock(String materialCode, String warehouseCode, BigDecimal qty, String batchNo,
                                     Instant expirationDateTime, Instant productionDateTime, BigDecimal quantityReserved,
                                     UUID tenantId, UUID companyId, String reason, String createdBy, String notes,
                                     UUID invoiceId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to add must be positive");
        if (batchNo == null || batchNo.trim().isEmpty()) throw new InventoryException("batchNo is required");

        Material m = materialRepository.findByMaterialCode(materialCode)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialCode));
        WarehouseEntity w = warehouseRepository.findByCode(warehouseCode)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseCode));

        if (m.getTenant() == null || !m.getTenant().getId().equals(tenantId)) {
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
            // quantityTotal is NOT changed by movements — only set at import/initial creation
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
            // quantityTotal is NOT set here — only set at import/initial creation
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

        InventoryEntity saved = inventoryRepository.save(inv);

        // Record IN movement — inventoryId = this row, referenceId = invoice (if provided)
        movementService.recordInMovement(
                m.getId(), w.getId(), qty,
                m.getUnit() != null ? m.getUnit() : "pcs",
                batchNo,
                reason != null ? reason : "Manual add stock",
                createdBy != null ? createdBy : "system",
                invoiceId != null ? "INVOICE" : "INVENTORY",
                invoiceId != null ? invoiceId : saved.getId(),
                saved.getId(),
                notes,
                tenantId, companyId);

        return saved;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStockByIds(UUID materialId, UUID warehouseId, BigDecimal qty, String batchNo,
                                          Instant expirationDateTime, Instant productionDateTime,
                                          BigDecimal quantityReserved, UUID tenantId, UUID companyId) {
        return addStockByIds(materialId, warehouseId, qty, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, tenantId, companyId, "Manual add stock", "system", null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStockByIds(UUID materialId, UUID warehouseId, BigDecimal qty, String batchNo,
                                          Instant expirationDateTime, Instant productionDateTime,
                                          BigDecimal quantityReserved, UUID tenantId, UUID companyId,
                                          String reason, String createdBy, String notes) {
        return addStockByIds(materialId, warehouseId, qty, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, tenantId, companyId, reason, createdBy, notes, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStockByIds(UUID materialId, UUID warehouseId, BigDecimal qty, String batchNo,
                                          Instant expirationDateTime, Instant productionDateTime,
                                          BigDecimal quantityReserved, UUID tenantId, UUID companyId,
                                          String reason, String createdBy, String notes, UUID invoiceId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to add must be positive");
        if (batchNo == null || batchNo.trim().isEmpty()) throw new InventoryException("batchNo is required");

        Material m = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity w = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        if (m.getTenant() == null || !m.getTenant().getId().equals(tenantId)) {
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
            // quantityTotal is NOT changed by movements — only set at import/initial creation
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
            // quantityTotal is NOT set here — only set at import/initial creation
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

        InventoryEntity savedById = inventoryRepository.save(inv);

        // Record IN movement — inventoryId = this row, referenceId = invoice (if provided)
        movementService.recordInMovement(
                m.getId(), w.getId(), qty,
                m.getUnit() != null ? m.getUnit() : "pcs",
                batchNo,
                reason != null ? reason : "Manual add stock",
                createdBy != null ? createdBy : "system",
                invoiceId != null ? "INVOICE" : "INVENTORY",
                invoiceId != null ? invoiceId : savedById.getId(),
                savedById.getId(),
                notes,
                tenantId, companyId);

        return savedById;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(UUID inventoryId, BigDecimal newQuantityOnHand, String batchNo,
                                        Instant expirationDateTime, Instant productionDateTime,
                                        BigDecimal quantityReserved, UUID tenantId, UUID companyId) {
        return updateStock(inventoryId, newQuantityOnHand, null, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, tenantId, companyId, "Manual update stock", "system", null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(UUID inventoryId, BigDecimal newQuantityOnHand, String batchNo,
                                        Instant expirationDateTime, Instant productionDateTime,
                                        BigDecimal quantityReserved, UUID tenantId, UUID companyId,
                                        String reason, String createdBy, String notes) {
        return updateStock(inventoryId, newQuantityOnHand, null, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, tenantId, companyId, reason, createdBy, notes);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(UUID inventoryId, BigDecimal newQuantityOnHand, BigDecimal newQuantityTotal, String batchNo,
                                        Instant expirationDateTime, Instant productionDateTime,
                                        BigDecimal quantityReserved, UUID tenantId, UUID companyId,
                                        String reason, String createdBy, String notes) {
        if (newQuantityOnHand == null || newQuantityOnHand.compareTo(BigDecimal.ZERO) < 0) throw new InventoryException("Quantity must be non-negative");

        InventoryEntity inv = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) throw new InventoryException("inventory does not belong to tenant");
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) throw new InventoryException("inventory does not belong to company");

        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        BigDecimal newLocked = quantityReserved == null ? locked : quantityReserved;
        if (newQuantityOnHand.compareTo(newLocked) < 0) {
            throw new InventoryException("New quantity cannot be less than reserved quantity");
        }

        BigDecimal oldQty = inv.getQuantityOnHand() == null ? BigDecimal.ZERO : inv.getQuantityOnHand();
        BigDecimal delta  = newQuantityOnHand.subtract(oldQty);

        // Only update quantityOnHand — quantityTotal is set at import/initial creation only, never changed by movements or manual edits
        inv.setQuantityOnHand(newQuantityOnHand);
        if (batchNo != null) inv.setBatchNo(batchNo);
        if (expirationDateTime != null) inv.setExpirationDateTime(expirationDateTime);
        if (productionDateTime != null) inv.setProductionDateTime(productionDateTime);
        if (quantityReserved != null) inv.setQuantityLocked(quantityReserved);
        InventoryEntity updated = inventoryRepository.save(inv);

        if (delta.compareTo(BigDecimal.ZERO) != 0 && inv.getMaterial() != null && inv.getWarehouse() != null) {
            movementService.recordAdjustmentMovement(
                    inv.getMaterial().getId(),
                    inv.getWarehouse().getId(),
                    delta,
                    inv.getMaterial().getUnit() != null ? inv.getMaterial().getUnit() : "pcs",
                    inv.getBatchNo(),
                    reason != null ? reason : "Manual update stock",
                    createdBy != null ? createdBy : "system",
                    notes,
                    tenantId, companyId);
        }

        return updated;
    }

    // Keep previous signature for backward compatibility by delegating (optional)
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(String inventoryId, BigDecimal newQuantityOnHand) {
        return updateStock(UUID.fromString(inventoryId), newQuantityOnHand, null, null, null, null, null, null, "Manual update stock", "system", null);
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
    public InventoryEntity reserveById(UUID inventoryId, BigDecimal qty, UUID tenantId, UUID companyId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to reserve must be positive");
        InventoryEntity inv = inventoryRepository.findById(inventoryId).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) throw new InventoryException("inventory does not belong to tenant");
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) throw new InventoryException("inventory does not belong to company");

        BigDecimal available = inv.getQuantityOnHand().subtract(inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked());
        if (available.compareTo(qty) < 0) throw new InventoryException("Insufficient available quantity to reserve");
        inv.setQuantityLocked((inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked()).add(qty));
        return inventoryRepository.save(inv);
    }

    // Release by inventory id
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity releaseById(UUID inventoryId, BigDecimal qty, UUID tenantId, UUID companyId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) throw new InventoryException("Quantity to release must be positive");
        InventoryEntity inv = inventoryRepository.findById(inventoryId).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) throw new InventoryException("inventory does not belong to tenant");
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) throw new InventoryException("inventory does not belong to company");

        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        if (locked.compareTo(qty) < 0) throw new InventoryException("Cannot release more than locked quantity");
        inv.setQuantityLocked(locked.subtract(qty));
        return inventoryRepository.save(inv);
    }

    /**
     * Delete an inventory record by id, validating tenant/company ownership.
     */
    @Transactional
    public void deleteById(UUID inventoryId, UUID tenantId, UUID companyId) {
        InventoryEntity inv = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));
        if (tenantId != null && !tenantId.equals(inv.getTenantId()))
            throw new InventoryException("inventory does not belong to tenant");
        if (companyId != null && !companyId.equals(inv.getCompanyId()))
            throw new InventoryException("inventory does not belong to company");
        inventoryRepository.deleteById(inventoryId);
    }
}
