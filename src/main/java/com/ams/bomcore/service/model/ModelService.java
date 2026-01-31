package com.ams.bomcore.service.model;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.repository.ModelBomRepository;
import com.ams.bomcore.repository.ModelRepository;

/**
 * Simple single-responsibility service for Model CRUD. Now deletes related ModelBom rows when deleting a Model.
 * Added tenant-scoped create/find/update helpers.
 */
@Service
public class ModelService {

    private final ModelRepository modelRepository;
    private final ModelBomRepository modelBomRepository;

    public ModelService(ModelRepository modelRepository, ModelBomRepository modelBomRepository) {
        this.modelRepository = modelRepository;
        this.modelBomRepository = modelBomRepository;
    }

    public Model create(Model model) {
        return modelRepository.save(model);
    }

    public List<Model> findAll() {
        return modelRepository.findAll();
    }

    // New: create model scoped to a tenant
    public Model createForTenant(Model model, UUID tenantId) {
        model.setTenantId(tenantId);
        return modelRepository.save(model);
    }

    // New: find by tenant
    public List<Model> findAllByTenantId(UUID tenantId) {
        return modelRepository.findAllByTenantId(tenantId);
    }

    // New: update model scoped to tenant - ensures tenantId is set
    public Model updateForTenant(Model model, UUID tenantId) {
        model.setTenantId(tenantId);
        return modelRepository.save(model);
    }

    // New: create model scoped to tenant+company
    public Model createForTenantAndCompany(Model model, UUID tenantId, UUID companyId) {
        model.setTenantId(tenantId);
        model.setCompanyId(companyId);
        return modelRepository.save(model);
    }

    // New: find all by tenant and company
    public List<Model> findAllByTenantAndCompany(UUID tenantId, UUID companyId) {
        return modelRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);
    }

    // New: update model scoped to tenant+company
    public Model updateForTenantAndCompany(Model model, UUID tenantId, UUID companyId) {
        model.setTenantId(tenantId);
        model.setCompanyId(companyId);
        return modelRepository.save(model);
    }

    @Transactional(rollbackFor = Exception.class)
    public void delete(UUID id) {
        // find model by id and delete its BOM entries first to avoid orphan rows
        modelRepository.findById(id).ifPresent(m -> {
            try {
                modelBomRepository.deleteAllByModel(m);
            } catch (Exception ex) {
                // if delete fails, let transaction rollback and surface error
                throw ex;
            }
            modelRepository.deleteById(id);
        });
    }
}