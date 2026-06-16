package com.ams.bomcore.service.shop;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.shop.ModelMenuOption;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.repository.BomItemRepository;
import com.ams.bomcore.repository.BomRepository;
import com.ams.bomcore.repository.ModelMenuOptionRepository;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.repository.ShopOrderItemRepository;
import com.ams.bomcore.repository.ShopOrderRepository;
import com.ams.bomcore.repository.ShopTableRepository;

@Service
public class ShopSetupService {

    private final ShopTableRepository shopTableRepository;
    private final ModelRepository modelRepository;
    private final BomRepository bomRepository;
    private final BomItemRepository bomItemRepository;
    private final ModelMenuOptionRepository menuOptionRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final ShopOrderItemRepository shopOrderItemRepository;

    public ShopSetupService(ShopTableRepository shopTableRepository,
                            ModelRepository modelRepository,
                            BomRepository bomRepository,
                            BomItemRepository bomItemRepository,
                            ModelMenuOptionRepository menuOptionRepository,
                            ShopOrderRepository shopOrderRepository,
                            ShopOrderItemRepository shopOrderItemRepository) {
        this.shopTableRepository = shopTableRepository;
        this.modelRepository = modelRepository;
        this.bomRepository = bomRepository;
        this.bomItemRepository = bomItemRepository;
        this.menuOptionRepository = menuOptionRepository;
        this.shopOrderRepository = shopOrderRepository;
        this.shopOrderItemRepository = shopOrderItemRepository;
    }

    @Transactional
    public void resetShop(UUID tenantId, UUID companyId) {
        // 1. order items → orders
        List<ShopOrder> orders = shopOrderRepository.findAllByTenantIdAndCompanyIdOrderByCreatedAtDesc(tenantId, companyId);
        for (ShopOrder order : orders) {
            shopOrderItemRepository.deleteAll(shopOrderItemRepository.findAllByOrder_Id(order.getId()));
        }
        shopOrderRepository.deleteAll(orders);

        // 2. menu options
        menuOptionRepository.deleteAll(
            menuOptionRepository.findAllByTenantIdAndCompanyIdOrderByDisplayOrderAsc(tenantId, companyId));

        // 3. bom items → boms
        List<BomEntity> boms = bomRepository.findAllByTenantIdAndCompanyId(tenantId, companyId);
        for (BomEntity bom : boms) {
            bomItemRepository.deleteByBom(bom);
        }
        bomRepository.deleteAll(boms);

        // 4. models
        modelRepository.deleteAll(modelRepository.findAllByTenantIdAndCompanyId(tenantId, companyId));

        // 5. tables
        shopTableRepository.deleteAll(shopTableRepository.findAllByTenantIdAndCompanyId(tenantId, companyId));
    }

    @Transactional
    public void setupRiceShop(UUID tenantId, UUID companyId) {
        String[] tableNames = {"Bàn 1", "Bàn 2", "Bàn 3", "Bàn 4", "Quầy", "Mang về"};
        for (String name : tableNames) {
            ShopTable table = new ShopTable();
            table.setTenantId(tenantId);
            table.setCompanyId(companyId);
            table.setTableName(name);
            shopTableRepository.save(table);
        }

        String suffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase();

        // Main dish
        Model comTam = new Model();
        comTam.setTenantId(tenantId);
        comTam.setCompanyId(companyId);
        comTam.setModelCode("COM-TAM-" + suffix);
        comTam.setModelName("Cơm Tấm");
        comTam.setSellingPrice(new BigDecimal("35000"));
        comTam.setCategory("FOOD");
        comTam = modelRepository.save(comTam);

        BomEntity comTamBom = new BomEntity();
        comTamBom.setTenantId(tenantId);
        comTamBom.setCompanyId(companyId);
        comTamBom.setModel(comTam);
        comTamBom.setBomName("Cơm Tấm BOM");
        comTamBom.setVersion(1);
        comTamBom.setStatus("ACTIVE");
        bomRepository.save(comTamBom);

        // Topping group (paid add-ons)
        ModelMenuOption toppings = new ModelMenuOption();
        toppings.setTenantId(tenantId);
        toppings.setCompanyId(companyId);
        toppings.setModelId(comTam.getId());
        toppings.setGroupName("Topping");
        toppings.setChoices("[\"Sườn\",\"Bì\",\"Chả\",\"Trứng\"]");
        toppings.setMultiSelect(true);
        toppings.setRequired(false);
        toppings.setDisplayOrder(0);
        menuOptionRepository.save(toppings);

        // Free condiments group
        ModelMenuOption extras = new ModelMenuOption();
        extras.setTenantId(tenantId);
        extras.setCompanyId(companyId);
        extras.setModelId(comTam.getId());
        extras.setGroupName("Thêm");
        extras.setChoices("[\"Hành\",\"Ớt\",\"Tốp mỡ\"]");
        extras.setMultiSelect(true);
        extras.setRequired(false);
        extras.setIsFree(true);
        extras.setDisplayOrder(1);
        menuOptionRepository.save(extras);

        // Side drink
        Model drink = new Model();
        drink.setTenantId(tenantId);
        drink.setCompanyId(companyId);
        drink.setModelCode("NUOC-NGOT-" + suffix);
        drink.setModelName("Nước Ngọt");
        drink.setSellingPrice(new BigDecimal("15000"));
        drink.setCategory("DRINK");
        drink = modelRepository.save(drink);

        BomEntity drinkBom = new BomEntity();
        drinkBom.setTenantId(tenantId);
        drinkBom.setCompanyId(companyId);
        drinkBom.setModel(drink);
        drinkBom.setBomName("Nước Ngọt BOM");
        drinkBom.setVersion(1);
        drinkBom.setStatus("ACTIVE");
        bomRepository.save(drinkBom);
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
        List<Model> models = createSampleModels(tenantId, companyId);
        createBomsAndMenuOptions(tenantId, companyId, models);
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
        List<Model> models = createSampleModels(tenantId, companyId);
        createBomsAndMenuOptions(tenantId, companyId, models);
    }

    private List<Model> createSampleModels(UUID tenantId, UUID companyId) {
        String suffix = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        Object[][] items = {
            {"CA-PHE-DEN-" + suffix, "Cà Phê Đen", new BigDecimal("30000")},
            {"CA-PHE-SUA-" + suffix, "Cà Phê Sữa", new BigDecimal("35000")},
            {"TRA-XANH-"   + suffix, "Trà Xanh",   new BigDecimal("40000")},
        };
        List<Model> saved = new ArrayList<>();
        for (Object[] row : items) {
            Model m = new Model();
            m.setTenantId(tenantId);
            m.setCompanyId(companyId);
            m.setModelCode((String) row[0]);
            m.setModelName((String) row[1]);
            m.setSellingPrice((BigDecimal) row[2]);
            m.setCategory("DRINK");
            saved.add(modelRepository.save(m));
        }
        return saved;
    }

    private void createBomsAndMenuOptions(UUID tenantId, UUID companyId, List<Model> models) {
        for (Model m : models) {
            BomEntity bom = new BomEntity();
            bom.setTenantId(tenantId);
            bom.setCompanyId(companyId);
            bom.setModel(m);
            bom.setBomName(m.getModelName() + " BOM");
            bom.setVersion(1);
            bom.setStatus("ACTIVE");
            bomRepository.save(bom);

            ModelMenuOption sugar = new ModelMenuOption();
            sugar.setTenantId(tenantId);
            sugar.setCompanyId(companyId);
            sugar.setModelId(m.getId());
            sugar.setGroupName("Đường");
            sugar.setChoices("[\"30%\",\"50%\",\"70%\",\"100%\"]");
            sugar.setDefaultValue("70%");
            sugar.setDisplayOrder(0);
            menuOptionRepository.save(sugar);

            ModelMenuOption ice = new ModelMenuOption();
            ice.setTenantId(tenantId);
            ice.setCompanyId(companyId);
            ice.setModelId(m.getId());
            ice.setGroupName("Đá");
            ice.setChoices("[\"Không đá\",\"Ít đá\",\"Nhiều đá\"]");
            ice.setDefaultValue("Ít đá");
            ice.setDisplayOrder(1);
            menuOptionRepository.save(ice);
        }
    }
}
