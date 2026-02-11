# Inventory Grid - Filter Inventory UUID Feature

## Summary
Added a new filter field "Filter Inventory UUID" to the InventoryGrid component, allowing users to search and filter inventory records by their UUID.

## Changes Made

### 1. Added State Variable
Added `filterInventoryUuid` state variable to track the filter input:
```javascript
const [filterInventoryUuid, setFilterInventoryUuid] = useState('')
```

### 2. Updated Filter Logic
Enhanced the `filteredRows` filter function to include inventory UUID filtering:
```javascript
const filteredRows = rows.filter(r => {
  if (filterMaterial && filterMaterial.trim() !== '' && !(r.materialCode || '').toLowerCase().includes(filterMaterial.trim().toLowerCase())) return false
  if (filterWarehouse && filterWarehouse.trim() !== '' && !(r.warehouseCode || '').toLowerCase().includes(filterWarehouse.trim().toLowerCase())) return false
  if (filterInventoryUuid && filterInventoryUuid.trim() !== '' && !(r.inventoryId || '').toLowerCase().includes(filterInventoryUuid.trim().toLowerCase())) return false
  return true
})
```

The filter performs a case-insensitive substring match on the inventory UUID.

### 3. Added UI Filter Input
Added a new input field for filtering by Inventory UUID, positioned as the first filter (leftmost):
```javascript
<div>
  <label style={{ fontSize: 12 }}>Filter Inventory UUID:</label><br />
  <input value={filterInventoryUuid} onChange={e => setFilterInventoryUuid(e.target.value)} style={{ width: 280 }} />
</div>
```

The input field has a width of 280px to accommodate UUID values.

## Filter Order
The filters now appear in this order from left to right:
1. **Filter Inventory UUID** (new, 280px width)
2. Filter Material
3. Filter Warehouse

## Features

### Search Capabilities
- **Case-insensitive**: Searches work regardless of letter case
- **Substring matching**: Finds partial UUID matches
- **Real-time filtering**: Grid updates as you type
- **Combinable**: Can be used together with Material and Warehouse filters

### User Experience
- Wider input field (280px) to show more of the UUID
- Positioned first for quick access to specific inventory records
- Works seamlessly with existing filters
- No backend changes required (client-side filtering)

## Use Cases

1. **Direct UUID Lookup**: Paste a complete UUID to find a specific inventory record
2. **Partial UUID Search**: Type part of a UUID to narrow down results
3. **Combined Filtering**: Use with material and warehouse filters for precise searches
4. **Export Filtering**: Filtered results can be exported using the export buttons

## Technical Details

- **Filter Type**: Client-side substring match
- **Case Sensitivity**: Case-insensitive (converted to lowercase)
- **Performance**: Filters in-memory data, instant response
- **Compatibility**: Works with all existing features (export, selection, etc.)

## Example Usage

1. **Find specific record**: Copy UUID from another system, paste into filter
2. **Search by prefix**: Type first few characters of UUID
3. **Combine filters**: 
   - UUID starts with "abc..." 
   - Material contains "steel"
   - Warehouse is "WH01"
4. **Export filtered**: Filter by UUID pattern, then export results

## Testing Recommendations

1. Test with full UUID string
2. Test with partial UUID (first few characters)
3. Test case-insensitive matching (upper/lower case)
4. Test combined with material filter
5. Test combined with warehouse filter
6. Test combined with all filters at once
7. Test export functionality with UUID-filtered results
8. Test that clearing the filter shows all records again
