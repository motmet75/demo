# Inventory Grid Fields Update

## Summary
Updated InventoryGrid.jsx to include all fields from InventoryEntity.java (excluding ID fields) in the grid columns and export functions.

## Changes Made

### 1. Updated `normalizeInventoryView` Function
Added the following fields to the normalization function:
- `orderToDeduction` - Order to deduction reference
- `userName` - User name who created/modified the record
- `hsCode` - HS Code for customs
- `originType` - Origin type classification
- `originCountry` - Country of origin
- `xformNo` - Transform/Declaration number
- `cdsNo` - CDS (Customs Declaration) number
- `purchaseNo` - Purchase order number
- `materialQuota` - Material quota amount
- `materialQuotaPercentage` - Material quota percentage
- `xformDate` - Transform/Declaration date
- `purchaseDateTime` - Purchase date and time
- `cdsDateTime` - CDS date and time
- `modifiedTime` - Last modification timestamp
- `updatedAt` - Updated timestamp

### 2. Updated DataGrid Columns
Added corresponding column definitions for all the above fields with appropriate:
- Column widths
- Header names
- Data types (number, boolean, string)
- Proper formatting

### 3. Updated Export Functions (XLSX and CSV)
Enhanced the client-side export mapping to include all fields in the exported files:
- All new fields are now included in both XLSX and CSV exports
- Export headers match the field names for clarity
- Both "Export Filtered" and "Export Selected" functions now export complete data

## Fields Excluded (as per requirement)
The following ID fields were intentionally excluded:
- `id` - Primary key UUID (hidden in grid, but used internally)
- `tenantId` - Tenant identifier
- `companyId` - Company identifier  
- `contractId` - Contract UUID reference
- `material_id` - Material foreign key
- `warehouse_id` - Warehouse foreign key

## Complete Field List in Grid
The grid now displays the following fields (in order):
1. Inventory ID (hidden)
2. Material UUID
3. Material Code
4. Material Name
5. Warehouse UUID
6. Warehouse Code
7. Warehouse Name
8. Quantity On Hand
9. Quantity Reserved
10. Quantity Locked
11. Available Quantity
12. Batch Number
13. Contract Code
14. Order To Deduction
15. User Name
16. Unit
17. Unit Price
18. Currency
19. HS Code
20. Origin Type
21. Origin Country
22. Xform No
23. CDS No
24. Purchase No
25. Material Quota
26. Material Quota Percentage
27. Xform Date
28. Purchase Date Time
29. CDS Date Time
30. Expiration Date Time
31. Production Date Time
32. Created At
33. Modified Time
34. Updated At
35. Visible
36. Approved
37. Locked
38. Actions (Edit, Reserve, Release)

## Export Format
Both XLSX and CSV exports now include all 37 data fields with clear column headers.

## Testing Recommendations
1. Verify all fields display correctly in the grid
2. Test XLSX export with filtered data
3. Test CSV export with filtered data
4. Test XLSX export with selected rows
5. Test CSV export with selected rows
6. Verify date/time fields format correctly
7. Check numeric fields (quantities, prices, quotas) display properly
8. Confirm boolean fields (visible, approved, locked) render as expected
