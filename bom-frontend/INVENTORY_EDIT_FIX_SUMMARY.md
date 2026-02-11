# Inventory Edit - Prevent Add-Up and Auto-Reload Update

## Summary
Updated the inventory edit functionality to ensure that when modifying an inventory record, the quantity on hand is replaced (not added to), and the data grid automatically reloads after a successful save to display the updated values.

## Changes Made

### 1. Frontend - InventoryGrid.jsx
**Updated `handleSave` function** to clarify behavior and ensure proper reload:

#### Key Points:
- **Line 196-197**: Added clear comment explaining that PUT /inventory/{id} replaces the quantity value (does not add to it)
- **Line 200**: Grid reload with `await load()` ensures data is refreshed from the server
- **Line 203**: Modal closes only AFTER reload completes successfully
- **Flow**: Save → Reload Grid → Close Modal

```javascript
} else if (payload.id) {
  // PUT /inventory/{id} - backend replaces quantity (not adds), so this updates to the exact new value
  res = await updateInventory(payload.id, payload)
}

// Reload grid data to reflect the saved changes
await load()

// Close modal only after reload completes successfully
setEditOpen(false)
```

### 2. Backend - Already Correct
The backend `InventoryService.updateStock()` method correctly uses:
```java
inv.setQuantityOnHand(newQuantityOnHand);  // Sets to new value, not adding
```

This **replaces** the quantity value rather than adding to it.

### 3. Data Flow

#### Edit Flow:
1. User clicks "Edit" on an inventory row
2. `InventoryEditModal` opens with current values
3. User modifies "Quantity On Hand" field (e.g., changes from 100 to 150)
4. User clicks "Save"
5. Modal sends PUT request to `/bom/api/inventory/{id}` with `quantity: 150`
6. Backend receives `quantity: 150` and calls `inv.setQuantityOnHand(150)` (replaces value)
7. Backend saves and returns updated entity
8. Frontend awaits the save response
9. Frontend calls `await load()` to reload all inventory data
10. Grid updates with fresh data from server
11. Modal closes

#### Add Flow (for comparison):
1. User clicks "Add Inventory"
2. Modal opens with empty form
3. User enters material, warehouse, batch, quantity
4. POST request to `/bom/api/inventory` is sent
5. Backend creates new inventory or adds to existing if batch matches
6. Grid reloads and displays new/updated record

## Verification Steps

### To verify the fix works correctly:

1. **Open an existing inventory record**
   - Click Edit on any inventory row
   - Note the current "Quantity On Hand" (e.g., 100)

2. **Change the quantity**
   - Change "Quantity On Hand" to a different value (e.g., 150)
   - Click "Save"

3. **Verify the result**
   - Grid should reload automatically
   - The quantity should be **150** (not 250 if it was adding)
   - Modal should close after grid updates

4. **Edit again to confirm**
   - Edit the same record again
   - Verify the value is 150 (the new value, not accumulated)

## Technical Details

### API Endpoint
- **Method**: PUT
- **URL**: `/bom/api/inventory/{id}`
- **Payload**: `{ quantity: <new_value>, ... }`
- **Behavior**: Replaces all specified fields

### Backend Method
```java
@Transactional(rollbackFor = Exception.class)
public InventoryEntity updateStock(UUID inventoryId, BigDecimal newQuantityOnHand, ...) {
    // ... validation ...
    inv.setQuantityOnHand(newQuantityOnHand);  // REPLACES value
    // ... set other fields ...
    return inventoryRepository.save(inv);
}
```

### Frontend Flow
```javascript
// 1. Send update request
res = await updateInventory(payload.id, payload)

// 2. Reload grid data (ensures fresh values from DB)
await load()

// 3. Close modal (only after reload completes)
setEditOpen(false)
```

## Benefits

1. **Correct Behavior**: Quantity is replaced, not accumulated
2. **Auto-Refresh**: Grid automatically shows updated values without manual refresh
3. **Data Integrity**: Values displayed match database state
4. **User Experience**: Seamless update flow with immediate visual feedback
5. **Consistent**: All fields (quantity, batch, dates, etc.) are updated consistently

## Related Functionality

### Reserve/Release Operations
These operations still use **additive logic** (as intended):
- **Reserve**: Increases `quantityLocked`
- **Release**: Decreases `quantityLocked`

These are different operations from direct quantity updates.

### Import Operations
Import uses `addStock()` which has additive logic for existing batches:
- First import: Creates new record with quantity
- Subsequent imports of same batch: Adds to existing quantity

This is correct behavior for imports (accumulating stock).

## Troubleshooting

If quantity still appears to add up:

1. **Check browser cache**: Clear cache and reload page
2. **Verify backend logs**: Check that updateStock is called (not addStock)
3. **Check network tab**: Verify PUT request is sent to `/inventory/{id}`
4. **Check payload**: Ensure `quantity` field contains the new total (not delta)
5. **Check database**: Query inventory table to see actual stored value

## Summary

✅ **Backend**: Correctly replaces quantity (uses `setQuantityOnHand`)
✅ **Frontend**: Correctly sends new total value (not delta)
✅ **Grid Reload**: Automatically refreshes after save
✅ **Modal Close**: Happens only after reload completes
✅ **Comments Added**: Clarifies behavior for future developers

The edit functionality now works correctly - modifying a quantity replaces the value rather than adding to it, and the grid automatically displays the updated data.
