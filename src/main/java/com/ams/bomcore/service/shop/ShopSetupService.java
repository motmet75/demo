package com.ams.bomcore.service.shop;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ams.bomcore.domain.bom.BomEntity;
import com.ams.bomcore.domain.bom.BomItemEntity;
import com.ams.bomcore.domain.company.Company;
import com.ams.bomcore.domain.inventory.WarehouseEntity;
import com.ams.bomcore.domain.material.Material;
import com.ams.bomcore.domain.model.Model;
import com.ams.bomcore.domain.shop.ModelMenuOption;
import com.ams.bomcore.domain.shop.ShopOrder;
import com.ams.bomcore.domain.shop.ShopTable;
import com.ams.bomcore.domain.tenant.Tenant;
import com.ams.bomcore.repository.BomItemRepository;
import com.ams.bomcore.repository.BomRepository;
import com.ams.bomcore.repository.CompanyRepository;
import com.ams.bomcore.repository.MaterialRepository;
import com.ams.bomcore.repository.ModelMenuOptionRepository;
import com.ams.bomcore.repository.ModelRepository;
import com.ams.bomcore.repository.ShopOrderItemRepository;
import com.ams.bomcore.repository.ShopOrderRepository;
import com.ams.bomcore.repository.ShopTableRepository;
import com.ams.bomcore.repository.TenantRepository;
import com.ams.bomcore.repository.WarehouseRepository;
import com.ams.bomcore.service.inventory.InventoryService;

@Service
public class ShopSetupService {

    private static final BigDecimal DEFAULT_SETUP_STOCK_QTY = new BigDecimal("10");

    private final ShopTableRepository shopTableRepository;
    private final ModelRepository modelRepository;
    private final BomRepository bomRepository;
    private final BomItemRepository bomItemRepository;
    private final ModelMenuOptionRepository menuOptionRepository;
    private final ShopOrderRepository shopOrderRepository;
    private final ShopOrderItemRepository shopOrderItemRepository;
    private final TenantRepository tenantRepository;
    private final CompanyRepository companyRepository;
    private final MaterialRepository materialRepository;
    private final WarehouseRepository warehouseRepository;
    private final InventoryService inventoryService;

    public ShopSetupService(ShopTableRepository shopTableRepository,
                            ModelRepository modelRepository,
                            BomRepository bomRepository,
                            BomItemRepository bomItemRepository,
                            ModelMenuOptionRepository menuOptionRepository,
                            ShopOrderRepository shopOrderRepository,
                            ShopOrderItemRepository shopOrderItemRepository,
                            TenantRepository tenantRepository,
                            CompanyRepository companyRepository,
                            MaterialRepository materialRepository,
                            WarehouseRepository warehouseRepository,
                            InventoryService inventoryService) {
        this.shopTableRepository = shopTableRepository;
        this.modelRepository = modelRepository;
        this.bomRepository = bomRepository;
        this.bomItemRepository = bomItemRepository;
        this.menuOptionRepository = menuOptionRepository;
        this.shopOrderRepository = shopOrderRepository;
        this.shopOrderItemRepository = shopOrderItemRepository;
        this.tenantRepository = tenantRepository;
        this.companyRepository = companyRepository;
        this.materialRepository = materialRepository;
        this.warehouseRepository = warehouseRepository;
        this.inventoryService = inventoryService;
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

        WarehouseEntity warehouse = createSetupWarehouse(tenantId, companyId, suffix);
        List<Material> materials = createRiceSetupMaterials(tenantId, companyId, suffix);
        seedInventory(tenantId, companyId, warehouse, materials, suffix);
        createBomItems(comTamBom, tenantId, companyId, List.of(
                new BomMaterialPlan(materials.get(0), BigDecimal.ONE),
                new BomMaterialPlan(materials.get(1), BigDecimal.ONE)));
        createBomItems(drinkBom, tenantId, companyId, List.of(
                new BomMaterialPlan(materials.get(2), BigDecimal.ONE)));
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
        String suffix = randomSuffix();
        List<Model> models = createSampleModels(tenantId, companyId, suffix);
        WarehouseEntity warehouse = createSetupWarehouse(tenantId, companyId, suffix);
        List<Material> materials = createDrinkSetupMaterials(tenantId, companyId, suffix);
        seedInventory(tenantId, companyId, warehouse, materials, suffix);
        createBomsAndMenuOptions(tenantId, companyId, models, drinkMaterialPlans(materials));
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
        String suffix = randomSuffix();
        List<Model> models = createSampleModels(tenantId, companyId, suffix);
        WarehouseEntity warehouse = createSetupWarehouse(tenantId, companyId, suffix);
        List<Material> materials = createDrinkSetupMaterials(tenantId, companyId, suffix);
        seedInventory(tenantId, companyId, warehouse, materials, suffix);
        createBomsAndMenuOptions(tenantId, companyId, models, drinkMaterialPlans(materials));
    }

    private List<Model> createSampleModels(UUID tenantId, UUID companyId, String suffix) {
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

    private void createBomsAndMenuOptions(UUID tenantId, UUID companyId, List<Model> models,
                                          List<List<BomMaterialPlan>> materialPlans) {
        for (int i = 0; i < models.size(); i++) {
            Model m = models.get(i);
            BomEntity bom = new BomEntity();
            bom.setTenantId(tenantId);
            bom.setCompanyId(companyId);
            bom.setModel(m);
            bom.setBomName(m.getModelName() + " BOM");
            bom.setVersion(1);
            bom.setStatus("ACTIVE");
            bomRepository.save(bom);
            createBomItems(bom, tenantId, companyId, i < materialPlans.size() ? materialPlans.get(i) : List.of());

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

    private List<Material> createDrinkSetupMaterials(UUID tenantId, UUID companyId, String suffix) {
        Tenant tenant = requireTenant(tenantId);
        Company company = requireCompany(companyId);
        return List.of(
                createSetupMaterial(tenant, company, "SHOP-COFFEE-" + suffix, "Shop Coffee Mix", "grm", "INGREDIENT"),
                createSetupMaterial(tenant, company, "SHOP-MILK-" + suffix, "Shop Milk Mix", "grm", "INGREDIENT"),
                createSetupMaterial(tenant, company, "SHOP-TEA-" + suffix, "Shop Tea Mix", "grm", "INGREDIENT"),
                createSetupMaterial(tenant, company, "SHOP-CUP-" + suffix, "Shop Cup", "pcs", "PACKAGING"));
    }

    private List<List<BomMaterialPlan>> drinkMaterialPlans(List<Material> materials) {
        Material coffee = materials.get(0);
        Material milk = materials.get(1);
        Material tea = materials.get(2);
        Material cup = materials.get(3);
        return List.of(
                List.of(new BomMaterialPlan(coffee, BigDecimal.ONE), new BomMaterialPlan(cup, BigDecimal.ONE)),
                List.of(new BomMaterialPlan(milk, BigDecimal.ONE), new BomMaterialPlan(cup, BigDecimal.ONE)),
                List.of(new BomMaterialPlan(tea, BigDecimal.ONE), new BomMaterialPlan(cup, BigDecimal.ONE)));
    }

    private List<Material> createRiceSetupMaterials(UUID tenantId, UUID companyId, String suffix) {
        Tenant tenant = requireTenant(tenantId);
        Company company = requireCompany(companyId);
        return List.of(
                createSetupMaterial(tenant, company, "SHOP-RICE-" + suffix, "Shop Rice", "grm", "INGREDIENT"),
                createSetupMaterial(tenant, company, "SHOP-PORK-" + suffix, "Shop Pork", "grm", "INGREDIENT"),
                createSetupMaterial(tenant, company, "SHOP-SOFT-DRINK-" + suffix, "Shop Soft Drink", "pcs", "DRINK"));
    }

    private Material createSetupMaterial(Tenant tenant, Company company, String code, String name, String unit, String type) {
        Material material = new Material();
        material.setTenant(tenant);
        material.setCompany(company);
        material.setMaterialCode(code);
        material.setMaterialName(name);
        material.setUnit(unit);
        material.setMaterialType(type);
        material.setPrice(BigDecimal.ZERO);
        material.setDescription("Auto shop setup material");
        material.setIsActive(Boolean.TRUE);
        return materialRepository.save(material);
    }

    private WarehouseEntity createSetupWarehouse(UUID tenantId, UUID companyId, String suffix) {
        WarehouseEntity warehouse = new WarehouseEntity();
        warehouse.setTenantId(tenantId);
        warehouse.setCompanyId(companyId);
        warehouse.setCode("SHOP-STOCK-" + suffix);
        warehouse.setName("Shop Stock " + suffix);
        warehouse.setLocation("Auto shop setup");
        warehouse.setNote("Default stock created by shop setup");
        warehouse.setIsActive(Boolean.TRUE);
        return warehouseRepository.save(warehouse);
    }

    private void seedInventory(UUID tenantId, UUID companyId, WarehouseEntity warehouse, List<Material> materials, String suffix) {
        for (Material material : materials) {
            inventoryService.addStock(
                    material.getMaterialCode(), warehouse.getCode(), DEFAULT_SETUP_STOCK_QTY,
                    "AUTO-SETUP-" + suffix, null, null, BigDecimal.ZERO,
                    tenantId, companyId, "Auto shop setup", "system", "Default stock for 10 menu units", null);
        }
    }

    private void createBomItems(BomEntity bom, UUID tenantId, UUID companyId, List<BomMaterialPlan> plans) {
        for (BomMaterialPlan plan : plans) {
            BomItemEntity item = new BomItemEntity();
            item.setTenantId(tenantId);
            item.setCompanyId(companyId);
            item.setBom(bom);
            item.setMaterial(plan.material());
            item.setQuantity(plan.quantity());
            item.setLevel(0);
            bomItemRepository.save(item);
        }
    }

    private Tenant requireTenant(UUID tenantId) {
        return tenantRepository.findById(tenantId)
                .orElseThrow(() -> new IllegalArgumentException("Tenant not found: " + tenantId));
    }

    private Company requireCompany(UUID companyId) {
        return companyRepository.findById(companyId)
                .orElseThrow(() -> new IllegalArgumentException("Company not found: " + companyId));
    }

    private String randomSuffix() {
        return UUID.randomUUID().toString().substring(0, 6).toUpperCase();
    }

    private record BomMaterialPlan(Material material, BigDecimal quantity) {}
}
