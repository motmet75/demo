# Constraint Violation Handling - Inventory Import

## Date: February 11, 2026

## Overview
Updated the InventoryImportService to properly handle unique constraint violations with transaction rollback and clear error messaging.

---

## Database Constraint

### Unique Constraint Definition
```sql
ALTER TABLE inventory
ADD CONSTRAINT uk_inventory_company_tenant_wh_material_batch
UNIQUE (company_id, tenant_id, warehouse_id, material_id, batch_no);
```

### What This Prevents
The constraint ensures that within a company and tenant, you cannot have duplicate inventory records for:
- Same warehouse
- Same material
- Same batch number

This prevents data duplication and ensures data integrity.

---

## Implementation Changes

### File: InventoryImportService.java

#### 1. Existing Record Check (Lines ~191-199)
```java
// Find existing or create new
Optional<InventoryEntity> existing = inventoryRepository
    .findByMaterialAndWarehouseCodeAndBatchNo(material, warehouse.getCode(), row.batchNo);

InventoryEntity inv;
boolean isNew = false;
if (existing.isPresent()) {
    inv = existing.get();
    // Verify the existing record belongs to same tenant+company
    if (!inv.getTenantId().equals(tenantId) || !inv.getCompanyId().equals(companyId)) {
        throw new RuntimeException("Duplicate inventory found but belongs to different tenant/company...");
    }
} else {
    inv = new InventoryEntity();
    // ... set fields for new record
    isNew = true;
}
```

**Purpose**: Before creating a new record, check if one already exists. If found and belongs to the same tenant+company, update it instead of creating duplicate.

#### 2. Constraint Violation Handler (Lines ~256-264)
```java
} catch (org.springframework.dao.DataIntegrityViolationException e) {
    // Handle constraint violation
    String constraintError = "CONSTRAINT VIOLATION - Duplicate inventory record detected. " +
            "The combination (company_id, tenant_id, warehouse_id, material_id, batch_no) must be unique. " +
            "Material: " + row.materialCode + ", Warehouse: " + row.warehouseCode + ", Batch: " + row.batchNo;
    errors.add("Line " + row.lineNumber + ": " + constraintError);
    // Transaction will rollback due to @Transactional(rollbackFor = Exception.class)
    throw new RuntimeException(constraintError, e);
} catch (Exception e) {
    errors.add("Line " + row.lineNumber + ": " + e.getMessage());
    // Re-throw to trigger rollback
    throw e;
}
```

**Purpose**: Catch database constraint violations and provide clear, user-friendly error message with:
- Constraint name explanation
- Which fields must be unique
- Specific values that caused the conflict
- Line number in CSV where error occurred

#### 3. Transaction Rollback
```java
@Transactional(rollbackFor = Exception.class)
public ImportResult importFromCsv(MultipartFile file, UUID tenantId, UUID companyId) {
    // ... import logic
}
```

**Purpose**: Any exception (including constraint violations) will trigger a **complete rollback** of all changes in the transaction. This ensures:
- No partial imports
- Database remains consistent
- All-or-nothing approach

---

## Error Flow

### Scenario 1: Update Existing Record ✅
**Given**: 
- CSV contains: MAT001, WH001, BATCH001
- Record exists in DB with same company/tenant/warehouse/material/batch

**Flow**:
1. findByMaterialAndWarehouseCodeAndBatchNo() finds existing record
2. Verify tenant+company match
3. Update existing record with new values
4. Save (no new record created)

**Result**: ✅ Success - Record updated

### Scenario 2: Constraint Violation (Cross-Tenant) ❌
**Given**: 
- CSV contains: MAT001, WH001, BATCH001
- Record exists but belongs to DIFFERENT tenant/company

**Flow**:
1. findByMaterialAndWarehouseCodeAndBatchNo() finds record
2. Verify tenant+company → **MISMATCH**
3. Throw RuntimeException with clear error

**Result**: ❌ Transaction rollback, error returned to user

### Scenario 3: Database Constraint Violation ❌
**Given**: 
- Somehow a duplicate slips through (race condition, concurrent import, etc.)

**Flow**:
1. Create new InventoryEntity
2. Set all fields
3. inventoryRepository.save(inv)
4. Database rejects with constraint violation
5. Catch DataIntegrityViolationException
6. Build user-friendly error message
7. Throw to trigger rollback

**Result**: ❌ Complete transaction rollback, detailed error to user

---

## Error Message Format

### User Sees
```json
{
  "success": false,
  "message": "Failed to read CSV file: CONSTRAINT VIOLATION - Duplicate inventory record detected...",
  "created": 0,
  "updated": 0,
  "errors": [
    "Line 15: CONSTRAINT VIOLATION - Duplicate inventory record detected. The combination (company_id, tenant_id, warehouse_id, material_id, batch_no) must be unique. Material: MAT001, Warehouse: WH001, Batch: BATCH001"
  ],
  "missingMaterials": [],
  "missingWarehouses": []
}
```

### Error Message Components
1. **"CONSTRAINT VIOLATION"** - Clear indication of the problem type
2. **Explanation** - Which fields must be unique
3. **Context** - Material code, Warehouse code, Batch number that caused the issue
4. **Line Number** - Exact line in CSV file where error occurred

---

## Transaction Behavior

### With @Transactional(rollbackFor = Exception.class)

#### On Success ✅
```
Start Transaction
  → Parse CSV
  → Validate materials/warehouses exist
  → Process row 1: Create/Update ✅
  → Process row 2: Create/Update ✅
  → Process row 3: Create/Update ✅
Commit Transaction ✅
Return: { success: true, created: 2, updated: 1 }
```

#### On Constraint Violation ❌
```
Start Transaction
  → Parse CSV
  → Validate materials/warehouses exist
  → Process row 1: Create/Update ✅
  → Process row 2: Create/Update ✅
  → Process row 3: Constraint violation! ❌
    → Catch DataIntegrityViolationException
    → Build error message
    → Throw RuntimeException
Rollback Transaction ❌ (rows 1 and 2 are undone)
Return: { success: false, created: 0, updated: 0, errors: [...] }
```

**Key Point**: Even if 99 out of 100 rows succeed, if row 100 fails, **ALL** changes are rolled back.

---

## Best Practices for Users

### 1. Check Before Import
```sql
-- Check if inventory already exists
SELECT * FROM inventory 
WHERE company_id = ?
  AND tenant_id = ?
  AND warehouse_id = ?
  AND material_id = ?
  AND batch_no = ?;
```

### 2. Use Update Strategy
If you want to update existing records:
- Include the same combination in CSV
- System will automatically update instead of create

### 3. Handle Duplicates in CSV
Before importing, check your CSV for duplicate combinations:
```bash
# Unix/Linux command to find duplicates
cut -d',' -f1,2,3 inventory.csv | sort | uniq -d
# Fields: material_code, warehouse_code, batch_no
```

### 4. Batch Number Strategy
Use unique batch numbers for different shipments/lots:
- ✅ BATCH-2026-02-11-001
- ✅ LOT-20260211-A
- ❌ BATCH001 (too generic, likely to collide)

---

## Testing Scenarios

### Test 1: Duplicate in Same CSV File
**CSV**:
```csv
material_code,warehouse_code,batch_no,quantity_on_hand
MAT001,WH001,BATCH001,100
MAT001,WH001,BATCH001,200
```

**Expected**: 
- ❌ Constraint violation on row 2
- Transaction rollback
- No records created

### Test 2: Update Existing Record
**Existing DB**: MAT001, WH001, BATCH001, qty=100
**CSV**: MAT001, WH001, BATCH001, qty=200

**Expected**: 
- ✅ Update successful
- Record updated with qty=200

### Test 3: Different Batch Number
**Existing DB**: MAT001, WH001, BATCH001
**CSV**: MAT001, WH001, BATCH002

**Expected**: 
- ✅ New record created
- Different batch = different record

### Test 4: Same Material, Different Warehouse
**Existing DB**: MAT001, WH001, BATCH001
**CSV**: MAT001, WH002, BATCH001

**Expected**: 
- ✅ New record created
- Different warehouse = different record

---

## Troubleshooting

### Error: "Duplicate inventory found but belongs to different tenant/company"
**Cause**: Database has record with same natural key but different tenant/company
**Solution**: This is a data integrity issue - contact admin

### Error: "CONSTRAINT VIOLATION - Duplicate inventory record detected"
**Cause**: Trying to create duplicate within same tenant/company/warehouse/material/batch
**Solution**: 
- If updating: good! System should have found existing record (check findBy method)
- If creating: change batch number or check for existing records

### Import Succeeds But Record Not Updated
**Cause**: findByMaterialAndWarehouseCodeAndBatchNo() not finding existing record
**Solution**: Check repository query, verify indexes exist

---

## Database Index Recommendations

To optimize the constraint check and existing record lookup:

```sql
-- Unique index (automatically created by UNIQUE constraint)
-- uk_inventory_company_tenant_wh_material_batch on (company_id, tenant_id, warehouse_id, material_id, batch_no)

-- Additional indexes for lookup performance
CREATE INDEX IF NOT EXISTS idx_inventory_material_warehouse_batch 
    ON inventory(material_id, warehouse_id, batch_no);

CREATE INDEX IF NOT EXISTS idx_inventory_tenant_company 
    ON inventory(tenant_id, company_id);
```

---

## Summary

✅ **Constraint Added**: uk_inventory_company_tenant_wh_material_batch  
✅ **Violation Handler**: Catches DataIntegrityViolationException  
✅ **Clear Error Message**: Shows material, warehouse, batch that caused conflict  
✅ **Transaction Rollback**: All changes reverted on any error  
✅ **Update Support**: Existing records updated instead of creating duplicates  
✅ **Tenant Isolation**: Verified before update  

---

**Status**: ✅ COMPLETE  
**Version**: 1.2.0  
**Last Updated**: February 11, 2026
