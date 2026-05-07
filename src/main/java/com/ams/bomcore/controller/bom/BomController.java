package com.ams.bomcore.controller.bom;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.repository.BomRepository;

@RestController
@CrossOrigin(origins = "http://localhost:5173")
@RequestMapping("/bom/boms")
public class BomController {

    private final BomRepository bomRepository;

    public BomController(BomRepository bomRepository) {
        this.bomRepository = bomRepository;
    }

    /** List all BOMs for the current tenant+company */
    @GetMapping
    public List<BomDto> list(@RequestParam(value = "tenantId", required = false) String tenantId,
                             @RequestParam(value = "companyId", required = false) String companyId,
                             @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenant,
                             @RequestHeader(value = "X-Company-Id", required = false) String headerCompany) {
        if (headerTenant != null && !headerTenant.isBlank()) {
			tenantId = headerTenant;
		}
        if (headerCompany != null && !headerCompany.isBlank()) {
			companyId = headerCompany;
		}

        if (tenantId == null || companyId == null) {
			throw new IllegalArgumentException("tenantId and companyId are required");
		}

        UUID tenantUuid = UUID.fromString(tenantId);
        UUID companyUuid = UUID.fromString(companyId);

        List<BomEntity> list = bomRepository.findAllByTenantIdAndCompanyId(tenantUuid, companyUuid);
        return list.stream().map(BomDto::from).collect(Collectors.toList());
    }

    /** List all BOMs for a specific model within current tenant+company */
    @GetMapping("/by-model/{modelId}")
    public List<BomDto> byModel(@PathVariable("modelId") UUID modelId,
                                @RequestParam(value = "tenantId", required = false) String tenantId,
                                @RequestParam(value = "companyId", required = false) String companyId,
                                @RequestHeader(value = "X-Tenant-Id", required = false) String headerTenant,
                                @RequestHeader(value = "X-Company-Id", required = false) String headerCompany) {
        if (headerTenant != null && !headerTenant.isBlank()) {
			tenantId = headerTenant;
		}
        if (headerCompany != null && !headerCompany.isBlank()) {
			companyId = headerCompany;
		}

        if (tenantId == null || companyId == null) {
			throw new IllegalArgumentException("tenantId and companyId are required");
		}

        UUID tenantUuid = UUID.fromString(tenantId);
        UUID companyUuid = UUID.fromString(companyId);

        List<BomEntity> list = bomRepository.findAllByModelIdAndTenantIdAndCompanyId(modelId, tenantUuid, companyUuid);
        return list.stream().map(BomDto::from).collect(Collectors.toList());
    }

    public static class BomDto {
        public final UUID id;
        public final UUID modelId;
        public final String modelCode;
        public final String modelName;
        public final String bomName;
        public final Integer version;
        public final String status;

        public BomDto(UUID id, UUID modelId, String modelCode, String modelName, String bomName, Integer version, String status) {
            this.id = id;
            this.modelId = modelId;
            this.modelCode = modelCode;
            this.modelName = modelName;
            this.bomName = bomName;
            this.version = version;
            this.status = status;
        }

        public static BomDto from(BomEntity b) {
            String modelCode = b.getModel() != null ? b.getModel().getModelCode() : null;
            String modelName = b.getModel() != null ? b.getModel().getModelName() : null;
            UUID modelId     = b.getModel() != null ? b.getModel().getId() : null;
            return new BomDto(b.getId(), modelId, modelCode, modelName, b.getBomName(), b.getVersion(), b.getStatus());
        }
    }
}
