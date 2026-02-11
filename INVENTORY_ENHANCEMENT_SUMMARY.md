# Inventory Enhancement Summary

## Date: February 11, 2026

## Overview
This document summarizes all changes made to enhance the Inventory system with additional fields from the SQL schema and CSV import functionality.

---

## 1. Database Changes

### File: `INVENTORY_ALTER_TABLE_QUERIES.sql`
**Location**: `/opt/tuonghoa/demo/INVENTORY_ALTER_TABLE_QUERIES.sql`

**New Fields Added**:

#### Contract & Reference Fields
- `contract_id` (UUID) - Contract reference without FK constraint
- `contract_code` (VARCHAR 50) - Contract code
- `material_code` (VARCHAR 50) - Denormalized material code
- `warehouse_code` (VARCHAR 50) - Denormalized warehouse code
- `order_to_deduction` (VARCHAR 100) - Sales order/deduction reference

#### User & Unit Information
- `user_name` (VARCHAR 100) - User who created/modified (default: 'system')
- `unit` (VARCHAR 20) - Unit of measure (default: 'pcs')
- `unit_price` (NUMERIC 18,4) - Price per unit (default: 0)
- `currency` (CHAR 3) - Currency code (default: 'USD')

#### Customs & Trade
- `hs_code` (VARCHAR 20) - Harmonized System code
- `origin_type` (VARCHAR 50) - Origin type (e.g., Manufactured, Imported)
- `origin_country` (CHAR 2) - ISO 3166-1 alpha-2 country code

#### Document References
- `xform_no` (VARCHAR 50) - Transfer form number
- `cds_no` (VARCHAR 50) - Customs declaration number
- `purchase_no` (VARCHAR 50) - Purchase order number

#### Quantity Tracking
- `quantity_reserved` (NUMERIC 18,3) - Reserved quantity (soft lock)
- `material_quota` (NUMERIC 18,3) - Allocated quota/limit
- `material_quota_percentage` (NUMERIC 8,5) - Quota as percentage

#### Date/Time Fields
- `xform_date` (DATE) - Transfer form date
- `purchase_date_time` (TIMESTAMP WITH TIME ZONE) - Purchase timestamp
- `cds_date_time` (TIMESTAMP WITH TIME ZONE) - Customs declaration timestamp
- `modified_time` (TIMESTAMP WITH TIME ZONE) - Last modification time

#### Status Flags
- `visible` (BOOLEAN) - Visibility flag (default: true)
- `approved` (BOOLEAN) - Approval status (default: false)
- `locked` (BOOLEAN) - Record lock status (default: false)

**Constraints Added**:
- Unique constraint: `(warehouse_code, material_code, batch_no)`
- Check constraint: Non-negative quantities

**Indexes Created**:
- `idx_inventory_material_code`
- `idx_inventory_warehouse_code`
- `idx_inventory_contract_code`
- `idx_inventory_batch_no`
- `idx_inventory_tenant_company`
- `idx_inventory_visible`
- `idx_inventory_approved`

---

## 2. Backend Changes

### 2.1 Entity Updates

#### File: `InventoryEntity.java`
**Location**: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/domain/inventory/InventoryEntity.java`

**Changes**:
- Added all new fields from SQL schema
- Added getters and setters for all new fields
- Updated `@PrePersist` to initialize default values
- Removed duplicate `quantityReserved` alias methods (now a real field)
- Added denormalized code fields sync in `@PrePersist`

**Key Fields**:
- `contractId`, `contractCode` - Contract references (no FK)
- `materialCodeDenorm`, `warehouseCodeDenorm` - Denormalized codes
- `quantityReserved` - Now a real field (not alias)
- `unit`, `unitPrice`, `currency` - Pricing information
- `hsCode`, `originType`, `originCountry` - Customs data
- `visible`, `approved`, `locked` - Status flags

### 2.2 DTO Updates

#### File: `InventoryViewDTO.java`
**Location**: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/controller/inventory/dto/InventoryViewDTO.java`

**Changes**:
- Expanded constructor to include new fields
- Added fields: `quantityLocked`, `contractCode`, `unit`, `unitPrice`, `currency`, `visible`, `approved`, `locked`
- Added corresponding getters

### 2.3 Repository Updates

#### File: `InventoryRepository.java`
**Location**: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/repository/InventoryRepository.java`

**Changes**:
- Updated all `InventoryViewDTO` projection queries to include new fields
- Modified query constructor calls to match new DTO signature

### 2.4 New Import Service

#### File: `InventoryImportService.java` ⭐ NEW
**Location**: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/service/inventory/InventoryImportService.java`

**Features**:
- Two-phase validation: structure validation, then entity existence validation
- Stops import if any materials or warehouses are missing
- Returns detailed error information including missing entity lists
- Supports all new inventory fields from CSV
- Creates or updates existing records based on `material + warehouse + batch`
- Handles date/time parsing in multiple formats
- Transaction rollback on error

**CSV Columns Supported**: All 28 fields including optional ones

**Import Result**:
```java
public static class ImportResult {
    boolean success;
    String message;
    int created;
    int updated;
    List<String> errors;
    List<String> missingMaterials;
    List<String> missingWarehouses;
}
```

### 2.5 Controller Updates

#### File: `InventoryController.java`
**Location**: `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/controller/inventory/InventoryController.java`

**Changes**:
- Added `InventoryImportService` dependency injection
- Added new endpoint: `POST /bom/api/inventory/import`
- Accepts multipart file upload
- Requires `tenantId` and `companyId` (query param or header)
- Returns `ImportResult` with detailed status

---

## 3. Frontend Changes

### 3.1 Edit Modal Updates

#### File: `InventoryEditModal.jsx`
**Location**: `/opt/tuonghoa/demo/bom-frontend/src/features/inventory/InventoryEditModal.jsx`

**Changes**:
- Added form fields for all new inventory properties
- Updated form initialization to include new fields with defaults
- Added fields:
  - `quantityLocked` - Locked quantity
  - `contractCode` - Contract reference
  - `unit`, `unitPrice`, `currency` - Pricing
  - `hsCode`, `originType`, `originCountry` - Customs
  - `orderToDeduction` - Order reference
  - `visible`, `approved`, `locked` - Status flags
- Updated payload to include all new fields when saving

### 3.2 Grid Updates

#### File: `InventoryGrid.jsx`
**Location**: `/opt/tuonghoa/demo/bom-frontend/src/features/inventory/InventoryGrid.jsx`

**Changes**:
- Updated `normalizeInventoryView` to map new DTO fields
- Added new columns to grid:
  - `quantityLocked` - Locked quantity
  - `contractCode` - Contract reference
  - `unit` - Unit of measure
  - `unitPrice` - Unit price
  - `currency` - Currency
  - `visible`, `approved`, `locked` - Status flags
- Updated export data mapping to include all new fields
- Fixed `availableQuantity` calculation to use `quantityLocked` instead of `quantityReserved`

### 3.3 Import Component Updates

#### File: `InventoryImport.jsx`
**Location**: `/opt/tuonghoa/demo/bom-frontend/src/features/inventory/InventoryImport.jsx`

**Changes**:
- Enhanced result display to show:
  - Created and updated counts
  - Missing materials list (red highlight)
  - Missing warehouses list (red highlight)
  - Row-level errors
- Improved error messaging for validation failures

### 3.4 API Updates

#### File: `inventoryApi.js`
**Location**: `/opt/tuonghoa/demo/bom-frontend/src/api/inventoryApi.js`

**Status**: Already had `importInventory` function - no changes needed ✓

---

## 4. Documentation

### 4.1 Import Guide
**File**: `INVENTORY_IMPORT_GUIDE.md`
**Location**: `/opt/tuonghoa/demo/INVENTORY_IMPORT_GUIDE.md`

**Contents**:
- Complete field reference
- CSV format specification
- Date format guidelines
- Import process explanation
- Error handling guide
- Best practices
- Troubleshooting tips

### 4.2 Sample CSV Template
**File**: `inventory_import_template.csv`
**Location**: `/opt/tuonghoa/demo/inventory_import_template.csv`

**Contents**:
- Header row with all 28 columns
- 3 sample data rows showing various field combinations
- Examples of different date formats
- Examples of different status values

### 4.3 SQL Scripts
**File**: `INVENTORY_ALTER_TABLE_QUERIES.sql`
**Location**: `/opt/tuonghoa/demo/INVENTORY_ALTER_TABLE_QUERIES.sql`

**Contents**:
- Complete ALTER TABLE statements
- Constraint definitions
- Index creation statements
- Field comments for documentation

---

## 5. Key Features Implemented

### ✅ Comprehensive Field Support
- All 28+ fields from SQL schema now supported in JPA entity
- Frontend forms and grid updated to display/edit new fields
- Default values properly configured

### ✅ CSV Import with Validation
- Two-phase validation prevents partial imports
- Clear error messages identify missing entities
- Supports create and update based on business key
- No foreign key constraints as requested

### ✅ Entity Lookup by Code
- Materials found by `material_code`
- Warehouses found by `warehouse_code`
- Contracts found by `contract_code` (optional)
- UUIDs assigned after lookup

### ✅ Error Reporting
- Missing materials list shown before import
- Missing warehouses list shown before import
- Row-level validation errors with line numbers
- User-friendly messages in frontend

### ✅ Default Values
- `user_name`: "system"
- `unit`: "pcs"
- `currency`: "USD"
- `unitPrice`: 0
- `visible`: true
- `approved`: false
- `locked`: false
- All nullable fields handled gracefully

---

## 6. Testing Checklist

### Database
- [ ] Run ALTER TABLE queries on test database
- [ ] Verify constraints work correctly
- [ ] Verify indexes improve query performance
- [ ] Test unique constraint on (warehouse, material, batch)

### Backend
- [ ] Test entity CRUD operations with new fields
- [ ] Test CSV import with valid data
- [ ] Test CSV import with missing materials (should fail gracefully)
- [ ] Test CSV import with missing warehouses (should fail gracefully)
- [ ] Test CSV import with invalid data formats
- [ ] Verify transaction rollback on errors
- [ ] Test contract code lookup (optional field)

### Frontend
- [ ] Test inventory grid displays all new columns
- [ ] Test filtering and sorting with new columns
- [ ] Test edit modal with all new fields
- [ ] Test CSV import UI
- [ ] Verify error messages display correctly
- [ ] Test export with new fields included
- [ ] Test form validation for required fields

### Integration
- [ ] Test full workflow: import CSV → view grid → edit record
- [ ] Test update existing records via import
- [ ] Verify denormalized codes sync correctly
- [ ] Test with various date/time formats
- [ ] Test with different currencies and units

---

## 7. Migration Steps

### Step 1: Database Migration
```bash
# Run on production database
psql -U username -d database_name -f INVENTORY_ALTER_TABLE_QUERIES.sql
```

### Step 2: Backend Deployment
- Deploy updated Java application
- Verify all services start without errors
- Check logs for any migration issues

### Step 3: Frontend Deployment
- Build and deploy updated React application
- Clear browser cache
- Verify all pages load correctly

### Step 4: Data Migration (if needed)
- Export existing inventory data
- Update CSV with new fields
- Re-import using new import function

### Step 5: Verification
- Test import with sample CSV
- Verify all fields display correctly
- Check performance with large datasets

---

## 8. Maintenance Notes

### Regular Tasks
- Monitor import errors and address common issues
- Update CSV template if new fields added
- Review and optimize indexes based on query patterns
- Archive old inventory records periodically

### Known Limitations
- No foreign key on `contract_id` (by design)
- Simple CSV parser (doesn't handle quoted commas)
- Large imports may be slow (consider batch processing)
- Date formats must be ISO standard

### Future Enhancements
- Add async import for large files
- Add import preview before commit
- Add field mapping UI for flexible CSV formats
- Add bulk update operations
- Add inventory history tracking

---

## 9. Files Modified/Created

### Modified Files (10)
1. `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/domain/inventory/InventoryEntity.java`
2. `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/controller/inventory/dto/InventoryViewDTO.java`
3. `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/repository/InventoryRepository.java`
4. `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/controller/inventory/InventoryController.java`
5. `/opt/tuonghoa/demo/bom-frontend/src/features/inventory/InventoryEditModal.jsx`
6. `/opt/tuonghoa/demo/bom-frontend/src/features/inventory/InventoryGrid.jsx`
7. `/opt/tuonghoa/demo/bom-frontend/src/features/inventory/InventoryImport.jsx`

### New Files Created (4)
1. `/opt/tuonghoa/demo/src/main/java/com/ams/bomcore/service/inventory/InventoryImportService.java` ⭐
2. `/opt/tuonghoa/demo/INVENTORY_ALTER_TABLE_QUERIES.sql` 📄
3. `/opt/tuonghoa/demo/inventory_import_template.csv` 📄
4. `/opt/tuonghoa/demo/INVENTORY_IMPORT_GUIDE.md` 📄

---

## 10. Contact & Support

For questions or issues related to these changes:
- Review documentation in `INVENTORY_IMPORT_GUIDE.md`
- Check sample data in `inventory_import_template.csv`
- Review SQL changes in `INVENTORY_ALTER_TABLE_QUERIES.sql`
- Contact development team for technical support

---

**Document Version**: 1.0  
**Last Updated**: February 11, 2026  
**Author**: AI Assistant (GitHub Copilot)
