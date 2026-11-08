package com.ams.bomcore.service.material;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.MaterialRepository;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class MaterialServiceGenerationTest {
    private final MaterialRepository repository=mock(MaterialRepository.class);
    private final MaterialService service=new MaterialService(repository);
    private final UUID tenantId=UUID.randomUUID(),companyId=UUID.randomUUID();

    @Test void generatesUniqueCodeWithinCompanyScope(){
        when(repository.existsByMaterialCodeIgnoreCaseAndTenantIdAndCompanyId(
                anyString(),eq(tenantId),eq(companyId))).thenReturn(false);
        String code=service.generateAvailableMaterialCode(
                tenantId,companyId,List.of("MAT-AAAAAAAAAAAAAAAAAAAA"));
        assertTrue(code.matches("MAT-[A-F0-9]{20}"));
        assertNotEquals("MAT-AAAAAAAAAAAAAAAAAAAA",code);
        verify(repository).existsByMaterialCodeIgnoreCaseAndTenantIdAndCompanyId(
                eq(code),eq(tenantId),eq(companyId));
    }

    @Test void refusesManualCodeAlreadyUsedIgnoringCase(){
        var company=mock(Company.class);
        var tenant=mock(Tenant.class);
        when(company.getId()).thenReturn(companyId);
        when(tenant.getId()).thenReturn(tenantId);
        when(repository.existsByMaterialCodeIgnoreCaseAndTenantIdAndCompanyId(
                eq("mat-existing"),eq(tenantId),eq(companyId))).thenReturn(true);
        var material=new Material();
        material.setMaterialCode("mat-existing");
        material.setMaterialName("Máy thủy theo hóa đơn");
        material.setUnit("cái");
        material.setMaterialType("MATERIAL");

        assertThrows(IllegalArgumentException.class,
                ()->service.createForCompany(material,company,tenant));
        verify(repository,never()).saveAndFlush(any(Material.class));
    }

    @Test void newMaterialIsFlushedBeforeInventoryCanReferenceIt(){
        var company=mock(Company.class);
        var tenant=mock(Tenant.class);
        when(company.getId()).thenReturn(companyId);
        when(tenant.getId()).thenReturn(tenantId);
        var material=new Material();
        material.setMaterialCode("");
        material.setMaterialName("Tên hàng theo hóa đơn PDF");
        material.setUnit("cái");
        material.setMaterialType("MATERIAL");
        when(repository.saveAndFlush(any(Material.class))).thenAnswer(invocation->invocation.getArgument(0));

        Material created=service.createForCompany(material,company,tenant);
        assertTrue(created.getMaterialCode().matches("MAT-[A-F0-9]{20}"));
        verify(repository).saveAndFlush(same(material));
    }
}
