package com.ams.bomcore.service;

import java.util.UUID;

import org.springframework.stereotype.Service;

import com.ams.bomcore.repository.TenantRepository;

@Service
public class TenantValidationService {

    private final TenantRepository tenantRepository;

    public TenantValidationService(TenantRepository tenantRepository) {
        this.tenantRepository = tenantRepository;
    }

    public boolean existsAndActive(String tenantId) {
        if (tenantId == null) return false;
        try {
            UUID id = UUID.fromString(tenantId);
            var opt = tenantRepository.findById(id);
            return opt.isPresent() && Boolean.TRUE.equals(opt.get().getIsActive());
        } catch (IllegalArgumentException ex) {
            return false;
        }
    }

}
