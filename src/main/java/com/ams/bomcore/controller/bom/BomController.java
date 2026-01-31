package com.ams.bomcore.controller.bom;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.repository.BomRepository;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
@RequestMapping("/bom/api/boms")
public class BomController {

    private final BomRepository bomRepository;

    public BomController(BomRepository bomRepository) {
        this.bomRepository = bomRepository;
    }

    @GetMapping
    public List<BomDto> list(@RequestParam(value = "tenantId", required = false) String tenantId,
                             @RequestParam(value = "companyId", required = false) String companyId,
                             @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenant,
                             @RequestHeader(value = "X-Company-Id", required = false) String headerCompany) {
        // prefer headers
        if (headerTenant != null && !headerTenant.isBlank()) tenantId = headerTenant;
        if (headerCompany != null && !headerCompany.isBlank()) companyId = headerCompany;

        if (tenantId == null || companyId == null) throw new IllegalArgumentException("tenantId and companyId are required");

        UUID tenantUuid;
        UUID companyUuid;
        try {
            tenantUuid = UUID.fromString(tenantId);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid tenantId UUID: " + tenantId);
        }
        try {
            companyUuid = UUID.fromString(companyId);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid companyId UUID: " + companyId);
        }

        List<BomEntity> list = bomRepository.findAllByTenantIdAndCompanyId(tenantUuid, companyUuid);
        return list.stream().map(b -> new BomDto(b.getId(), b.getModel() != null ? b.getModel().getId() : null, b.getModel() != null ? b.getModel().getModelName() : null, b.getVersion(), b.getStatus())).collect(Collectors.toList());
    }

    public static class BomDto {
        public final UUID id;
        public final UUID modelId;
        public final String modelName;
        public final Integer version;
        public final String status;

        public BomDto(UUID id, UUID modelId, String modelName, Integer version, String status) {
            this.id = id; this.modelId = modelId; this.modelName = modelName; this.version = version; this.status = status;
        }
    }
}