package com.anhmedia.portalweb.legacy;

import com.anhmedia.portalweb.legacy.entity.Partner;
import com.anhmedia.portalweb.legacy.entity.Product;
import com.anhmedia.portalweb.legacy.entity.ProductBrand;
import com.anhmedia.portalweb.legacy.entity.ProductCatalog;
import com.anhmedia.portalweb.legacy.entity.ProductColor;
import com.anhmedia.portalweb.legacy.entity.ProductGroup;
import com.anhmedia.portalweb.legacy.entity.ProductPrice;
import com.anhmedia.portalweb.legacy.entity.ProductSize;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Legacy ProductService / ProductCatalogService / ProductBrandService /
 * ProductGroupService / PartnerService behaviour for ONE tenant and ONE request.
 *
 * Legacy caches catalogs, brands, sizes, colors and prices per tenant for the
 * whole JVM life and hands out the same mutable objects every time. Within a
 * request that means every product's productCategory IS the catalog instance
 * in "catalogs"; this class reproduces that sharing by loading each list once
 * per request and reusing the instances.
 */
public class LegacyProductService {
    private final LegacyProductRepository repo;
    private final String tenant;

    private List<ProductCatalog> catalogs;
    private List<ProductBrand> brands;
    private Map<String, List<ProductSize>> sizesByCode;
    private Map<String, List<ProductColor>> colorsByCode;
    private Map<String, List<ProductPrice>> pricesByCode;

    public LegacyProductService(LegacyProductRepository repo, String tenant) {
        this.repo = repo;
        this.tenant = tenant;
    }

    // ---- ProductCatalogService / ProductBrandService / ProductGroupService / PartnerService ----

    public List<ProductCatalog> getAllProductCatalog() {
        if (catalogs == null) catalogs = repo.getAllProductCatalog();
        return catalogs.isEmpty() ? Collections.emptyList() : catalogs;
    }

    public List<ProductCatalog> getTopProductCatalogs(int n) { return repo.getTopProductCatalogs(n); }

    private List<ProductBrand> getAllProductBrand() {
        if (brands == null) brands = repo.getAllProductBrand();
        return brands;
    }

    public List<ProductBrand> getAllProductDisPlayedBrand() { return repo.getAllProductDisPlayedBrand(); }

    public List<ProductGroup> getAllProductGroup() { return repo.getAllProductGroup(); }

    public List<Partner> getAllPartner() { return repo.getAllPartner(); }

    // ---- ProductService ----

    public void MapCategoryAndBrand(List<Product> inputedList) {
        if (inputedList == null || inputedList.isEmpty()) return;
        List<ProductCatalog> cats = getAllProductCatalog();
        List<ProductBrand> brs = getAllProductBrand();
        Map<String, ProductCatalog> catalogByCode = cats.stream()
                .collect(Collectors.toMap(c -> c.getCatalogCode().toLowerCase(), c -> c, (a, b) -> a));
        Map<String, ProductBrand> brandByCode = brs.stream()
                .collect(Collectors.toMap(b -> b.getBrandCode().toLowerCase(), b -> b, (a, b) -> a));
        for (Product product : inputedList) {
            product.setTenantId(tenant);
            product.formatPrice(tenant);
            if (!product.getProductCatalog().isEmpty()) {
                String pc = product.getProductCatalog().toLowerCase();
                ProductCatalog cat = catalogByCode.get(pc);
                if (cat == null) {
                    cat = cats.stream().filter(c -> c.getCatalogCode().toLowerCase().contains(pc)).findFirst().orElse(null);
                }
                if (cat != null) product.setProductCategory(cat);
            }
            if (!product.getProductBrand().isEmpty()) {
                String pb = product.getProductBrand().toLowerCase();
                ProductBrand brand = brandByCode.get(pb);
                if (brand == null) {
                    brand = brs.stream().filter(b -> b.getBrandCode().toLowerCase().contains(pb)).findFirst().orElse(null);
                }
                if (brand != null) product.setProductBrandEntity(brand);
            }
        }
    }

    public void MapColorsAndPrices(List<Product> inputedList) {
        if (inputedList == null || inputedList.isEmpty()) return;
        if (sizesByCode == null) {
            sizesByCode = repo.getAllProductSize().stream().collect(Collectors.groupingBy(ProductSize::getProductCode));
            colorsByCode = repo.getAllProductColor().stream().collect(Collectors.groupingBy(ProductColor::getProductCode));
            pricesByCode = repo.getAllProductPrice().stream()
                    .peek(price -> price.setTenantId(tenant))
                    .collect(Collectors.groupingBy(ProductPrice::getProductCode));
        }
        for (Product p : inputedList) {
            p.setTenantId(tenant);
            String code = p.getProductCode();
            List<ProductSize> sizes = sizesByCode.get(code);
            if (sizes != null && !sizes.isEmpty()) p.setSizeList(sizes);
            List<ProductColor> colors = colorsByCode.get(code);
            if (colors != null && !colors.isEmpty()) p.setColorList(colors);
            List<ProductPrice> prices = pricesByCode.get(code);
            if (prices != null && !prices.isEmpty()) p.setPriceList(prices);
        }
    }

    private List<Product> mapped(List<Product> list) {
        MapCategoryAndBrand(list);
        MapColorsAndPrices(list);
        return list;
    }

    public List<Product> getNewProducts() { return mapped(repo.getNewProducts()); }

    public List<Product> getAllDisPlayedProduct() { return mapped(repo.getAllDisPlayedProduct()); }

    public List<Product> getProductsWithVideosByPage(int page, int size) {
        if (size < 1) size = 1;
        return mapped(repo.getProductsWithVideosByPage(page, size));
    }

    public List<Product> getProductsByPage(String catalogCode, int page, int size) {
        return mapped(new LinkedList<>(repo.getProductsByPage(catalogCode, page, size)));
    }

    public List<Product> getProductsByGroupByPage(String groupCode, int page, int size) {
        if (size == 0) size = 1;
        return mapped(new LinkedList<>(repo.getProductsByGroupByPage(groupCode, page, size)));
    }

    public long countProductsByGroup(String groupCode) { return repo.countProductsByGroup(groupCode); }

    static List<String> normalizeCategoryCodes(List<String> categList) {
        if (categList == null) return Collections.emptyList();
        return categList.stream()
                .filter(v -> v != null)
                .flatMap(v -> Arrays.stream(Utilities.ValidateInputValue(v).split(";")))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(v -> !v.isBlank() && !"0".equals(v))
                .distinct()
                .collect(Collectors.toList());
    }

    public List<Product> findProductsByCategoryCode(String groupCode, List<String> categList, int page, int size) {
        if (size < 1) size = 1;
        List<String> codes = normalizeCategoryCodes(categList);
        if (codes.isEmpty()) return Collections.emptyList();
        String safeGroup = groupCode == null ? "" : groupCode;
        List<Product> result;
        if (codes.size() == 1) {
            result = safeGroup.isEmpty()
                    ? repo.findByCatalogOrSubCatalog(codes.get(0), "", page, size)
                    : repo.findByCatalogOrSubCatalog(safeGroup, codes.get(0), "", page, size);
        } else {
            result = repo.findProductsByCategoryCode(safeGroup, codes, page, size);
        }
        return mapped(result);
    }

    public long countProductsByCategoryCode(String groupCode, List<String> categList) {
        List<String> codes = normalizeCategoryCodes(categList);
        if (codes.isEmpty()) return 0;
        String safeGroup = groupCode == null ? "" : groupCode;
        if (codes.size() == 1) return countByCatalogOrSubCatalog(safeGroup, codes.get(0), "");
        return repo.countProductsByCategoryCode(safeGroup, codes);
    }

    public List<String> findGroupStringsByCatalogOrSubCatalog(List<String> categList) {
        List<String> codes = normalizeCategoryCodes(categList);
        if (codes.isEmpty()) return Collections.emptyList();
        if (codes.size() == 1) return repo.findGroupStringsByCatalogOrSubCatalog(codes.get(0), "");
        return repo.findDistinctProductGroupStringsByCategoryCode(codes);
    }

    public List<String> findGroupStringsByCatalogOrSubCatalog(String catalogCode, String searchTerm) {
        return repo.findGroupStringsByCatalogOrSubCatalog(catalogCode, searchTerm);
    }

    public List<Product> findByCatalogOrSubCatalog(String groupCode, String catalogCode, String searchTerm, int page, int size) {
        List<Product> found = groupCode != null && !groupCode.isEmpty()
                ? repo.findByCatalogOrSubCatalog(groupCode, catalogCode, searchTerm, page, size)
                : repo.findByCatalogOrSubCatalog(catalogCode, searchTerm, page, size);
        return mapped(found);
    }

    public long countByCatalogOrSubCatalog(String groupCode, String catalogCode, String searchTerm) {
        return groupCode != null && !groupCode.isEmpty()
                ? repo.countByCatalogOrSubCatalog(groupCode, catalogCode, searchTerm)
                : repo.countByCatalogOrSubCatalog(catalogCode, searchTerm);
    }

    public List<Product> findBySearchTerm(String groupCode, String searchTerm, int page, int size) {
        List<Product> found = groupCode != null && !groupCode.isEmpty()
                ? repo.findBySearchTerm(groupCode, searchTerm, page, size)
                : repo.findBySearchTerm(searchTerm, page, size);
        return mapped(found);
    }

    public long countBySearchTerm(String groupCode, String searchTerm) {
        return groupCode != null && !groupCode.isEmpty()
                ? repo.countBySearchTerm(groupCode, searchTerm)
                : repo.countBySearchTerm(searchTerm);
    }

    public List<String> findGroupStringsBySearchTerm(String searchTerm) { return repo.findGroupStringsBySearchTerm(searchTerm); }

    public List<Product> findProductsByCategoryBrand(List<String> brandList) {
        return mapped(repo.findProductsByCategoryBrand(brandList));
    }

    public List<Product> findProductsByCategoryCodeAadBrand(List<String> cataList, List<String> brandList) {
        return mapped(repo.findProductsByCategoryCodeAadBrand(brandList, cataList));
    }

    // ---- GreetingController helpers ----

    /** GreetingController.searchGroupCodes: split "#a#b" group strings into a set. */
    public static Set<String> searchGroupCodes(List<String> rawResults) {
        Set<String> unique = new HashSet<>();
        for (String groupString : rawResults) {
            if (groupString != null) {
                for (String part : groupString.split("#")) {
                    if (!part.isEmpty()) unique.add(part);
                }
            }
        }
        return unique;
    }

    /** GreetingController.formatProductsForResultImages. */
    public void formatProductsForResultImages(List<Product> products) {
        if (products == null) return;
        for (Product product : products) {
            if (product != null && Utilities.returnTenants(tenant, product.getProductImageDesUrl())) {
                product.setProductImageDesUrl(Utilities.appendResolutionToFilename(product.getProductImageDesUrl(), "_rslt_300x300"));
            }
        }
    }

    public String tenant() { return tenant; }
}
