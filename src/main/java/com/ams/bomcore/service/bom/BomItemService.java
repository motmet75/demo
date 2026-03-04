package com.ams.bomcore.service.bom;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.repository.BomItemRepository;
import com.ams.bomcore.repository.BomRepository;
import com.ams.bomcore.repository.MaterialRepository;

/**
 * Service for managing BOM items CRUD operations.
 */
@Service
public class BomItemService {

    private final BomItemRepository bomItemRepository;
    private final BomRepository bomRepository;
    private final MaterialRepository materialRepository;

    public BomItemService(BomItemRepository bomItemRepository, BomRepository bomRepository, MaterialRepository materialRepository) {
        this.bomItemRepository = bomItemRepository;
        this.bomRepository = bomRepository;
        this.materialRepository = materialRepository;
    }

    /**
     * List all BOM items for a BOM.
     */
    public List<BomItemEntity> listByBomId(UUID bomId) {
        return bomItemRepository.findByBomId(bomId);
    }

    /**
     * List all BOM items for a BOM with tenant/company scope.
     */
    public List<BomItemEntity> listByBomIdAndTenantAndCompany(UUID bomId, UUID tenantId, UUID companyId) {
        return bomItemRepository.findByBomIdAndTenantIdAndCompanyId(bomId, tenantId, companyId);
    }

    /**
     * Get a BOM item by ID.
     */
    public Optional<BomItemEntity> getById(UUID id) {
        return bomItemRepository.findById(id);
    }

    /**
     * Create a new BOM item.
     */
    @Transactional(rollbackFor = Exception.class)
    public BomItemEntity create(UUID bomId, UUID materialId, BigDecimal quantity, Integer level,
                                 UUID parentItemId, UUID tenantId, UUID companyId) {
        BomEntity bom = bomRepository.findById(bomId)
                .orElseThrow(() -> new IllegalArgumentException("BOM not found: " + bomId));
        
        Material material = materialRepository.findById(materialId)
                .orElseThrow(() -> new IllegalArgumentException("Material not found: " + materialId));

        BomItemEntity parentItem = null;
        if (parentItemId != null) {
            parentItem = bomItemRepository.findById(parentItemId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent BOM item not found: " + parentItemId));
        }

        BomItemEntity item = new BomItemEntity();
        item.setBom(bom);
        item.setMaterial(material);
        item.setQuantity(quantity);
        item.setLevel(level != null ? level : 1);
        item.setParentItem(parentItem);
        item.setTenantId(tenantId);
        item.setCompanyId(companyId);

        return bomItemRepository.save(item);
    }

    /**
     * Update a BOM item.
     */
    @Transactional(rollbackFor = Exception.class)
    public BomItemEntity update(UUID id, UUID materialId, BigDecimal quantity, Integer level,
                                 UUID parentItemId, UUID tenantId, UUID companyId) {
        BomItemEntity item = bomItemRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("BOM item not found: " + id));

        if (materialId != null) {
            Material material = materialRepository.findById(materialId)
                    .orElseThrow(() -> new IllegalArgumentException("Material not found: " + materialId));
            item.setMaterial(material);
        }

        if (quantity != null) {
            item.setQuantity(quantity);
        }

        if (level != null) {
            item.setLevel(level);
        }

        if (parentItemId != null) {
            BomItemEntity parentItem = bomItemRepository.findById(parentItemId)
                    .orElseThrow(() -> new IllegalArgumentException("Parent BOM item not found: " + parentItemId));
            item.setParentItem(parentItem);
        }

        item.setTenantId(tenantId);
        item.setCompanyId(companyId);

        return bomItemRepository.save(item);
    }

    /**
     * Delete a BOM item.
     */
    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id) {
        bomItemRepository.deleteById(id);
    }

    /**
     * Delete all BOM items for a BOM.
     */
    @Transactional(rollbackFor = Exception.class)
    public void deleteAllByBomId(UUID bomId) {
        BomEntity bom = bomRepository.findById(bomId).orElse(null);
        if (bom != null) {
            bomItemRepository.deleteByBom(bom);
        }
    }
}
