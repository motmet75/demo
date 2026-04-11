import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid, GridActionsCellItem, useGridApiRef } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import CallReceivedIcon from '@mui/icons-material/CallReceived'
import { fetchInventoryView, addStock, updateInventory, reserveInventory, releaseInventory, deleteInventory } from '../../api/inventoryApi'
import { apiFetch, getContextHeaders } from '../../api/client'
import InventoryEditModal from './InventoryEditModal'
import InventoryImport from './InventoryImport'
import InventoryPatchCsv from './InventoryPatchCsv'
import * as XLSX from 'xlsx'

export default function InventoryGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterWarehouse, setFilterWarehouse] = useState('')
  const [filterInventoryUuid, setFilterInventoryUuid] = useState('')
  const [filterCreatedFrom, setFilterCreatedFrom] = useState('')
  const [filterCreatedTo, setFilterCreatedTo] = useState('')
  const [createdRangePreset, setCreatedRangePreset] = useState('')

  const toDatetimeLocal = (d) => { const p = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}` }
  const applyCreatedRangePreset = (preset) => {
    setCreatedRangePreset(preset)
    if (!preset) { setFilterCreatedFrom(''); setFilterCreatedTo(''); return }
    const now = new Date()
    const ts = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const te = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    if (preset === 'today') { setFilterCreatedFrom(toDatetimeLocal(ts)); setFilterCreatedTo(toDatetimeLocal(te)) }
    else if (preset === 'yesterday') { const ys=new Date(ts); ys.setDate(ys.getDate()-1); const ye=new Date(te); ye.setDate(ye.getDate()-1); setFilterCreatedFrom(toDatetimeLocal(ys)); setFilterCreatedTo(toDatetimeLocal(ye)) }
    else if (preset === 'this_week') { const ws=new Date(ts); ws.setDate(ws.getDate()-now.getDay()); setFilterCreatedFrom(toDatetimeLocal(ws)); setFilterCreatedTo(toDatetimeLocal(te)) }
    else if (preset.startsWith('last_')) { const d=parseInt(preset.replace('last_',''),10); const f=new Date(ts); f.setDate(f.getDate()-(d-1)); setFilterCreatedFrom(toDatetimeLocal(f)); setFilterCreatedTo(toDatetimeLocal(te)) }
  }

  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [modalKey, setModalKey] = useState(0)

  const [importOpen, setImportOpen] = useState(false)
  const [patchOpen, setPatchOpen]   = useState(false)

  const apiRef = useGridApiRef()

  // selection for export / bulk delete — v8 format: { type: 'include'|'exclude', ids: Set }
  const [selectionModel, setSelectionModel] = useState({ type: 'include', ids: new Set() })

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
    const quantityTotal = item.quantityTotal ?? item.quantity_total ?? quantityOnHand

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
      quantityTotal,
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

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    if (!window.confirm(`Delete ${selectedIds.length} selected inventory record(s)? This cannot be undone.`)) return
    const failed = []
    for (const id of selectedIds) {
      try {
        await deleteInventory(id)
      } catch (e) {
        console.error('Failed to delete inventory', id, e)
        failed.push(id)
      }
    }
    const deleted = selectedIds.filter(id => !failed.includes(id))
    setRows(prev => prev.filter(r => !deleted.includes(r.id)))
    setSelectionModel({ type: 'include', ids: new Set() })
    if (failed.length > 0) {
      alert(`Deleted ${deleted.length} record(s). Failed to delete ${failed.length} record(s).`)
    } else {
      alert(`Deleted ${deleted.length} inventory record(s) successfully.`)
    }
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
        const res = await apiFetch('/bom/inventory/export', {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...getContextHeaders() }, body: JSON.stringify(payloadIds)
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
        QuantityTotal: r.quantityTotal,
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
    { field: 'inventoryId', headerName: 'Inventory UUID', width: 280, hide: false , flex:1},
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 220, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => openEdit(params.row)} showInMenu={false} disabled={!!saving} />,
      <GridActionsCellItem icon={<LocalHospitalIcon/>} label="Reserve" onClick={() => handleReserve(params.id)} showInMenu={true} disabled={!!saving} />,
      <GridActionsCellItem icon={<CallReceivedIcon/>} label="Release" onClick={() => handleRelease(params.id)} showInMenu={true} disabled={!!saving} />
    ] },
    { field: 'modifiedTime', headerName: 'Modified Time', width: 180 },
    { field: 'visible', headerName: 'Visible', width: 100, type: 'boolean' },
    { field: 'approved', headerName: 'Approved', width: 100, type: 'boolean' },
    { field: 'locked', headerName: 'Locked', width: 100, type: 'boolean' },
    { field: 'materialUuid', headerName: 'Material UUID', width: 240, flex:1 },
    { field: 'materialCode', headerName: 'Material Code', width: 180 },
    { field: 'materialName', headerName: 'Material Name', width: 220},
    { field: 'warehouseUuid', headerName: 'Warehouse UUID', width: 240, flex:1 },
    { field: 'warehouseCode', headerName: 'Warehouse Code', width: 160 },
    { field: 'warehouseName', headerName: 'Warehouse Name', width: 200 },
    { field: 'quantityOnHand', headerName: 'Qty On Hand', width: 140, type: 'number', valueFormatter: (value) => value == null ? '' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 }) },
    { field: 'quantityTotal', headerName: 'Total Qty', width: 140, type: 'number', valueFormatter: (value) => value == null ? '' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 }) },
    { field: 'quantityReserved', headerName: 'Qty Reserved', width: 140, type: 'number', valueFormatter: (value) => value == null ? '' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 }) },
    { field: 'quantityLocked', headerName: 'Qty Locked', width: 140, type: 'number', valueFormatter: (value) => value == null ? '' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 }) },
    { field: 'availableQuantity', headerName: 'Available', width: 140, type: 'number', valueFormatter: (value) => value == null ? '' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 }) },
    { field: 'batchNo', headerName: 'Batch', width: 180 },
    { field: 'contractCode', headerName: 'Contract', width: 150 },
    { field: 'orderToDeduction', headerName: 'Order To Deduction', width: 150 },
    { field: 'userName', headerName: 'User Name', width: 120 },
    { field: 'unit', headerName: 'Unit', width: 100 },
    { field: 'unitPrice', headerName: 'Unit Price', width: 120, type: 'number', valueFormatter: (value) => value == null ? '' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 }) },
    { field: 'currency', headerName: 'Currency', width: 100 },
    { field: 'hsCode', headerName: 'HS Code', width: 120 },
    { field: 'originType', headerName: 'Origin Type', width: 120 },
    { field: 'originCountry', headerName: 'Origin Country', width: 130 },
    { field: 'xformNo', headerName: 'Xform No', width: 120 },
    { field: 'cdsNo', headerName: 'CDS No', width: 120 },
    { field: 'purchaseNo', headerName: 'Purchase No', width: 120 },
    { field: 'materialQuota', headerName: 'Material Quota', width: 140, type: 'number', valueFormatter: (value) => value == null ? '' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 }), hide: true },
    { field: 'materialQuotaPercentage', headerName: 'Quota %', width: 120, type: 'number', valueFormatter: (value) => value == null ? '' : Number(value).toLocaleString(undefined, { maximumFractionDigits: 9 }) },
    { field: 'xformDate', headerName: 'Xform Date', width: 150, hide: true },
    { field: 'purchaseDateTime', headerName: 'Purchase Date', width: 180, hide: true },
    { field: 'cdsDateTime', headerName: 'CDS Date', width: 180, hide: true },
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
    if (filterCreatedFrom || filterCreatedTo) {
      const d = r.createdAt ? new Date(r.createdAt) : null
      if (!d || isNaN(d)) return false
      if (filterCreatedFrom && d < new Date(filterCreatedFrom)) return false
      if (filterCreatedTo   && d > new Date(filterCreatedTo))   return false
    }
    return true
  })

  const filteredIds = new Set(filteredRows.map(r => r.id))
  const selectedIds = selectionModel.type === 'exclude'
    ? filteredRows.map(r => r.id).filter(id => !selectionModel.ids.has(id))
    : Array.from(selectionModel.ids ?? []).filter(id => filteredIds.has(id))

  const handleSelectionModelChange = (model) => {
    if (model && model.type === 'exclude') {
      const excluded = model.ids ?? new Set()
      setSelectionModel({ type: 'include', ids: new Set(filteredRows.map(r => r.id).filter(id => !excluded.has(id))) })
    } else { setSelectionModel(model) }
  }

  return (
    // top-level flex column so grid can flex-grow to fill available space when auto
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Inventory</button>
          <button onClick={() => { setImportOpen(o => !o); setPatchOpen(false) }} disabled={saving}>
            {importOpen ? '✕ Close Import' : 'Import Inventory'}
          </button>
          <button onClick={() => { setPatchOpen(o => !o); setImportOpen(false) }} disabled={saving}
            style={{ background: patchOpen ? '#e65100' : '#1565c0', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', cursor: 'pointer' }}>
            {patchOpen ? '✕ Close Patch' : '✏ Patch Deduction / Quota'}
          </button>
          <button onClick={() => load()} disabled={loading} title="Refresh">🔄 Refresh</button>
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

      {/* Patch CSV section — order_to_deduction & material_quota_percentage */}
      {patchOpen && (
        <div style={{ padding: '8px 12px', backgroundColor: '#fff8e1', borderBottom: '2px solid #ffa726' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <InventoryPatchCsv onPatchComplete={() => { load(); setPatchOpen(false) }} />
            <button onClick={() => setPatchOpen(false)} style={{ marginLeft: 8, flexShrink: 0 }}>Close</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, padding: '0 8px 8px 8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 12 }}>Quick Range</label>
          <select value={createdRangePreset} onChange={e => applyCreatedRangePreset(e.target.value)} style={{ fontSize: 12, padding: '3px 6px', height: 24 }}>
            <option value="">— All —</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this_week">This Week</option>
            <option value="last_7">Last 7 Days</option>
            <option value="last_14">Last 14 Days</option>
            <option value="last_30">Last 30 Days</option>
            <option value="last_60">Last 60 Days</option>
            <option value="last_90">Last 90 Days</option>
          </select>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 12 }}>Created From</label>
          <input type="datetime-local" value={filterCreatedFrom} onChange={e => { setCreatedRangePreset(''); setFilterCreatedFrom(e.target.value) }} style={{ fontSize: 12, padding: '3px 6px' }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <label style={{ fontSize: 12 }}>Created To</label>
          <input type="datetime-local" value={filterCreatedTo} onChange={e => { setCreatedRangePreset(''); setFilterCreatedTo(e.target.value) }} style={{ fontSize: 12, padding: '3px 6px' }} />
        </div>
        <button type="button" onClick={() => { setFilterInventoryUuid(''); setFilterMaterial(''); setFilterWarehouse(''); setFilterCreatedFrom(''); setFilterCreatedTo(''); setCreatedRangePreset('') }} style={{ alignSelf: 'flex-end', fontSize: 12, padding: '4px 10px' }}>Clear</button>
        <div style={{ alignSelf: 'flex-end', color: '#666', fontSize: 12 }}>{filteredRows.length} / {rows.length}</div>
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
          <button type="button" onClick={() => exportRows(selectedIds, 'xlsx')} disabled={selectedIds.length === 0}>Export Selected XLSX</button>
          <button type="button" onClick={() => exportRows(selectedIds, 'csv')} disabled={selectedIds.length === 0}>Export Selected CSV</button>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0}
            style={{ color: selectedIds.length > 0 ? '#d32f2f' : undefined, borderColor: selectedIds.length > 0 ? '#d32f2f' : undefined }}
          >
            Delete Selected ({selectedIds.length})
          </button>
          <div style={{ color: '#333', fontSize: 13 }}>Selected: {selectedIds.length}</div>
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
               pinnedColumns: { left: ['inventoryId'] },
               columns: {
                 columnVisibilityModel: {
                   visible: false,
                   approved: false,
                   locked: false,
                   hsCode: false,
                   originType: false,
                   originCountry: false,
                   xformNo: false,
                   cdsNo: false,
                   purchaseNo: false,
                   materialQuota: false,
                   xformDate: false,
                   purchaseDateTime: false,
                   cdsDateTime: false,
                 }
               }
             }}
             rowSelectionModel={selectionModel}
             onRowSelectionModelChange={handleSelectionModelChange}
           />
         </div>
       </div>

      <InventoryEditModal key={modalKey} open={editOpen} inventory={selected} onClose={closeEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}
