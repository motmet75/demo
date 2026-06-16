package com.ams.bomcore.service.shop;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.repository.ShopTableRepository;

@Service
public class ShopSetupService {

    private final ShopTableRepository shopTableRepository;

    public ShopSetupService(ShopTableRepository shopTableRepository) {
        this.shopTableRepository = shopTableRepository;
    }

    @Transactional
    public void setupMatchaShop(UUID tenantId, UUID companyId) {
        String[] tableNames = {"Bàn 1", "Bàn 2", "Bàn 3", "Bàn 4", "Quầy", "Mang về"};
        for (String name : tableNames) {
            ShopTable table = new ShopTable();
            table.setTenantId(tenantId);
            table.setCompanyId(companyId);
            table.setTableName(name);
            shopTableRepository.save(table);
        }
    }

    @Transactional
    public void setupQrShop(UUID tenantId, UUID companyId) {
        for (int i = 1; i <= 10; i++) {
            ShopTable table = new ShopTable();
            table.setTenantId(tenantId);
            table.setCompanyId(companyId);
            table.setTableName("QR-" + String.format("%02d", i));
            shopTableRepository.save(table);
        }
    }
}
