# Inventory Import Guide

## Overview
This guide explains how to import inventory data from CSV files into the system. The import function validates all materials exist before processing any records to prevent partial imports.

**Important**: All lookups are scoped to your tenant and company. Materials, warehouses, and contracts must exist within your tenant+company context.

## CSV File Format

### Required Columns
- `material_code` - Material code (must exist in system)
- `warehouse_code` - Warehouse code (must exist in system)
- `batch_no` - Batch number
- `quantity_on_hand` - Current quantity

### Optional Columns
- `contract_code` - Contract reference code
- `unit` - Unit of measure (default: "pcs")
- `unit_price` - Price per unit (default: 0)
- `currency` - Currency code (default: "USD")
- `hs_code` - Harmonized System code for customs
- `origin_type` - Origin type (e.g., "Manufactured", "Imported")
- `origin_country` - ISO 3166-1 alpha-2 country code
- `xform_no` - Transfer form/movement document number
- `cds_no` - Customs declaration number
- `purchase_no` - Purchase order number
- `order_to_deduction` - Sales order or deduction reference
- `quantity_reserved` - Reserved quantity
- `quantity_locked` - Locked quantity
- `material_quota` - Allocated limit/quota
- `material_quota_percentage` - Quota as percentage
- `user_name` - User who created the record (default: "system")
- `xform_date` - Transfer date (format: YYYY-MM-DD)
- `purchase_date_time` - Purchase date/time (ISO 8601 format)
- `cds_date_time` - Customs declaration date/time (ISO 8601 format)
- `production_date_time` - Production date/time (ISO 8601 format)
- `expiration_date_time` - Expiration date/time (ISO 8601 format)
- `visible` - Visibility flag (true/false/1/0/yes/no)
- `approved` - Approval status (true/false/1/0/yes/no)
- `locked` - Lock status (true/false/1/0/yes/no)

## Date Formats
- Date only: `YYYY-MM-DD` (e.g., `2026-02-11`)
- Date with time: ISO 8601 format `YYYY-MM-DDTHH:mm:ssZ` (e.g., `2026-02-11T10:30:00Z`)

## Import Process

### 1. Preparation
- Prepare your CSV file with header row
- Ensure all materials referenced by `material_code` exist in the system
- Ensure all warehouses referenced by `warehouse_code` exist in the system
- Verify contract codes if specified

### 2. Validation Phase
The import process performs validation in two phases:

**Phase 1: Structure & Format Validation**
- Checks CSV structure and header
- Validates required fields are present
- Validates data types and formats

**Phase 2: Entity Existence Validation (Tenant+Company Scoped)**
- Checks all material codes exist in your tenant+company context
- Checks all warehouse codes exist in your tenant+company context
- **IMPORTANT**: Lookups are scoped to the tenantId and companyId provided in the request
- Materials/warehouses from other tenants or companies will not be found
- If any materials or warehouses are missing, the import will STOP and return a list of missing items. No records will be created.

### 3. Import Phase
If all validations pass:
- Creates new inventory records or updates existing ones
- Existing records are identified by: `material_code + warehouse_code + batch_no`
- Returns count of created and updated records

## Error Handling

### Missing Materials
If any materials are not found in your tenant+company context, the import will fail with:
```json
{
  "success": false,
  "message": "Cannot import: missing materials in system",
  "missingMaterials": ["MAT001", "MAT002"],
  "errors": []
}
```

**Action Required**: Create the missing materials in your tenant+company context before retrying import.

### Missing Warehouses
If any warehouses are not found in your tenant+company context, the import will fail with:
```json
{
  "success": false,
  "message": "Cannot import: missing warehouses in system",
  "missingWarehouses": ["WH001", "WH002"],
  "errors": []
}
```

**Action Required**: Create the missing warehouses in your tenant+company context before retrying import.

### Row-Level Errors
For validation or processing errors on specific rows:
```json
{
  "success": false,
  "created": 5,
  "updated": 2,
  "errors": [
    "Line 10: material_code is required",
    "Line 15: Invalid date format"
  ]
}
```

### Constraint Violation (Duplicate Records) ❌
If you try to create a duplicate inventory record:
```json
{
  "success": false,
  "created": 0,
  "updated": 0,
  "errors": [
    "Line 12: CONSTRAINT VIOLATION - Duplicate inventory record detected. The combination (company_id, tenant_id, warehouse_id, material_id, batch_no) must be unique. Material: MAT001, Warehouse: WH001, Batch: BATCH001"
  ]
}
```

**What this means**: An inventory record with the same combination already exists:
- Same company
- Same tenant
- Same warehouse
- Same material
- Same batch number

**Action Required**: 
- Check if the record already exists (it will be updated if found)
- Verify the batch number is correct
- If intentionally updating, the system will update the existing record automatically
- **Important**: The entire import transaction will **rollback** on constraint violation - no records will be created or updated

## Example CSV

See `inventory_import_template.csv` for a sample file with all columns.

## API Endpoint

```
POST /bom/api/inventory/import
Content-Type: multipart/form-data

Parameters:
- file: CSV file
- tenantId: UUID (can be in query param or X-Tenant-Id header)
- companyId: UUID (can be in query param or X-Company-Id header)
```

## Frontend Usage

### Using the Import Component
1. Navigate to Inventory page
2. Click on Import button
3. Select your CSV file
4. Click Upload
5. Review the results:
   - Success status
   - Number of records created/updated
   - List of missing materials/warehouses (if any)
   - Any row-level errors

### Import Result Display
- Green indicator: All records imported successfully
- Red indicator: Import failed - review missing items or errors
- Yellow indicator: Partial success - some records failed

## Best Practices

1. **Validate Data First**
   - Check all material codes exist before importing
   - Check all warehouse codes exist before importing
   - Use test import with small batch first

2. **Batch Processing**
   - For large datasets, split into smaller batches (500-1000 rows)
   - Import in stages to identify issues quickly

3. **Data Quality**
   - Ensure numeric fields contain valid numbers
   - Use ISO date formats for consistency
   - Verify currency codes are valid (ISO 4217)
   - Verify country codes are valid (ISO 3166-1 alpha-2)

4. **Error Recovery**
   - If import fails due to missing materials, create them first
   - Re-import the same file - existing records will be updated
   - Check error messages for specific row issues

5. **Backup**
   - Export existing inventory before large imports
   - Keep source CSV files for audit trail

## Troubleshooting

### Import Button Not Working
- Check file format is CSV
- Verify file size is reasonable (<10MB)
- Check browser console for errors

### All Records Failing Validation
- Verify CSV header matches exactly (case-sensitive)
- Check for extra spaces in column names
- Verify file encoding is UTF-8

### Slow Import Performance
- Reduce batch size
- Check database connection
- Review system resources

## Database Changes Required

Before using the import function, ensure the database has been updated with the new columns. Run the ALTER TABLE queries from `INVENTORY_ALTER_TABLE_QUERIES.sql`.

## Support

For issues or questions:
1. Check this guide
2. Review error messages carefully
3. Verify sample data works
4. Contact system administrator
