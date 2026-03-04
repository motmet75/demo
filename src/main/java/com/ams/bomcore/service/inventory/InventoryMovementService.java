package com.ams.bomcore.service.inventory;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
 * Records all IN, OUT, TRANSFER, ADJUSTMENT movements and updates inventory accordingly.
 */
@Service
public class InventoryMovementService {

    // Movement types
    public static final String MOVEMENT_IN = "IN";
    public static final String MOVEMENT_OUT = "OUT";
    public static final String MOVEMENT_TRANSFER = "TRANSFER";
    public static final String MOVEMENT_ADJUSTMENT = "ADJUSTMENT";
    public static final String MOVEMENT_IMPORT = "IMPORT";

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

    /**
     * List all movements for tenant and company.
     */
    public List<InventoryMovementEntity> listAll(UUID tenantId, UUID companyId) {
        return movementRepository.findAllByTenantAndCompanyOrderByCreatedAtDesc(tenantId, companyId);
    }

    /**
     * List movements by type.
     */
    public List<InventoryMovementEntity> listByType(UUID tenantId, UUID companyId, String movementType) {
        return movementRepository.findByTenantIdAndCompanyIdAndMovementType(tenantId, companyId, movementType);
    }

    /**
     * List movements by material.
     */
    public List<InventoryMovementEntity> listByMaterial(UUID tenantId, UUID companyId, UUID materialId) {
        return movementRepository.findByTenantIdAndCompanyIdAndMaterialId(tenantId, companyId, materialId);
    }

    /**
     * List movements by date range.
     */
    public List<InventoryMovementEntity> listByDateRange(UUID tenantId, UUID companyId, Instant fromDate, Instant toDate) {
        return movementRepository.findByTenantIdAndCompanyIdAndDateRange(tenantId, companyId, fromDate, toDate);
    }

    /**
     * Record an IN movement (receiving stock).
     */
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
        movement.setCreatedBy(createdBy);
        movement.setNotes(notes);
        movement.setStatus("COMPLETED");

        return movementRepository.save(movement);
    }

    /**
     * Record an OUT movement (issuing stock).
     */
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
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        movement.setFromWarehouse(warehouse);
        movement.setQuantity(quantity);
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(MOVEMENT_OUT);
        movement.setReason(reason);
        movement.setReferenceType(referenceType);
        movement.setReferenceId(referenceId);
        movement.setInventoryId(inventoryId);
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(createdBy);
        movement.setNotes(notes);
        movement.setStatus("COMPLETED");

        return movementRepository.save(movement);
    }

    /**
     * Record a TRANSFER movement between warehouses.
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordTransferMovement(UUID materialId, UUID fromWarehouseId, UUID toWarehouseId,
                                                           BigDecimal quantity, String unit, String batchNo,
                                                           String reason, String createdBy, String notes,
                                                           UUID tenantId, UUID companyId) {
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity fromWarehouse = warehouseRepository.findById(fromWarehouseId)
                .orElseThrow(() -> new InventoryException("From warehouse not found: " + fromWarehouseId));
        WarehouseEntity toWarehouse = warehouseRepository.findById(toWarehouseId)
                .orElseThrow(() -> new InventoryException("To warehouse not found: " + toWarehouseId));

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
        movement.setCreatedBy(createdBy);
        movement.setNotes(notes);
        movement.setStatus("COMPLETED");

        return movementRepository.save(movement);
    }

    /**
     * Record an ADJUSTMENT movement (inventory correction).
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordAdjustmentMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                             String unit, String batchNo, String reason, String createdBy,
                                                             String notes, UUID tenantId, UUID companyId) {
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new InventoryException("Material not found: " + materialId));
        WarehouseEntity warehouse = warehouseRepository.findById(warehouseId)
                .orElseThrow(() -> new InventoryException("Warehouse not found: " + warehouseId));

        InventoryMovementEntity movement = new InventoryMovementEntity();
        movement.setTenantId(tenantId);
        movement.setCompanyId(companyId);
        movement.setMaterial(material);
        // For adjustments, positive qty -> to_warehouse, negative qty -> from_warehouse
        if (quantity.compareTo(BigDecimal.ZERO) >= 0) {
            movement.setToWarehouse(warehouse);
        } else {
            movement.setFromWarehouse(warehouse);
            movement.setQuantity(quantity.abs());
        }
        movement.setQuantity(quantity.abs());
        movement.setUnit(unit != null ? unit : "pcs");
        movement.setMovementType(MOVEMENT_ADJUSTMENT);
        movement.setReason(reason);
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(createdBy);
        movement.setNotes(notes);
        movement.setStatus("COMPLETED");

        return movementRepository.save(movement);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordImportMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                         String unit, String batchNo, String createdBy,
                                                         UUID inventoryId, UUID tenantId, UUID companyId) {
        return recordImportMovement(materialId, warehouseId, quantity, unit, batchNo, createdBy,
                inventoryId, null, tenantId, companyId);
    }

    /**
     * Record an IMPORT movement (from CSV import or manual add with optional invoice).
     *
     * @param inventoryId  the inventory row UUID (stored in inventory_id column)
     * @param invoiceId    optional invoice UUID (stored in reference_id, referenceType = "INVOICE")
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryMovementEntity recordImportMovement(UUID materialId, UUID warehouseId, BigDecimal quantity,
                                                         String unit, String batchNo, String createdBy,
                                                         UUID inventoryId, UUID invoiceId,
                                                         UUID tenantId, UUID companyId) {
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
        movement.setMovementType(MOVEMENT_IMPORT);
        movement.setReason("CSV Import");
        movement.setReferenceType(invoiceId != null ? "INVOICE" : "INVENTORY");
        movement.setReferenceId(invoiceId != null ? invoiceId : inventoryId);
        movement.setInventoryId(inventoryId);
        movement.setBatchNo(batchNo);
        movement.setCreatedBy(createdBy);
        movement.setStatus("COMPLETED");

        return movementRepository.save(movement);
    }

    /**
     * Get movement by ID.
     */
    public InventoryMovementEntity getById(UUID id) {
        return movementRepository.findById(id).orElse(null);
    }

    /**
     * Delete movement by ID.
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id) {
        movementRepository.deleteById(id);
    }
}
