package com.ams.bomcore.service.inventory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.controller.inventory.dto.InventoryViewDTO;
import com.ams.bomcore.domain.inventory.InventoryEntity;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.modelbom.ModelBom;
import com.ams.bomcore.repository.InventoryRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.ModelBomRepository;
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
    private final ModelBomRepository modelBomRepository;
    private final InventoryMovementService movementService;

    public InventoryService(InventoryRepository inventoryRepository,
                            MaterialRepository materialRepository,
                            WarehouseRepository warehouseRepository,
                            ModelBomRepository modelBomRepository,
                            InventoryMovementService movementService) {
        this.inventoryRepository = inventoryRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
        this.modelBomRepository = modelBomRepository;
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
        return inventoryRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);
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
        return addStock(materialCode, warehouseCode, qty, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, null, null, null, tenantId, companyId, reason, createdBy, notes, invoiceId);
    }

    /**
     * Full addStock overload that also persists {@code orderToDeduction}
     * and {@code materialQuotaPercentage} on the inventory row.
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStock(String materialCode, String warehouseCode, BigDecimal qty, String batchNo,
                                     Instant expirationDateTime, Instant productionDateTime, BigDecimal quantityReserved,
                                     BigDecimal quantityLocked, String orderToDeduction, BigDecimal materialQuotaPercentage,
                                     UUID tenantId, UUID companyId, String reason, String createdBy, String notes,
                                     UUID invoiceId) {
        return addStock(materialCode, warehouseCode, qty, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, quantityLocked, orderToDeduction, materialQuotaPercentage,
                tenantId, companyId, reason, createdBy, notes, invoiceId,
                null, null, null, null, null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStock(String materialCode, String warehouseCode, BigDecimal qty, String batchNo,
                                     Instant expirationDateTime, Instant productionDateTime, BigDecimal quantityReserved,
                                     BigDecimal quantityLocked, String orderToDeduction, BigDecimal materialQuotaPercentage,
                                     UUID tenantId, UUID companyId, String reason, String createdBy, String notes,
                                     UUID invoiceId, BigDecimal unitPrice, String currency, String warehouseImportUnit,
                                     BigDecimal warehouseImportQuantity, BigDecimal bomUnitPerWarehouseUnit,
                                     BigDecimal warehouseImportUnitPrice) {
        if (batchNo == null || batchNo.trim().isEmpty()) {
			throw new InventoryException("batchNo is required");
		}

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

        ReceiptConversion receipt = resolveReceiptConversion(m, qty, unitPrice, warehouseImportUnit,
                warehouseImportQuantity, bomUnitPerWarehouseUnit, warehouseImportUnitPrice, tenantId, companyId);
        qty = receipt.quantityOnHand;
        unitPrice = receipt.unitPrice;
        warehouseImportUnit = receipt.warehouseImportUnit;
        bomUnitPerWarehouseUnit = receipt.bomUnitPerWarehouseUnit;

        Optional<InventoryEntity> existing = inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNo(m, warehouseCode, batchNo);
        InventoryEntity inv;
        if (existing.isPresent()) {
            inv = existing.get();
            inv.setUnit(unitFor(m));
            inv.setQuantityOnHand(inv.getQuantityOnHand().add(qty));
            // quantityTotal is NOT changed by movements - only set at import/initial creation
            if (quantityReserved != null) {
                if (quantityReserved.compareTo(inv.getQuantityOnHand()) > 0) {
					throw new InventoryException("Reserved quantity cannot exceed on-hand quantity");
				}
                inv.setQuantityReserved(quantityReserved);
            }
            if (quantityLocked != null) {
                if (quantityLocked.compareTo(inv.getQuantityOnHand()) > 0) {
					throw new InventoryException("Locked quantity cannot exceed on-hand quantity");
				}
                inv.setQuantityLocked(quantityLocked);
            }
        } else {
            inv = new InventoryEntity();
            inv.setMaterial(m);
            inv.setWarehouse(w);
            inv.setUnit(unitFor(m));
            inv.setBatchNo(batchNo);
            inv.setQuantityOnHand(qty);
            // quantityTotal is set by InventoryEntity.prePersist from initial on-hand quantity.
            inv.setQuantityReserved(quantityReserved == null ? BigDecimal.ZERO : quantityReserved);
            inv.setQuantityLocked(quantityLocked == null ? BigDecimal.ZERO : quantityLocked);
            if (inv.getQuantityReserved().compareTo(inv.getQuantityOnHand()) > 0) {
				throw new InventoryException("Reserved quantity cannot exceed on-hand quantity");
			}
            if (inv.getQuantityLocked().compareTo(inv.getQuantityOnHand()) > 0) {
				throw new InventoryException("Locked quantity cannot exceed on-hand quantity");
			}
            inv.setExpirationDateTime(expirationDateTime);
            inv.setProductionDateTime(productionDateTime);
            inv.setTenantId(tenantId);
            inv.setCompanyId(companyId);
        }

        if (inv.getQuantityOnHand().compareTo(BigDecimal.ZERO) < 0) {
            throw new InventoryException("Resulting quantity would be negative");
        }

        // Apply optional fields - set on both new and existing rows when provided
        if (orderToDeduction != null) {
            inv.setOrderToDeduction(orderToDeduction.isBlank() ? null : orderToDeduction.trim());
        }
        if (materialQuotaPercentage != null) {
            inv.setMaterialQuotaPercentage(materialQuotaPercentage);
        }

        applyReceiptFields(inv, unitPrice, currency, warehouseImportUnit, warehouseImportQuantity,
                bomUnitPerWarehouseUnit, warehouseImportUnitPrice);

        InventoryEntity saved = inventoryRepository.save(inv);

        // Record IN movement log only; on-hand was already applied above.
        movementService.recordInMovementLogOnly(
                saved.getId(), m.getId(), w.getId(), qty,
                unitFor(m),
                batchNo,
                reason != null ? reason : "Manual add stock",
                createdBy != null ? createdBy : "system",
                invoiceId != null ? "INVOICE" : "INVENTORY",
                invoiceId != null ? invoiceId : saved.getId(),
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
        return addStockByIds(materialId, warehouseId, qty, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, null, null, null, tenantId, companyId, reason, createdBy, notes, invoiceId);
    }

    /**
     * Full addStockByIds overload that also persists {@code orderToDeduction}
     * and {@code materialQuotaPercentage} on the inventory row.
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStockByIds(UUID materialId, UUID warehouseId, BigDecimal qty, String batchNo,
                                          Instant expirationDateTime, Instant productionDateTime,
                                          BigDecimal quantityReserved, BigDecimal quantityLocked,
                                          String orderToDeduction, BigDecimal materialQuotaPercentage,
                                          UUID tenantId, UUID companyId,
                                          String reason, String createdBy, String notes, UUID invoiceId) {
        return addStockByIds(materialId, warehouseId, qty, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, quantityLocked, orderToDeduction, materialQuotaPercentage,
                tenantId, companyId, reason, createdBy, notes, invoiceId,
                null, null, null, null, null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity addStockByIds(UUID materialId, UUID warehouseId, BigDecimal qty, String batchNo,
                                          Instant expirationDateTime, Instant productionDateTime,
                                          BigDecimal quantityReserved, BigDecimal quantityLocked,
                                          String orderToDeduction, BigDecimal materialQuotaPercentage,
                                          UUID tenantId, UUID companyId,
                                          String reason, String createdBy, String notes, UUID invoiceId,
                                          BigDecimal unitPrice, String currency, String warehouseImportUnit,
                                          BigDecimal warehouseImportQuantity, BigDecimal bomUnitPerWarehouseUnit,
                                          BigDecimal warehouseImportUnitPrice) {
        if (batchNo == null || batchNo.trim().isEmpty()) {
			throw new InventoryException("batchNo is required");
		}

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

        ReceiptConversion receipt = resolveReceiptConversion(m, qty, unitPrice, warehouseImportUnit,
                warehouseImportQuantity, bomUnitPerWarehouseUnit, warehouseImportUnitPrice, tenantId, companyId);
        qty = receipt.quantityOnHand;
        unitPrice = receipt.unitPrice;
        warehouseImportUnit = receipt.warehouseImportUnit;
        bomUnitPerWarehouseUnit = receipt.bomUnitPerWarehouseUnit;

        Optional<InventoryEntity> existing = inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNo(m, w.getCode(), batchNo);
        InventoryEntity inv;
        if (existing.isPresent()) {
            inv = existing.get();
            inv.setUnit(unitFor(m));
            inv.setQuantityOnHand(inv.getQuantityOnHand().add(qty));
            // quantityTotal is NOT changed by movements - only set at import/initial creation
            if (quantityReserved != null) {
                if (quantityReserved.compareTo(inv.getQuantityOnHand()) > 0) {
					throw new InventoryException("Reserved quantity cannot exceed on-hand quantity");
				}
                inv.setQuantityReserved(quantityReserved);
            }
            if (quantityLocked != null) {
                if (quantityLocked.compareTo(inv.getQuantityOnHand()) > 0) {
					throw new InventoryException("Locked quantity cannot exceed on-hand quantity");
				}
                inv.setQuantityLocked(quantityLocked);
            }
        } else {
            inv = new InventoryEntity();
            inv.setMaterial(m);
            inv.setWarehouse(w);
            inv.setUnit(unitFor(m));
            inv.setBatchNo(batchNo);
            inv.setQuantityOnHand(qty);
            // quantityTotal is set by InventoryEntity.prePersist from initial on-hand quantity.
            inv.setQuantityReserved(quantityReserved == null ? BigDecimal.ZERO : quantityReserved);
            inv.setQuantityLocked(quantityLocked == null ? BigDecimal.ZERO : quantityLocked);
            if (inv.getQuantityReserved().compareTo(inv.getQuantityOnHand()) > 0) {
				throw new InventoryException("Reserved quantity cannot exceed on-hand quantity");
			}
            if (inv.getQuantityLocked().compareTo(inv.getQuantityOnHand()) > 0) {
				throw new InventoryException("Locked quantity cannot exceed on-hand quantity");
			}
            inv.setExpirationDateTime(expirationDateTime);
            inv.setProductionDateTime(productionDateTime);
            inv.setTenantId(tenantId);
            inv.setCompanyId(companyId);
        }

        if (inv.getQuantityOnHand().compareTo(BigDecimal.ZERO) < 0) {
            throw new InventoryException("Resulting quantity would be negative");
        }

        // Apply optional fields - set on both new and existing rows when provided
        if (orderToDeduction != null) {
            inv.setOrderToDeduction(orderToDeduction.isBlank() ? null : orderToDeduction.trim());
        }
        if (materialQuotaPercentage != null) {
            inv.setMaterialQuotaPercentage(materialQuotaPercentage);
        }

        applyReceiptFields(inv, unitPrice, currency, warehouseImportUnit, warehouseImportQuantity,
                bomUnitPerWarehouseUnit, warehouseImportUnitPrice);

        InventoryEntity savedById = inventoryRepository.save(inv);

        // Record IN movement log only; on-hand was already applied above.
        movementService.recordInMovementLogOnly(
                savedById.getId(), m.getId(), w.getId(), qty,
                unitFor(m),
                batchNo,
                reason != null ? reason : "Manual add stock",
                createdBy != null ? createdBy : "system",
                invoiceId != null ? "INVOICE" : "INVENTORY",
                invoiceId != null ? invoiceId : savedById.getId(),
                notes,
                tenantId, companyId);

        return savedById;
    }

    private ReceiptConversion resolveReceiptConversion(Material material, BigDecimal qty, BigDecimal unitPrice,
                                                       String warehouseImportUnit, BigDecimal warehouseImportQuantity,
                                                       BigDecimal bomUnitPerWarehouseUnit, BigDecimal warehouseImportUnitPrice,
                                                       UUID tenantId, UUID companyId) {
        boolean hasWarehouseReceipt = (warehouseImportUnit != null && !warehouseImportUnit.isBlank())
                || warehouseImportQuantity != null
                || bomUnitPerWarehouseUnit != null
                || warehouseImportUnitPrice != null;

        if (!hasWarehouseReceipt) {
            if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new InventoryException("Quantity to add must be positive");
            }
            return new ReceiptConversion(qty, unitPrice, warehouseImportUnit, bomUnitPerWarehouseUnit);
        }

        if (warehouseImportQuantity == null || warehouseImportQuantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InventoryException("warehouseImportQuantity must be positive");
        }

        ConversionDefaults defaults = resolveModelBomConversion(material, tenantId, companyId);
        if (bomUnitPerWarehouseUnit == null && defaults != null) {
            bomUnitPerWarehouseUnit = defaults.bomUnitPerWarehouseUnit;
        }
        if ((warehouseImportUnit == null || warehouseImportUnit.isBlank()) && defaults != null) {
            warehouseImportUnit = defaults.warehouseUnit;
        }

        if (bomUnitPerWarehouseUnit == null || bomUnitPerWarehouseUnit.compareTo(BigDecimal.ZERO) <= 0) {
            throw new InventoryException("bomUnitPerWarehouseUnit must be positive; provide it or define one unique model BOM conversion for material " + material.getMaterialCode());
        }
        if (warehouseImportUnitPrice != null && warehouseImportUnitPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new InventoryException("warehouseImportUnitPrice cannot be negative");
        }

        BigDecimal convertedQty = warehouseImportQuantity.multiply(bomUnitPerWarehouseUnit);
        BigDecimal convertedUnitPrice = unitPrice;
        if (warehouseImportUnitPrice != null) {
            convertedUnitPrice = warehouseImportUnitPrice.divide(bomUnitPerWarehouseUnit, 10, RoundingMode.HALF_UP);
        }
        return new ReceiptConversion(convertedQty, convertedUnitPrice, warehouseImportUnit, bomUnitPerWarehouseUnit);
    }

    private ConversionDefaults resolveModelBomConversion(Material material, UUID tenantId, UUID companyId) {
        if (material == null || tenantId == null || companyId == null) {
            return null;
        }
        List<ModelBom> candidates = modelBomRepository.findAllByMaterialAndTenantIdAndCompanyId(material, tenantId, companyId)
                .stream()
                .filter(mb -> mb.getBomUnitPerWarehouseUnit() != null && mb.getBomUnitPerWarehouseUnit().compareTo(BigDecimal.ZERO) > 0)
                .toList();
        if (candidates.isEmpty()) {
            return null;
        }

        BigDecimal ratio = candidates.get(0).getBomUnitPerWarehouseUnit();
        String warehouseUnit = candidates.get(0).getWarehouseUnit();
        for (ModelBom candidate : candidates) {
            if (candidate.getBomUnitPerWarehouseUnit().compareTo(ratio) != 0) {
                return null;
            }
            String candidateUnit = candidate.getWarehouseUnit();
            if (warehouseUnit != null && candidateUnit != null && !warehouseUnit.equalsIgnoreCase(candidateUnit)) {
                warehouseUnit = null;
            } else if (warehouseUnit == null && candidateUnit != null) {
                warehouseUnit = candidateUnit;
            }
        }
        return new ConversionDefaults(ratio, warehouseUnit);
    }

    private static class ReceiptConversion {
        final BigDecimal quantityOnHand;
        final BigDecimal unitPrice;
        final String warehouseImportUnit;
        final BigDecimal bomUnitPerWarehouseUnit;

        ReceiptConversion(BigDecimal quantityOnHand, BigDecimal unitPrice, String warehouseImportUnit, BigDecimal bomUnitPerWarehouseUnit) {
            this.quantityOnHand = quantityOnHand;
            this.unitPrice = unitPrice;
            this.warehouseImportUnit = warehouseImportUnit;
            this.bomUnitPerWarehouseUnit = bomUnitPerWarehouseUnit;
        }
    }

    private static class ConversionDefaults {
        final BigDecimal bomUnitPerWarehouseUnit;
        final String warehouseUnit;

        ConversionDefaults(BigDecimal bomUnitPerWarehouseUnit, String warehouseUnit) {
            this.bomUnitPerWarehouseUnit = bomUnitPerWarehouseUnit;
            this.warehouseUnit = warehouseUnit;
        }
    }
    private void applyReceiptFields(InventoryEntity inv, BigDecimal unitPrice, String currency, String warehouseImportUnit,
                                    BigDecimal warehouseImportQuantity, BigDecimal bomUnitPerWarehouseUnit,
                                    BigDecimal warehouseImportUnitPrice) {
        if (unitPrice != null) {
            inv.setUnitPrice(unitPrice);
        }
        if (currency != null && !currency.isBlank()) {
            inv.setCurrency(currency.trim());
        }

        boolean hasWarehouseReceipt = (warehouseImportUnit != null && !warehouseImportUnit.isBlank())
                || warehouseImportQuantity != null
                || bomUnitPerWarehouseUnit != null
                || warehouseImportUnitPrice != null;
        if (hasWarehouseReceipt) {
            inv.setWarehouseImportUnit(warehouseImportUnit == null || warehouseImportUnit.isBlank() ? null : warehouseImportUnit.trim());
            inv.setWarehouseImportQuantity(warehouseImportQuantity);
            inv.setBomUnitPerWarehouseUnit(bomUnitPerWarehouseUnit);
            inv.setWarehouseImportUnitPrice(warehouseImportUnitPrice);
        }
    }
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(UUID inventoryId, BigDecimal newQuantityOnHand, String batchNo,
                                        Instant expirationDateTime, Instant productionDateTime,
                                        BigDecimal quantityReserved, UUID tenantId, UUID companyId) {
        return updateStock(inventoryId, newQuantityOnHand, null, batchNo, expirationDateTime, productionDateTime,
                quantityReserved, null, null, tenantId, companyId, "Manual update stock", "system", null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(UUID inventoryId, BigDecimal newQuantityOnHand, BigDecimal newQuantityTotal, String batchNo,
                                        Instant expirationDateTime, Instant productionDateTime,
                                        BigDecimal quantityReserved, UUID tenantId, UUID companyId,
                                        String reason, String createdBy, String notes) {
        return updateStock(inventoryId, newQuantityOnHand, newQuantityTotal, batchNo, expirationDateTime,
                productionDateTime, quantityReserved, null, null, tenantId, companyId, reason, createdBy, notes);
    }

    /**
     * Full update: also persists {@code orderToDeduction} and {@code materialQuotaPercentage}
     * when non-null values are provided.
     */
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(UUID inventoryId, BigDecimal newQuantityOnHand, BigDecimal newQuantityTotal, String batchNo,
                                        Instant expirationDateTime, Instant productionDateTime,
                                        BigDecimal quantityReserved,
                                        String orderToDeduction, BigDecimal materialQuotaPercentage,
                                        UUID tenantId, UUID companyId,
                                        String reason, String createdBy, String notes) {
        return updateStock(inventoryId, newQuantityOnHand, newQuantityTotal, batchNo,
                expirationDateTime, productionDateTime, quantityReserved,
                orderToDeduction, materialQuotaPercentage, tenantId, companyId,
                reason, createdBy, notes, null, null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(UUID inventoryId, BigDecimal newQuantityOnHand, BigDecimal newQuantityTotal, String batchNo,
                                        Instant expirationDateTime, Instant productionDateTime,
                                        BigDecimal quantityReserved,
                                        String orderToDeduction, BigDecimal materialQuotaPercentage,
                                        UUID tenantId, UUID companyId,
                                        String reason, String createdBy, String notes,
                                        BigDecimal unitPrice, String currency) {
        if (newQuantityOnHand == null || newQuantityOnHand.compareTo(BigDecimal.ZERO) < 0) {
			throw new InventoryException("Quantity must be non-negative");
		}

        InventoryEntity inv = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) {
			throw new InventoryException("inventory does not belong to tenant");
		}
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) {
			throw new InventoryException("inventory does not belong to company");
		}

        BigDecimal oldQty = inv.getQuantityOnHand() == null ? BigDecimal.ZERO : inv.getQuantityOnHand();
        BigDecimal delta  = newQuantityOnHand.subtract(oldQty);

        if (inv.getMaterial() != null) {
            inv.setUnit(unitFor(inv.getMaterial()));
        }
        inv.setQuantityOnHand(newQuantityOnHand);
        if (batchNo != null) {
			inv.setBatchNo(batchNo);
		}
        if (expirationDateTime != null) {
			inv.setExpirationDateTime(expirationDateTime);
		}
        if (productionDateTime != null) {
			inv.setProductionDateTime(productionDateTime);
		}
        // orderToDeduction: null means "do not change"; empty string means "clear it"
        if (orderToDeduction != null) {
            inv.setOrderToDeduction(orderToDeduction.isBlank() ? null : orderToDeduction.trim());
        }
        // materialQuotaPercentage: null means "do not change"
        if (materialQuotaPercentage != null) {
            inv.setMaterialQuotaPercentage(materialQuotaPercentage);
        }
        if (unitPrice != null) {
            inv.setUnitPrice(unitPrice);
        }
        if (currency != null && !currency.isBlank()) {
            inv.setCurrency(currency.trim());
        }
        // quantityReserved param is ignored on edit - reserved/locked managed by reserve/release only
        InventoryEntity updated = inventoryRepository.save(inv);

        if (delta.compareTo(BigDecimal.ZERO) != 0 && inv.getMaterial() != null && inv.getWarehouse() != null) {
            String sign = delta.compareTo(BigDecimal.ZERO) > 0 ? "+" : "";
            String auditNote = "Adjusted from " + oldQty.toPlainString()
                    + " to " + newQuantityOnHand.toPlainString()
                    + " (" + sign + delta.toPlainString() + ")";
            String combinedNotes = (notes != null && !notes.isBlank())
                    ? notes + " | " + auditNote
                    : auditNote;

            movementService.recordAdjustmentMovementLogOnly(
                    updated.getId(),
                    inv.getMaterial().getId(),
                    inv.getWarehouse().getId(),
                    delta,
                    unitFor(inv.getMaterial()),
                    inv.getBatchNo(),
                    reason != null ? reason : "Manual update stock",
                    createdBy != null ? createdBy : "system",
                    combinedNotes,
                    tenantId, companyId);
        }

        return updated;
    }

    private static String unitFor(Material material) {
        if (material != null && material.getUnit() != null && !material.getUnit().isBlank()) {
            return material.getUnit().trim();
        }
        return "pcs";
    }

    // Keep previous signature for backward compatibility by delegating (optional)
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity updateStock(String inventoryId, BigDecimal newQuantityOnHand) {
        return updateStock(UUID.fromString(inventoryId), newQuantityOnHand, null, null, null, null, null, null, null, null, null, "Manual update stock", "system", null);
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity reserveQuantity(String materialCode, String warehouseCode, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
			throw new InventoryException("Quantity to reserve must be positive");
		}

        Material m = materialRepository.findByMaterialCode(materialCode).orElseThrow(() -> new InventoryException("Material not found: " + materialCode));
        InventoryEntity inv = inventoryRepository.findByMaterialAndWarehouseCode(m, warehouseCode).orElseThrow(() -> new InventoryException("Inventory not found for material " + materialCode + " in warehouse " + warehouseCode));

        BigDecimal currentLocked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        BigDecimal available = inv.getQuantityOnHand().subtract(currentLocked);
        if (available.compareTo(qty) < 0) {
            throw new InventoryException("Insufficient available quantity to reserve");
        }
        // Targeted update - only quantity_locked and updated_at are written
        inventoryRepository.updateQuantityLocked(inv.getId(), currentLocked.add(qty), Instant.now());
        inv.setQuantityLocked(currentLocked.add(qty));
        return inv;
    }

    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity releaseQuantity(String materialCode, String warehouseCode, BigDecimal qty) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
			throw new InventoryException("Quantity to release must be positive");
		}

        Material m = materialRepository.findByMaterialCode(materialCode).orElseThrow(() -> new InventoryException("Material not found: " + materialCode));
        InventoryEntity inv = inventoryRepository.findByMaterialAndWarehouseCode(m, warehouseCode).orElseThrow(() -> new InventoryException("Inventory not found for material " + materialCode + " in warehouse " + warehouseCode));

        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        if (locked.compareTo(qty) < 0) {
			throw new InventoryException("Cannot release more than locked quantity");
		}
        // Targeted update - only quantity_locked and updated_at are written
        inventoryRepository.updateQuantityLocked(inv.getId(), locked.subtract(qty), Instant.now());
        inv.setQuantityLocked(locked.subtract(qty));
        return inv;
    }

    // Reserve by inventory id (for controller endpoint convenience)
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity reserveById(UUID inventoryId, BigDecimal qty, UUID tenantId, UUID companyId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
			throw new InventoryException("Quantity to reserve must be positive");
		}
        InventoryEntity inv = inventoryRepository.findById(inventoryId).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) {
			throw new InventoryException("inventory does not belong to tenant");
		}
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) {
			throw new InventoryException("inventory does not belong to company");
		}

        BigDecimal currentLocked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        BigDecimal available = inv.getQuantityOnHand().subtract(currentLocked);
        if (available.compareTo(qty) < 0) {
			throw new InventoryException("Insufficient available quantity to reserve");
		}
        // Targeted update - only quantity_locked and updated_at are written
        inventoryRepository.updateQuantityLocked(inv.getId(), currentLocked.add(qty), Instant.now());
        inv.setQuantityLocked(currentLocked.add(qty));
        return inv;
    }

    // Release by inventory id
    @Transactional(rollbackFor = Exception.class)
    public InventoryEntity releaseById(UUID inventoryId, BigDecimal qty, UUID tenantId, UUID companyId) {
        if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
			throw new InventoryException("Quantity to release must be positive");
		}
        InventoryEntity inv = inventoryRepository.findById(inventoryId).orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));

        if (inv.getTenantId() == null || !inv.getTenantId().equals(tenantId)) {
			throw new InventoryException("inventory does not belong to tenant");
		}
        if (inv.getCompanyId() == null || !inv.getCompanyId().equals(companyId)) {
			throw new InventoryException("inventory does not belong to company");
		}

        BigDecimal locked = inv.getQuantityLocked() == null ? BigDecimal.ZERO : inv.getQuantityLocked();
        if (locked.compareTo(qty) < 0) {
			throw new InventoryException("Cannot release more than locked quantity");
		}
        // Targeted update - only quantity_locked and updated_at are written
        inventoryRepository.updateQuantityLocked(inv.getId(), locked.subtract(qty), Instant.now());
        inv.setQuantityLocked(locked.subtract(qty));
        return inv;
    }

    /**
     * Delete an inventory record by id, validating tenant/company ownership.
     */
    @Transactional
    public void deleteById(UUID inventoryId, UUID tenantId, UUID companyId) {
        InventoryEntity inv = inventoryRepository.findById(inventoryId)
                .orElseThrow(() -> new InventoryException("Inventory not found: " + inventoryId));
        if (tenantId != null && !tenantId.equals(inv.getTenantId())) {
			throw new InventoryException("inventory does not belong to tenant");
		}
        if (companyId != null && !companyId.equals(inv.getCompanyId())) {
			throw new InventoryException("inventory does not belong to company");
		}
        inventoryRepository.deleteById(inventoryId);
    }
}


