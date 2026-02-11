import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid, GridActionsCellItem, useGridApiRef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import CallReceivedIcon from '@mui/icons-material/CallReceived'
import { fetchInventoryView, addStock, updateInventory, reserveInventory, releaseInventory } from '../../api/inventoryApi'
import InventoryEditModal from './InventoryEditModal'
import InventoryImport from './InventoryImport'
import * as XLSX from 'xlsx'

export default function InventoryGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('')
  const [filterInventoryUuid, setFilterInventoryUuid] = useState('')

  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [modalKey, setModalKey] = useState(0)

  const [importOpen, setImportOpen] = useState(false)

  const apiRef = useGridApiRef()

  // selection for export
  const [selectionModel, setSelectionModel] = useState([])

  // normalize selection shapes (MUI versions return different shapes)
  const normalizeSelection = (sel) => {
    if (sel == null) return []
    try {
      if (Array.isArray(sel)) return sel.map(s => {
        if (s == null) return ''
        if (typeof s === 'object') {
          // objects may have id or rowId
          if ('id' in s) return String(s.id)
          if ('rowId' in s) return String(s.rowId)
          // maybe [id, ...] tuple
          if (Array.isArray(s) && s.length > 0) return String(s[0])
          try { return String(s.toString()) } catch { return JSON.stringify(s) }
        }
        return String(s)
      })
      // Map -> take keys
      if (sel instanceof Map) return Array.from(sel.keys()).map(k => String(k))
      // plain object map { id: true }
      if (typeof sel === 'object' && !sel[Symbol.iterator]) {
        return Object.keys(sel).filter(k => !!sel[k]).map(String)
      }
      // iterable (Set of ids, or entries)
      if (typeof sel === 'object' && sel[Symbol.iterator]) {
        const arr = Array.from(sel)
        // entries like [[id, true], [id2, true]] -> take first element
        if (arr.length > 0 && Array.isArray(arr[0]) && arr[0].length >= 1) {
          return arr.map(e => String(e[0]))
        }
        return arr.map(s => String(s))
      }
      return [String(sel)]
    } catch {
      return Array.isArray(sel) ? sel.map(s => String(s)) : [String(sel)]
    }
  }

  // grid height control: when `auto` grid fills remaining viewport, otherwise uses px value
  const [manualHeight, setManualHeight] = useState(() => {
    try {
      const v = localStorage.getItem('inventory_manual_height')
      return v === null ? false : v === 'true'
    } catch {
      return false
    }
  })
  const [gridHeight, setGridHeight] = useState(() => {
    try {
      const v = localStorage.getItem('inventory_grid_height')
      const n = v == null ? 520 : Number.parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? n : 520
    } catch {
      return 520
    }
  }) // px when manual

  // persist grid height controls
  useEffect(() => {
    try {
      localStorage.setItem('inventory_manual_height', String(manualHeight))
      localStorage.setItem('inventory_grid_height', String(gridHeight))
    } catch {
      // ignore storage errors
    }
  }, [manualHeight, gridHeight])

  // Normalize incoming inventory view DTOs for the grid
  const normalizeInventoryView = (item) => {
    if (!item || typeof item !== 'object') return item

    const inventoryId = item.inventoryId ?? item.id ?? null
    const materialId = item.materialId ?? null
    const materialCode = item.materialCode ?? item.material_code ?? ''
    const materialName = item.materialName ?? item.materialName ?? ''

    const warehouseId = item.warehouseId ?? null
    const warehouseCode = item.warehouseCode ?? item.warehouse_code ?? ''
    const warehouseName = item.warehouseName ?? item.warehouseName ?? ''

    const quantityOnHand = item.quantityOnHand ?? 0
    const quantityReserved = item.quantityReserved ?? 0
    const quantityLocked = item.quantityLocked ?? 0

    return {
      id: inventoryId != null ? String(inventoryId) : undefined,
      inventoryId: inventoryId != null ? String(inventoryId) : undefined,
      materialId: materialId != null ? String(materialId) : undefined,
      materialUuid: item.material && (item.material.id ?? item.material.uuid) ? String(item.material.id ?? item.material.uuid) : (item.materialId ? String(item.materialId) : undefined),
      materialCode,
      materialName,
      warehouseId: warehouseId != null ? String(warehouseId) : undefined,
      warehouseUuid: item.warehouse && (item.warehouse.id ?? item.warehouse.uuid) ? String(item.warehouse.id ?? item.warehouse.uuid) : (item.warehouseId ? String(item.warehouseId) : undefined),
      warehouseCode,
      warehouseName,
      quantityOnHand,
      quantityReserved,
      quantityLocked,
      availableQuantity: Number(quantityOnHand) - Number(quantityLocked),
      batchNo: item.batchNo || item.batch_no || '',
      contractCode: item.contractCode || '',
      orderToDeduction: item.orderToDeduction || '',
      userName: item.userName || '',
      unit: item.unit || 'pcs',
      unitPrice: item.unitPrice ?? 0,
      currency: item.currency || 'USD',
      hsCode: item.hsCode || '',
      originType: item.originType || '',
      originCountry: item.originCountry || '',
      xformNo: item.xformNo || '',
      cdsNo: item.cdsNo || '',
      purchaseNo: item.purchaseNo || '',
      materialQuota: item.materialQuota ?? 0,
      materialQuotaPercentage: item.materialQuotaPercentage ?? 0,
      xformDate: item.xformDate || null,
      purchaseDateTime: item.purchaseDateTime || null,
      cdsDateTime: item.cdsDateTime || null,
      expirationDateTime: item.expirationDateTime || item.expiration_date || null,
      productionDateTime: item.productionDateTime || item.production_date || null,
      createdAt: item.createdAt || null,
      modifiedTime: item.modifiedTime || null,
      updatedAt: item.updatedAt || null,
      visible: item.visible ?? true,
      approved: item.approved ?? false,
      locked: item.locked ?? false,
      __raw: item
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchInventoryView()
      const list = Array.isArray(data) ? data.map(normalizeInventoryView) : []
      setRows(list)
    } catch {
      console.error('Failed to load inventory view')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openEdit = (row) => { setSelected(JSON.parse(JSON.stringify(row))); setModalKey(k => k + 1); setEditOpen(true) }
  const closeEdit = () => { setEditOpen(false); setSelected(null) }

  const handleSave = async (payload) => {
    if (saving) return
    setSaving(true)
    try {
      let res
      const isEdit = !!(payload.id)
      
      if (isEdit) {
        // Edit existing inventory - use PUT which REPLACES quantity (not adds)
        res = await updateInventory(payload.id, payload)
      } else {
        // Add new inventory - use POST which creates or adds to existing batch
        res = await addStock(payload)
      }

      // Reload grid data to reflect the saved changes
      await load()
      
      // Close ALL dialogs after successful save and grid refresh
      setEditOpen(false)
      setSelected(null)
      setImportOpen(false)
      
      return res
    } catch (err) {
      console.error('Save failed', err)
      alert(err.message || 'Save failed')
      throw err
    } finally {
      setSaving(false)
    }
  }

  const handleReserve = async (id) => {
    const qty = prompt('Quantity to reserve:')
    if (qty == null) return
    const num = Number(qty)
    if (!Number.isFinite(num) || num <= 0) { alert('Invalid quantity'); return }
    try {
      await reserveInventory(id, num)
      await load()
      alert('Reserved')
    } catch { alert('Reserve failed') }
  }

  const handleRelease = async (id) => {
    const qty = prompt('Quantity to release:')
    if (qty == null) return
    const num = Number(qty)
    if (!Number.isFinite(num) || num <= 0) { alert('Invalid quantity'); return }
    try {
      await releaseInventory(id, num)
      await load()
      alert('Released')
    } catch { alert('Release failed') }
  }

  const exportRows = async (selectedIds, format = 'xlsx') => {
    try {
      // Build rowsToExport and payloadIds (UUIDs)
      let rowsToExport = []
      let payloadIds = []

      // 1) If an apiRef is available, try to resolve the selected rows from the grid API (returns a Map of selected rows)
      try {
        if (apiRef && apiRef.current && typeof apiRef.current.getSelectedRows === 'function') {
          const selectedMap = apiRef.current.getSelectedRows()
          if (selectedMap && selectedMap.size > 0) {
            const arr = Array.from(selectedMap.values())
            rowsToExport = arr
            payloadIds = arr.map(r => (r && (r.inventoryId || r.id) ? String(r.inventoryId || r.id) : undefined)).filter(Boolean)
          }
        }
      } catch {
        // ignore and continue to other fallbacks
      }

      // 2) if not resolved via apiRef, use provided selectedIds (e.g., from selectionModel) to filter
      if ((!payloadIds || payloadIds.length === 0)) {
        if (selectedIds && selectedIds.length > 0) {
          console.debug('exportRows: using selectedIds fallback', selectedIds)
          rowsToExport = rows.filter(r => selectedIds.includes(r.id) || selectedIds.includes(r.inventoryId) || selectedIds.includes(r.materialUuid) || selectedIds.includes(r.warehouseUuid))
        } else {
          rowsToExport = rows
        }
        payloadIds = rowsToExport.map(r => r.inventoryId).filter(Boolean)
      }

      // Try server-side export if backend supports it
      try {
        const res = await fetch('/bom/api/inventory/export', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payloadIds)
        })
        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || 'Export failed')
        }
        const blob = await res.blob()
        const cd = res.headers.get('Content-Disposition') || res.headers.get('content-disposition')
        let filename = 'inventory_export.xlsx'
        if (cd) {
          const match = /filename="?([^";]+)"?/.exec(cd)
          if (match && match[1]) filename = match[1]
        }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        return
      } catch {
        // server export failed or not available -> fallback to client-side generation
        console.warn('Server export failed, falling back to client-side generation')
      }

      // client-side generation using XLSX
      const data = rowsToExport.map(r => ({
        InventoryId: r.inventoryId,
        MaterialUUID: r.materialUuid,
        MaterialCode: r.materialCode,
        MaterialName: r.materialName,
        WarehouseUUID: r.warehouseUuid,
        WarehouseCode: r.warehouseCode,
        WarehouseName: r.warehouseName,
        Batch: r.batchNo,
        QuantityOnHand: r.quantityOnHand,
        QuantityReserved: r.quantityReserved,
        QuantityLocked: r.quantityLocked,
        Available: r.availableQuantity,
        ContractCode: r.contractCode,
        OrderToDeduction: r.orderToDeduction,
        UserName: r.userName,
        Unit: r.unit,
        UnitPrice: r.unitPrice,
        Currency: r.currency,
        HSCode: r.hsCode,
        OriginType: r.originType,
        OriginCountry: r.originCountry,
        XformNo: r.xformNo,
        CDSNo: r.cdsNo,
        PurchaseNo: r.purchaseNo,
        MaterialQuota: r.materialQuota,
        MaterialQuotaPercentage: r.materialQuotaPercentage,
        XformDate: r.xformDate,
        PurchaseDateTime: r.purchaseDateTime,
        CDSDateTime: r.cdsDateTime,
        Expiration: r.expirationDateTime,
        Production: r.productionDateTime,
        CreatedAt: r.createdAt,
        ModifiedTime: r.modifiedTime,
        UpdatedAt: r.updatedAt,
        Visible: r.visible,
        Approved: r.approved,
        Locked: r.locked
      }))

      const worksheet = XLSX.utils.json_to_sheet(data)
      if (format === 'csv') {
        const csv = XLSX.utils.sheet_to_csv(worksheet)
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'inventory_export.csv'
        document.body.appendChild(a)
        a.click()
        a.remove()
        URL.revokeObjectURL(url)
        return
      }

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, worksheet, 'Inventory')
      const wbout = XLSX.write(wb, { bookType: format === 'csv' ? 'csv' : 'xlsx', type: 'array' })
      const blob = new Blob([wbout], { type: 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = format === 'csv' ? 'inventory_export.csv' : 'inventory_export.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed', e)
      alert('Export failed: ' + (e && e.message ? e.message : 'Unknown error'))
    }
  }

  const columns = [
    { field: 'inventoryId', headerName: 'Inventory UUID', width: 280, hide: false },
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 220, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => openEdit(params.row)} showInMenu={false} disabled={!!saving} />,
      <GridActionsCellItem icon={<LocalHospitalIcon/>} label="Reserve" onClick={() => handleReserve(params.id)} showInMenu={true} disabled={!!saving} />,
      <GridActionsCellItem icon={<CallReceivedIcon/>} label="Release" onClick={() => handleRelease(params.id)} showInMenu={true} disabled={!!saving} />
    ] },
    { field: 'modifiedTime', headerName: 'Modified Time', width: 180 },
    { field: 'visible', headerName: 'Visible', width: 100, type: 'boolean' },
    { field: 'approved', headerName: 'Approved', width: 100, type: 'boolean' },
    { field: 'locked', headerName: 'Locked', width: 100, type: 'boolean' },
    { field: 'materialUuid', headerName: 'Material UUID', width: 240 },
    { field: 'materialCode', headerName: 'Material Code', width: 180 },
    { field: 'materialName', headerName: 'Material Name', width: 220, flex: 1 },
    { field: 'warehouseUuid', headerName: 'Warehouse UUID', width: 240 },
    { field: 'warehouseCode', headerName: 'Warehouse Code', width: 160 },
    { field: 'warehouseName', headerName: 'Warehouse Name', width: 200 },
    { field: 'quantityOnHand', headerName: 'Qty On Hand', width: 140, type: 'number' },
    { field: 'quantityReserved', headerName: 'Qty Reserved', width: 140, type: 'number' },
    { field: 'quantityLocked', headerName: 'Qty Locked', width: 140, type: 'number' },
    { field: 'availableQuantity', headerName: 'Available', width: 140, type: 'number' },
    { field: 'batchNo', headerName: 'Batch', width: 180 },
    { field: 'contractCode', headerName: 'Contract', width: 150 },
    { field: 'orderToDeduction', headerName: 'Order To Deduction', width: 150 },
    { field: 'userName', headerName: 'User Name', width: 120 },
    { field: 'unit', headerName: 'Unit', width: 100 },
    { field: 'unitPrice', headerName: 'Unit Price', width: 120, type: 'number' },
    { field: 'currency', headerName: 'Currency', width: 100 },
    { field: 'hsCode', headerName: 'HS Code', width: 120 },
    { field: 'originType', headerName: 'Origin Type', width: 120 },
    { field: 'originCountry', headerName: 'Origin Country', width: 130 },
    { field: 'xformNo', headerName: 'Xform No', width: 120 },
    { field: 'cdsNo', headerName: 'CDS No', width: 120 },
    { field: 'purchaseNo', headerName: 'Purchase No', width: 120 },
    { field: 'materialQuota', headerName: 'Material Quota', width: 140, type: 'number' },
    { field: 'materialQuotaPercentage', headerName: 'Quota %', width: 120, type: 'number' },
    { field: 'xformDate', headerName: 'Xform Date', width: 150 },
    { field: 'purchaseDateTime', headerName: 'Purchase Date', width: 180 },
    { field: 'cdsDateTime', headerName: 'CDS Date', width: 180 },
    { field: 'expirationDateTime', headerName: 'Expiration', width: 180 },
    { field: 'productionDateTime', headerName: 'Production', width: 180 },
    { field: 'createdAt', headerName: 'Created At', width: 180 },
    { field: 'updatedAt', headerName: 'Updated At', width: 180 }
  ]

  // apply simple client-side filters
  const filteredRows = rows.filter(r => {
    if (filterMaterial && filterMaterial.trim() !== '' && !(r.materialCode || '').toLowerCase().includes(filterMaterial.trim().toLowerCase())) return false
    if (filterWarehouse && filterWarehouse.trim() !== '' && !(r.warehouseCode || '').toLowerCase().includes(filterWarehouse.trim().toLowerCase())) return false
    if (filterInventoryUuid && filterInventoryUuid.trim() !== '' && !(r.inventoryId || '').toLowerCase().includes(filterInventoryUuid.trim().toLowerCase())) return false
    return true
  })

  return (
    // top-level flex column so grid can flex-grow to fill available space when auto
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Inventory</button>
          <button onClick={() => setImportOpen(true)} disabled={saving}>Import Inventory</button>
          <h2 style={{ margin: 0 }}>Inventory</h2>
        </div>
        <div />
      </div>

      {/* Import section - show when importOpen is true */}
      {importOpen && (
        <div style={{ padding: '8px', backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <InventoryImport onImportComplete={() => { load(); setImportOpen(false) }} />
            <button onClick={() => setImportOpen(false)} style={{ marginLeft: 8 }}>Close</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, padding: '0 8px 8px 8px' }}>
        <div>
          <label style={{ fontSize: 12 }}>Filter Inventory UUID:</label><br />
          <input value={filterInventoryUuid} onChange={e => setFilterInventoryUuid(e.target.value)} style={{ width: 280 }} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Filter Material:</label><br />
          <input value={filterMaterial} onChange={e => setFilterMaterial(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 12 }}>Filter Warehouse:</label><br />
          <input value={filterWarehouse} onChange={e => setFilterWarehouse(e.target.value)} />
        </div>
      </div>

      {/* Height control: toggle auto/manual and slider/number for manual px height */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={!manualHeight} onChange={(e) => setManualHeight(!e.target.checked)} /> Auto height
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12 }}>Manual height (px):</span>
            <input
              type="range"
              min={200}
              max={1200}
              step={10}
              value={gridHeight}
              onChange={(e) => setGridHeight(Number(e.target.value))}
              disabled={!manualHeight}
            />
            <input
              type="number"
              value={gridHeight}
              onChange={(e) => setGridHeight(Number(e.target.value || 0))}
              disabled={!manualHeight}
              style={{ width: 80 }}
            />
          </label>
        </div>
      </div>

      {/* Export controls and top small toolbar */}
      <div style={{ padding: '0 8px 8px 8px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
          <button type="button" onClick={() => exportRows(filteredRows.map(r => r.id), 'xlsx')}>Export Filtered XLSX</button>
          <button type="button" onClick={() => exportRows(filteredRows.map(r => r.id), 'csv')}>Export Filtered CSV</button>
          <button type="button" onClick={() => exportRows(selectionModel, 'xlsx')} disabled={(selectionModel?.length || 0) === 0}>Export Selected XLSX</button>
          <button type="button" onClick={() => exportRows(selectionModel, 'csv')} disabled={(selectionModel?.length || 0) === 0}>Export Selected CSV</button>
          <div style={{ color: '#333', fontSize: 13 }}>
            Selected: {selectionModel ? selectionModel.length : 0}
          </div>
        </div>
      </div>

      {/* Grid container: flex-grow when auto height, fixed px when manual */}
      <div style={{ flex: manualHeight ? 'none' : 1, height: manualHeight ? `${gridHeight}px` : 'auto', minHeight: 0 }}>
        <div style={{ height: manualHeight ? '100%' : '100%', width: '100%' }}>
          <DataGrid
             rows={filteredRows}
             columns={columns}
             loading={loading}
             pageSizeOptions={[10,25,50]}
             sx={{ height: '100%' }}
             checkboxSelection={true}
             apiRef={apiRef}
             initialState={{
               pinnedColumns: { left: ['inventoryId'] }
             }}
             // controlled selectionModel with normalization to handle different DataGrid shapes
             selectionModel={selectionModel}
             onRowSelectionModelChange={(newSel) => { const norm = normalizeSelection(newSel); console.debug('onRowSelectionModelChange ->', newSel, 'normalized ->', norm); setSelectionModel(norm) }}
             onSelectionModelChange={(newSel) => { const norm = normalizeSelection(newSel); console.debug('onSelectionModelChange ->', newSel, 'normalized ->', norm); setSelectionModel(norm) }}
           />
         </div>
       </div>

      <InventoryEditModal key={modalKey} open={editOpen} inventory={selected} onClose={closeEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}
