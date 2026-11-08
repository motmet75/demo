package com.ams.bomcore.service.material;

import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.MaterialRepository;

/**
 * Service for Material CRUD. Material operations are scoped to a Company.
 */
@Service
public class MaterialService {

    private final MaterialRepository materialRepository;

    public MaterialService(MaterialRepository materialRepository) {
        this.materialRepository = materialRepository;
    }

    /**
     * Generate a candidate code that does not collide (even ignoring case) with
     * existing material codes in this tenant/company or other draft lines.
     * Unique(tenant_id, company_id, material_code) at the DB remains the final
     * guard against concurrent requests.
     */
    public String generateAvailableMaterialCode(UUID tenantId, UUID companyId,
                                                Collection<String> reservedCodes) {
        for (int attempt = 0; attempt < 30; attempt++) {
            String code = "MAT-" + UUID.randomUUID().toString()
                    .replace("-", "").substring(0, 20).toUpperCase(Locale.ROOT);
            boolean reserved = reservedCodes != null && reservedCodes.stream()
                    .anyMatch(value -> value != null && code.equalsIgnoreCase(value.trim()));
            if (!reserved && !materialRepository.existsByMaterialCodeIgnoreCaseAndTenantIdAndCompanyId(
                    code, tenantId, companyId)) {
                return code;
            }
        }
        throw new IllegalStateException("Không thể tạo mã vật tư mới không trùng.");
    }

    public Material createForCompany(Material material, Company company, Tenant tenant) {
        if (material == null || company == null || tenant == null) {
            throw new IllegalArgumentException("Missing material, tenant or company");
        }
        material.setCompany(company);
        material.setTenant(tenant);
        String code = material.getMaterialCode() == null ? "" : material.getMaterialCode().trim();
        if (code.isEmpty()) {
            code = generateAvailableMaterialCode(tenant.getId(), company.getId(), List.of());
        } else if (materialRepository.existsByMaterialCodeIgnoreCaseAndTenantIdAndCompanyId(
                code, tenant.getId(), company.getId())) {
            throw new IllegalArgumentException("Mã vật tư " + code + " đã tồn tại trong công ty.");
        }
        material.setMaterialCode(code);
        // Force unique-constraint failures to occur before the caller writes
        // inventory movements that reference this new material.
        return materialRepository.saveAndFlush(material);
    }

    /**
     * Update an existing material ensuring it is scoped to the provided company and tenant.
     */
    public Material updateForCompany(UUID id, Material material, Company company, Tenant tenant) {
        Material existing = materialRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("material not found"));

        if (existing.getTenant() == null || !existing.getTenant().getId().equals(tenant.getId())) {
            throw new IllegalArgumentException("material does not belong to tenant");
        }
        if (existing.getCompany() == null || !existing.getCompany().getId().equals(company.getId())) {
            throw new IllegalArgumentException("material does not belong to company");
        }

        existing.setMaterialCode(material.getMaterialCode());
        existing.setMaterialName(material.getMaterialName());
        existing.setUnit(material.getUnit());
        existing.setMaterialType(material.getMaterialType());
        existing.setThumbnailUrl(material.getThumbnailUrl());
        existing.setPrice(material.getPrice());
        existing.setManualShiftConsumption(material.getManualShiftConsumption());
        existing.setInventoryAlertEnabled(material.getInventoryAlertEnabled() != null ? material.getInventoryAlertEnabled() : Boolean.TRUE);
        existing.setInventoryAlertQuantity(material.getInventoryAlertQuantity());
        existing.setInventoryAlertPercentage(material.getInventoryAlertPercentage());
        existing.setDescription(material.getDescription());
        if (material.getIsActive() != null) {
            existing.setIsActive(material.getIsActive());
        }

        return materialRepository.save(existing);
    }

    public List<Material> findAllByCompany(Company company) {
        return materialRepository.findAllByCompany(company);
    }

    public void delete(UUID id) {
        materialRepository.deleteById(id);
    }
}