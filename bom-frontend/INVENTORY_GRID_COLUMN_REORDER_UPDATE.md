# Inventory Grid Column Reordering and Freezing Update

## Summary
Updated the InventoryGrid.jsx to freeze the Inventory UUID column and reorder columns so that Actions, Modified Time, Visible, Approved, and Locked appear immediately after the Inventory UUID column.

## Changes Made

### 1. Column Reordering
The columns have been reorganized in the following order:

1. **Inventory UUID** (frozen/pinned)
2. **Actions** (Edit, Reserve, Release)
3. **Modified Time**
4. **Visible**
5. **Approved**
6. **Locked**
7. Material UUID
8. Material Code
9. Material Name
10. (rest of columns...)

### 2. Column Freezing/Pinning
Added `initialState` prop to the DataGrid component:
```javascript
initialState={{
  pinnedColumns: { left: ['inventoryId'] }
}}
```

This freezes the Inventory UUID column to the left side of the grid, making it always visible when scrolling horizontally.

### 3. Header Name Update
Changed the header name from "Inventory ID" to "Inventory UUID" for better clarity.

### 4. Column Visibility
- Set `hide: false` on the inventoryId column (was previously `hide: true`)
- Increased width to 280px to accommodate UUID display

## Benefits

1. **Improved Navigation**: The frozen Inventory UUID column stays visible when scrolling through many columns
2. **Quick Actions Access**: Actions, status fields (visible, approved, locked) and modified time are now immediately visible next to the ID
3. **Better Context**: Users can always see the record identifier while viewing other data
4. **Consistent Layout**: Key metadata fields are grouped together at the start of the grid

## Column Order Overview

**Pinned Section:**
- Inventory UUID (frozen)

**Priority Columns (after UUID):**
- Actions
- Modified Time
- Visible
- Approved
- Locked

**Data Columns:**
- Material information (UUID, Code, Name)
- Warehouse information (UUID, Code, Name)
- Quantities (On Hand, Reserved, Locked, Available)
- Business data (Batch, Contract, Order, User, etc.)
- Financial data (Unit, Price, Currency, Quotas)
- Customs data (HS Code, Origin)
- Document references (Xform, CDS, Purchase)
- Timestamps (Xform Date, Purchase, CDS, Expiration, Production, Created, Updated)

## Testing Recommendations

1. Verify the Inventory UUID column stays frozen when scrolling horizontally
2. Check that Actions, Modified Time, Visible, Approved, and Locked columns appear in order after the Inventory UUID
3. Test that the Actions menu (Edit, Reserve, Release) works correctly
4. Confirm all boolean columns (Visible, Approved, Locked) display properly as checkboxes
5. Verify the column order matches requirements
6. Test export functions to ensure they still export all columns correctly
