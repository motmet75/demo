# Tenant+Company Scoping Update - Inventory Import

## Date: February 11, 2026

## Overview
Updated the InventoryImportService to properly scope all entity lookups by tenantId and companyId. This ensures multi-tenant data isolation and prevents cross-tenant data access.

---

## Changes Made

### 1. ContractRepository.java ✅
**File**: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/repository/ContractRepository.java`

**Added Method**:
```java
Optional<Contract> findByContractNumberAndTenant_IdAndCompany_Id(
    String contractNumber, UUID tenantId, UUID companyId);
```

This method enables tenant+company scoped contract lookups during import.

---

### 2. InventoryImportService.java ✅
**File**: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/service/inventory/InventoryImportService.java`

#### Change 1: Material Validation (Line ~120-130)
**Before**:
```java
Optional<Material> mat = materialRepository.findByMaterialCode(row.materialCode);
```

**After**:
```java
Optional<Material> mat = materialRepository.findByMaterialCodeAndTenantIdAndCompanyId(
    row.materialCode, tenantId, companyId);
```

#### Change 2: Warehouse Validation (Line ~135-145)
**Before**:
```java
Optional<WarehouseEntity> wh = warehouseRepository.findByCode(row.warehouseCode);
```

**After**:
```java
Optional<WarehouseEntity> wh = warehouseRepository.findByCodeAndTenantIdAndCompanyId(
    row.warehouseCode, tenantId, companyId);
```

#### Change 3: Material Import Lookup (Line ~165-170)
**Before**:
```java
Material material = materialRepository.findByMaterialCode(row.materialCode)
    .orElseThrow(() -> new RuntimeException("Material not found: " + row.materialCode));
```

**After**:
```java
Material material = materialRepository.findByMaterialCodeAndTenantIdAndCompanyId(
    row.materialCode, tenantId, companyId)
    .orElseThrow(() -> new RuntimeException("Material not found: " + row.materialCode));
```

#### Change 4: Warehouse Import Lookup (Line ~171-176)
**Before**:
```java
WarehouseEntity warehouse = warehouseRepository.findByCode(row.warehouseCode)
    .orElseThrow(() -> new RuntimeException("Warehouse not found: " + row.warehouseCode));
```

**After**:
```java
WarehouseEntity warehouse = warehouseRepository.findByCodeAndTenantIdAndCompanyId(
    row.warehouseCode, tenantId, companyId)
    .orElseThrow(() -> new RuntimeException("Warehouse not found: " + row.warehouseCode));
```

#### Change 5: Contract Lookup (Line ~179-185)
**Before**:
```java
Optional<Contract> contract = contractRepository.findByContractNumber(row.contractCode);
```

**After**:
```java
Optional<Contract> contract = contractRepository.findByContractNumberAndTenant_IdAndCompany_Id(
    row.contractCode, tenantId, companyId);
```

---

### 3. Documentation Updates ✅
**File**: `/opt/tuonghoa/demo/INVENTORY_IMPORT_GUIDE.md`

Updated to clarify:
- All lookups are tenant+company scoped
- Materials/warehouses must exist in the same tenant+company context
- Cross-tenant/cross-company data is isolated

---

## Security & Data Isolation Benefits

### Before
❌ **Problem**: Entity lookups were global across all tenants
- Material "MAT001" from Tenant A could be used by Tenant B
- Warehouse "WH001" from Company X could be accessed by Company Y
- Potential data leakage and security issues

### After
✅ **Solution**: All lookups are properly scoped
- Material "MAT001" only accessible within its tenant+company
- Warehouse "WH001" only accessible within its tenant+company
- Contract references only valid within tenant+company context
- Complete multi-tenant data isolation

---

## Impact Analysis

### Existing Repositories
These repositories **already had** tenant+company scoped methods (no changes needed):
- ✅ `MaterialRepository.findByMaterialCodeAndTenantIdAndCompanyId()`
- ✅ `WarehouseRepository.findByCodeAndTenantIdAndCompanyId()`

### New Repository Method
- ✅ `ContractRepository.findByContractNumberAndTenant_IdAndCompany_Id()` - **ADDED**

### Service Changes
- ✅ `InventoryImportService.importFromCsv()` - **UPDATED** (5 method calls)

---

## Testing Scenarios

### Scenario 1: Same Tenant, Same Company ✅
**Given**: 
- User with tenantId=T1, companyId=C1
- Material "MAT001" exists in T1/C1

**When**: Import CSV with "MAT001"  
**Then**: ✅ Import succeeds

### Scenario 2: Different Tenant ❌
**Given**: 
- User with tenantId=T1, companyId=C1
- Material "MAT001" exists in T2/C2 (different tenant)

**When**: Import CSV with "MAT001"  
**Then**: ❌ Import fails with "Missing materials: MAT001"

### Scenario 3: Same Tenant, Different Company ❌
**Given**: 
- User with tenantId=T1, companyId=C1
- Material "MAT001" exists in T1/C2 (same tenant, different company)

**When**: Import CSV with "MAT001"  
**Then**: ❌ Import fails with "Missing materials: MAT001"

### Scenario 4: Contract Lookup (Optional) ✅
**Given**: 
- User with tenantId=T1, companyId=C1
- Contract "CTR001" exists in T1/C1

**When**: Import CSV with contract_code "CTR001"  
**Then**: ✅ Contract found and linked

**Given**: 
- User with tenantId=T1, companyId=C1
- Contract "CTR001" exists in T2/C2 (different tenant)

**When**: Import CSV with contract_code "CTR001"  
**Then**: ✅ Import proceeds, but contract_id remains NULL (optional field)

---

## API Request Requirements

### Required Headers/Parameters
The import endpoint **requires** tenantId and companyId:

```bash
POST /bom/api/inventory/import
Headers:
  X-Tenant-Id: <tenant-uuid>
  X-Company-Id: <company-uuid>
  Content-Type: multipart/form-data

OR

Query Parameters:
  ?tenantId=<tenant-uuid>&companyId=<company-uuid>
```

### Controller Validation
The controller enforces these requirements:
```java
if (tenantId == null || companyId == null) {
    return ResponseEntity.status(HttpStatus.BAD_REQUEST)
        .body("tenantId and companyId are required");
}
```

---

## Migration Notes

### For Existing Data
No database migration needed - this is a code-only change.

### For Existing Users
**Important**: Users must ensure:
1. They provide valid tenantId and companyId in requests
2. Materials and warehouses exist in their tenant+company context
3. CSV files reference materials/warehouses they own

---

## Verification Checklist

- [x] MaterialRepository method exists and used correctly
- [x] WarehouseRepository method exists and used correctly
- [x] ContractRepository method added and used correctly
- [x] All validation lookups are scoped
- [x] All import lookups are scoped
- [x] Documentation updated
- [x] No compilation errors
- [x] Multi-tenant isolation ensured

---

## Benefits

✅ **Security**: Prevents cross-tenant data access  
✅ **Data Integrity**: Ensures entities belong to correct tenant/company  
✅ **Compliance**: Meets multi-tenant architecture requirements  
✅ **Debugging**: Clearer error messages when entities not found  
✅ **Scalability**: Proper data isolation for SaaS deployments  

---

## Related Files

### Modified
1. `InventoryImportService.java` - 5 method calls updated
2. `ContractRepository.java` - 1 method added
3. `INVENTORY_IMPORT_GUIDE.md` - Documentation updated

### Unchanged (Already Had Tenant+Company Methods)
1. `MaterialRepository.java` ✅
2. `WarehouseRepository.java` ✅

---

**Status**: ✅ COMPLETE  
**Version**: 1.1.0  
**Last Updated**: February 11, 2026
