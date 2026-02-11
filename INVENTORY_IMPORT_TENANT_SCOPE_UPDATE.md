# Inventory Import Service - Tenant/Company Scope Update

## Summary
Updated the InventoryImportService to enforce tenant and company scoping when finding existing inventory records during import. The service now throws an exception if a record with the same business key (material, warehouse, batch) exists for a different tenant/company.

## Changes Made

### 1. InventoryRepository.java
**Added new repository method:**
```java
Optional<InventoryEntity> findByMaterialAndWarehouseCodeAndBatchNoAndTenantIdAndCompanyId(
    Material material, 
    String warehouseCode, 
    String batchNo, 
    UUID tenantId, 
    UUID companyId
)
```

This method finds inventory records scoped to a specific tenant and company, ensuring data isolation.

### 2. InventoryImportService.java
**Updated the import logic with two-step validation:**

#### Step 1: Check for any existing record
First, the service checks if ANY inventory record exists with the given business key (material, warehouse, batch) using:
```java
inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNo(material, warehouse.getCode(), row.batchNo)
```

If a record exists, it verifies that it belongs to the **same tenant and company**. If not, it throws an exception:
```
"Cannot import: An inventory record already exists for a different tenant/company. 
Material: {code}, Warehouse: {code}, Batch: {batch}. 
This violates the unique constraint (tenant_id, company_id, warehouse_id, material_id, batch_no)."
```

#### Step 2: Find or create with tenant/company scope
Then, it uses the new tenant-scoped method to find the exact record:
```java
inventoryRepository.findByMaterialAndWarehouseCodeAndBatchNoAndTenantIdAndCompanyId(
    material, warehouse.getCode(), row.batchNo, tenantId, companyId
)
```

This ensures:
- ✅ Records are properly isolated by tenant and company
- ✅ Import fails fast with a clear error message if cross-tenant conflicts exist
- ✅ The unique constraint on (tenant_id, company_id, warehouse_id, material_id, batch_no) is respected
- ✅ Updates only happen to records within the same tenant/company scope

## Benefits

1. **Data Isolation**: Prevents accidental cross-tenant data access or modification
2. **Clear Error Messages**: Users get specific information about which records conflict
3. **Database Constraint Compliance**: Aligns with the database unique constraint
4. **Transaction Safety**: The entire import transaction rolls back if any conflict is detected

## Error Handling

The service now catches and reports:
- Cross-tenant conflicts before attempting to save
- Constraint violation exceptions with detailed information
- Line-by-line error reporting for better debugging

## Testing Recommendations

1. **Test tenant isolation**: Try importing the same material/warehouse/batch combination for different tenants
2. **Test update scenario**: Import the same data twice for the same tenant (should update, not error)
3. **Test cross-tenant conflict**: Pre-create a record for tenant A, then try to import for tenant B with same business key
4. **Test error messages**: Verify error messages contain all relevant information (material, warehouse, batch, tenant, company)

## Database Constraint
This update enforces the database unique constraint:
```sql
UNIQUE (tenant_id, company_id, warehouse_id, material_id, batch_no)
```

The application-level validation ensures clean error messages before the database constraint would be violated.
