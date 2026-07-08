package com.ams.bomcore.service.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.context.UserContext;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.InventoryMovementEntity;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.repository.InventoryMovementRepository;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.WarehouseRepository;

/**
 * Service for managing inventory movements.
 * Records all IN, OUT, TRANSFER, ADJUSTMENT movements and updates inventory quantities accordingly.
 */
@Service
public class InventoryMovementService {

    // Movement types
    public static final String MOVEMENT_IN         = "IN";
    public static final String MOVEMENT_OUT        = "OUT";
    public static final String MOVEMENT_TRANSFER   = "TRANSFER";
    public static final String MOVEMENT_ADJUSTMENT = "ADJUSTMENT";
    public static final String MOVEMENT_IMPORT     = "IMPORT";

    private final InventoryMovementRepository movementRepository;
    private final InventoryRepository inventoryRepository;
    private final MaterialRepository materialRepository;
    private final WarehouseRepository warehouseRepository;

    public InventoryMovementService(InventoryMovementRepository movementRepository,
                                    InventoryRepository inventoryRepository,
                                    MaterialRepository materialRepository,
                                    WarehouseRepository warehouseRepository) {
        this.movementRepository = movementRepository;
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
    }

    // ─── helpers ────────────────────────────────────────────────────────────────

    /** Resolve createdBy: prefer explicit param, fall back to UserContext (thread-local), then "system". */
    private String resolveCreatedBy(String createdBy) {
        if (createdBy != null && !createdBy.isBlank()) {
			return createdBy;
		}
        return UserContext.getUsernameOrDefault();
    }

    /** Find an inventory row by material + warehouse + batchNo. Returns empty Optional when batchNo is null/blank (uses first row for that material+warehouse). */
    private Optional<InventoryEntity> findInventory(Material material, WarehouseEntity warehouse, String batchNo) {
        if (batchNo != null && !batchNo.isBlank()) {
            return inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNo(material, warehouse.getCode(), batchNo);
        }
        return inventoryRepository.findByMaterialAndWarehouseCode(material, warehouse.getCode());
    }

    /** Find or create an inventory row. Used for IN so a row is auto-created if it doesn't yet exist. */
    private InventoryEntity findOrCreateInventory(Material material, WarehouseEntity warehouse, String batchNo,
                                                   UUID tenantId, UUID companyId) {
        Optional<InventoryEntity> opt = findInventory(material, warehouse, batchNo);
        if (opt.isPresent()) {
			return opt.get();
		}

        InventoryEntity inv = new InventoryEntity();
        inv.setMaterial(material);
        inv.setWarehouse(warehouse);
        inv.setBatchNo(batchNo != null && !batchNo.isBlank() ? batchNo : "DEFAULT");
        inv.setQuantityOnHand(BigDecimal.ZERO);
        inv.setQuantityTotal(BigDecimal.ZERO);
        inv.setQuantityReserved(BigDecimal.ZERO);
        inv.setQuantityLocked(BigDecimal.ZERO);
        inv.setUnit(material.getUnit() != null ? material.getUnit() : "pcs");
        inv.setTenantId(tenantId);
        inv.setCompanyId(companyId);
        inv.setMaterialCodeDenorm(material.getMaterialCode());
        inv.setWarehouseCodeDenorm(warehouse.getCode());
        return inventoryRepository.save(inv);
    }

    // ─── query methods ───────────────────────────────────────────────────────────

    public List<InventoryMovementEntity> listAll(UUID tenantId, UUID companyId) {
        return movementRepository.findAllByTenantAndCompanyOrderByCreatedAtDesc(tenantId, companyId);
    }

    public List<InventoryMovementEntity> listByType(UUID tenantId, UUID companyId, String movementType) {
        return movementRepository.findByTenantIdAndCompanyIdAndMovementType(tenantId, companyId, movementType);
    }

    public List<InventoryMovementEntity> listByMaterial(UUID tenantId, UUID companyId, UUID materialId) {
        return movementRepository.findByTenantIdAndCompanyIdAndMaterialId(tenantId, companyId, materialId);
    }

    public List<InventoryMovementEntity> listByDateRange(UUID tenantId, UUID companyId, Instant fromDate, Instant toDate) {
        return movementRepository.findByTenantIdAndCompanyIdAndDateRange(tenantId, companyId, fromDate, toDate);
    }

    // ─── IN ─────────────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordInMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                     String unit, String batchNo, String reason, String createdBy,
                                                     String referenceType, UUID referenceId, String notes,
                                                     UUID tenantId, UUID companyId) {
        return recordInMovement(materialId, warehouseId, quantity, unit, batchNo, reason, createdBy,
                referenceType, referenceId, null, notes, tenantId, companyId);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordInMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                     String unit, String batchNo, String reason, String createdBy,
                                                     String referenceType, UUID referenceId, UUID inventoryId,
                                                     String notes, UUID tenantId, UUID companyId) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
			throw new InventoryException("IN quantity must be positive");
		}

        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        // ── update inventory ────────────────────────────────────────────────────
        InventoryEntity inv;
        if (inventoryId != null) {
            inv = inventoryRepository.findById(inventoryId)
                    .orElseGet(() -> findOrCreateInventory(material, warehouse, batchNo, tenantId, companyId));
        } else {
            inv = findOrCreateInventory(material, warehouse, batchNo, tenantId, companyId);
        }
        // Only update quantityOnHand — quantityTotal is NOT changed by movements
        inv.setQuantityOnHand((inv.getQuantityOnHand() == null ? BigDecimal.ZERO : inv.getQuantityOnHand()).add(quantity));
        InventoryEntity savedInv = inventoryRepository.save(inv);

        // ── record movement ─────────────────────────────────────────────────────
        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        movement.setToWarehouse(warehouse);
        movement.setQuantity(quantity);
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(MOVEMENT_IN);
        movement.setReason(reason);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setInventoryId(savedInv.getId());
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(resolveCreatedBy(createdBy));
        movement.setNotes(notes);
        movement.setStatus("COMPLETED");
        return movementRepository.save(movement);
    }

    /**
     * Record an IN movement log entry only. Use this when the caller has already
     * applied the on-hand quantity change to the inventory row.
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordInMovementLogOnly(UUID inventoryId, UUID materialId, UUID warehouseId,
                                                            BigDecimal quantity, String unit, String batchNo,
                                                            String reason, String createdBy, String referenceType,
                                                            UUID referenceId, String notes,
                                                            UUID tenantId, UUID companyId) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InventoryException("IN quantity must be positive");
        }
        if (inventoryId == null) {
            throw new InventoryException("inventoryId is required for IN movement log");
        }

        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        movement.setToWarehouse(warehouse);
        movement.setQuantity(quantity);
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(MOVEMENT_IN);
        movement.setReason(reason);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setInventoryId(inventoryId);
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(resolveCreatedBy(createdBy));
        movement.setNotes(notes);
        movement.setStatus("COMPLETED");
        return movementRepository.save(movement);
    }
    // ─── OUT ────────────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordOutMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                      String unit, String batchNo, String reason, String createdBy,
                                                      String referenceType, UUID referenceId, String notes,
                                                      UUID tenantId, UUID companyId) {
        return recordOutMovement(materialId, warehouseId, quantity, unit, batchNo, reason, createdBy,
                referenceType, referenceId, null, notes, tenantId, companyId);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordOutMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                      String unit, String batchNo, String reason, String createdBy,
                                                      String referenceType, UUID referenceId, UUID inventoryId,
                                                      String notes, UUID tenantId, UUID companyId) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
			throw new InventoryException("OUT quantity must be positive");
		}

        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        // ── update inventory ────────────────────────────────────────────────────
        InventoryEntity inv;
        if (inventoryId != null) {
            inv = inventoryRepository.findById(inventoryId)
                    .orElseGet(() -> findInventory(material, warehouse, batchNo)
                            .orElseThrow(() -> new InventoryException("Inventory row not found for OUT movement")));
        } else {
            inv = findInventory(material, warehouse, batchNo)
                    .orElseThrow(() -> new InventoryException(
                            "No inventory found for material " + material.getMaterialCode()
                            + " in warehouse " + warehouse.getCode()
                            + (batchNo != null ? " batch " + batchNo : "")));
        }

        BigDecimal onHand = inv.getQuantityOnHand() == null ? BigDecimal.ZERO : inv.getQuantityOnHand();
        BigDecimal reserved = inv.getQuantityReserved() == null ? BigDecimal.ZERO : inv.getQuantityReserved();
        BigDecimal available = onHand.subtract(reserved);

        if (available.compareTo(quantity) < 0) {
            throw new InventoryException(String.format(
                    "Insufficient available quantity for OUT movement. Available: %s, Requested: %s (onHand=%s, reserved=%s)",
                    available.toPlainString(), quantity.toPlainString(),
                    onHand.toPlainString(), reserved.toPlainString()));
        }

        inv.setQuantityOnHand(onHand.subtract(quantity));
        // Release any reserved portion consumed by this OUT
        if (reserved.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal releaseAmt = reserved.min(quantity);
            inv.setQuantityReserved(reserved.subtract(releaseAmt));
        }
        InventoryEntity savedInv = inventoryRepository.save(inv);

        // ── record movement ─────────────────────────────────────────────────────
        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        movement.setFromWarehouse(warehouse);
        movement.setQuantity(quantity.negate());  // negative — stock leaving inventory
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(MOVEMENT_OUT);
        movement.setReason(reason);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setInventoryId(savedInv.getId());
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(resolveCreatedBy(createdBy));
        movement.setNotes(notes);
        movement.setStatus("COMPLETED");
        return movementRepository.save(movement);
    }

    // ─── TRANSFER ───────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordTransferMovement(UUID materialId, UUID fromWarehouseId, UUID toWarehouseId,
                                                           BigDecimal quantity, String unit, String batchNo,
                                                           String reason, String createdBy, String notes,
                                                           UUID tenantId, UUID companyId) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
			throw new InventoryException("TRANSFER quantity must be positive");
		}

        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity fromWarehouse = warehouseRepository.findById(fromWarehouseId)
                .orElseThrow(() -> new InventoryException("From warehouse not found: " + fromWarehouseId));
        WarehouseEntity toWarehouse = warehouseRepository.findById(toWarehouseId)
                .orElseThrow(() -> new InventoryException("To warehouse not found: " + toWarehouseId));

        // ── deduct from source ──────────────────────────────────────────────────
        InventoryEntity srcInv = findInventory(material, fromWarehouse, batchNo)
                .orElseThrow(() -> new InventoryException(
                        "No inventory found for material " + material.getMaterialCode()
                        + " in source warehouse " + fromWarehouse.getCode()
                        + (batchNo != null ? " batch " + batchNo : "")));

        BigDecimal srcOnHand  = srcInv.getQuantityOnHand() == null ? BigDecimal.ZERO : srcInv.getQuantityOnHand();
        BigDecimal srcReserved = srcInv.getQuantityReserved() == null ? BigDecimal.ZERO : srcInv.getQuantityReserved();
        BigDecimal srcAvailable = srcOnHand.subtract(srcReserved);

        if (srcAvailable.compareTo(quantity) < 0) {
            throw new InventoryException(String.format(
                    "Insufficient available quantity for TRANSFER. Available: %s, Requested: %s",
                    srcAvailable.toPlainString(), quantity.toPlainString()));
        }
        srcInv.setQuantityOnHand(srcOnHand.subtract(quantity));
        inventoryRepository.save(srcInv);

        // ── add to destination — only quantityOnHand, NOT quantityTotal ──────────
        InventoryEntity dstInv = findOrCreateInventory(material, toWarehouse, batchNo, tenantId, companyId);
        dstInv.setQuantityOnHand((dstInv.getQuantityOnHand() == null ? BigDecimal.ZERO : dstInv.getQuantityOnHand()).add(quantity));
        inventoryRepository.save(dstInv);

        // ── record movement ─────────────────────────────────────────────────────
        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        movement.setFromWarehouse(fromWarehouse);
        movement.setToWarehouse(toWarehouse);
        movement.setQuantity(quantity);
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(MOVEMENT_TRANSFER);
        movement.setReason(reason);
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(resolveCreatedBy(createdBy));
        movement.setNotes(notes);
        movement.setStatus("COMPLETED");
        return movementRepository.save(movement);
    }

    // ─── ADJUSTMENT ─────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordAdjustmentMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                             String unit, String batchNo, String reason, String createdBy,
                                                             String notes, UUID tenantId, UUID companyId) {
        if (quantity == null) {
			throw new InventoryException("ADJUSTMENT quantity must not be null");
		}

        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        // ── update inventory ────────────────────────────────────────────────────
        InventoryEntity inv = findInventory(material, warehouse, batchNo)
                .orElseGet(() -> findOrCreateInventory(material, warehouse, batchNo, tenantId, companyId));

        BigDecimal current = inv.getQuantityOnHand() == null ? BigDecimal.ZERO : inv.getQuantityOnHand();
        BigDecimal newOnHand = current.add(quantity);   // quantity may be negative (downward adjustment)
        if (newOnHand.compareTo(BigDecimal.ZERO) < 0) {
			throw new InventoryException("Adjustment would result in negative on-hand quantity (" + newOnHand.toPlainString() + ")");
		}

        inv.setQuantityOnHand(newOnHand);
        InventoryEntity savedInv = inventoryRepository.save(inv);

        return buildAndSaveAdjustmentMovement(material, warehouse, quantity, unit, batchNo, reason, createdBy, notes, tenantId, companyId, savedInv.getId());
    }

    /**
     * Record an ADJUSTMENT movement log entry only — does NOT touch inventory quantity.
     * Use this when the caller has already set quantityOnHand directly (e.g. InventoryService.updateStock).
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordAdjustmentMovementLogOnly(UUID inventoryId, UUID materialId, UUID warehouseId,
                                                                    BigDecimal quantity, String unit, String batchNo,
                                                                    String reason, String createdBy, String notes,
                                                                    UUID tenantId, UUID companyId) {
        if (quantity == null) {
			throw new InventoryException("ADJUSTMENT quantity must not be null");
		}

        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        return buildAndSaveAdjustmentMovement(material, warehouse, quantity, unit, batchNo, reason, createdBy, notes, tenantId, companyId, inventoryId);
    }

    /** Shared movement-record builder used by both adjustment variants. */
    private InventoryMovementEntity buildAndSaveAdjustmentMovement(Material material, WarehouseEntity warehouse,
                                                                     BigDecimal quantity, String unit, String batchNo,
                                                                     String reason, String createdBy, String notes,
                                                                     UUID tenantId, UUID companyId, UUID inventoryId) {
        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        // Positive adjustment → to_warehouse; negative → from_warehouse
        if (quantity.compareTo(BigDecimal.ZERO) >= 0) {
            movement.setToWarehouse(warehouse);
        } else {
            movement.setFromWarehouse(warehouse);
        }
        // Store the signed quantity — negative means stock decrease, positive means increase
        movement.setQuantity(quantity);
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(MOVEMENT_ADJUSTMENT);
        movement.setReason(reason);
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(resolveCreatedBy(createdBy));
        movement.setNotes(notes);
        movement.setInventoryId(inventoryId);
        movement.setStatus("COMPLETED");
        return movementRepository.save(movement);
    }

    // ─── IMPORT ─────────────────────────────────────────────────────────────────

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordImportMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                         String unit, String batchNo, String createdBy,
                                                         UUID inventoryId, UUID tenantId, UUID companyId) {
        return recordImportMovement(materialId, warehouseId, quantity, unit, batchNo, createdBy,
                inventoryId, null, tenantId, companyId);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordImportMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                         String unit, String batchNo, String createdBy,
                                                         UUID inventoryId, UUID invoiceId,
                                                         UUID tenantId, UUID companyId) {
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        // ── inventory row is already created/updated by InventoryImportService;
        //    just stamp the inventoryId on the movement ──────────────────────────
        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        movement.setToWarehouse(warehouse);
        movement.setQuantity(quantity);
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(MOVEMENT_IMPORT);
        movement.setReason("CSV Import");
        movement.setReferenceType(invoiceId != null ? "INVOICE" : "INVENTORY");
        movement.setReferenceId(invoiceId != null ? invoiceId : inventoryId);
        movement.setInventoryId(inventoryId);
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(resolveCreatedBy(createdBy));
        movement.setStatus("COMPLETED");
        return movementRepository.save(movement);
    }

    // ─── misc ────────────────────────────────────────────────────────────────────

    public InventoryMovementEntity getById(UUID id) {
        return movementRepository.findById(id).orElse(null);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id) {
        movementRepository.deleteById(id);
    }
}
