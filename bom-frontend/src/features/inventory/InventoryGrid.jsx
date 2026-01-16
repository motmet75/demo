import React, { useEffect, useState, useCallback } from 'react'
import { DataGrid, GridActionsCellItem } from '@mui/x-data-grid'
import EditIcon from '@mui/icons-material/Edit'
import LocalHospitalIcon from '@mui/icons-material/LocalHospital'
import CallReceivedIcon from '@mui/icons-material/CallReceived'
import { fetchInventory, addStock, updateInventory, reserveInventory, releaseInventory } from '../../api/inventoryApi'
import InventoryEditModal from './InventoryEditModal'

export default function InventoryGrid() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)

  const [editOpen, setEditOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const [saving, setSaving] = useState(false)
  const [modalKey, setModalKey] = useState(0)

  // grid height control: when `auto` grid fills remaining viewport, otherwise uses px value
  const [manualHeight, setManualHeight] = useState(() => {
    try {
      const v = localStorage.getItem('inventory_manual_height')
      return v === null ? false : v === 'true'
    } catch (e) {
      return false
    }
  })
  const [gridHeight, setGridHeight] = useState(() => {
    try {
      const v = localStorage.getItem('inventory_grid_height')
      const n = v == null ? 520 : Number.parseInt(v, 10)
      return Number.isFinite(n) && n > 0 ? n : 520
    } catch (e) {
      return 520
    }
  }) // px when manual

  // persist grid height controls
  useEffect(() => {
    try {
      localStorage.setItem('inventory_manual_height', String(manualHeight))
      localStorage.setItem('inventory_grid_height', String(gridHeight))
    } catch (e) {
      // ignore storage errors
    }
  }, [manualHeight, gridHeight])

  // Normalize incoming inventory objects for the grid
  const normalizeInventory = (item) => {
    if (!item || typeof item !== 'object') return item
    const id = item.id ?? item.uuid ?? item._id ?? null
    const material = item.material ?? {}
    const warehouse = item.warehouse ?? {}

    const materialId = material.id ?? material.uuid ?? material._id ?? item.materialId ?? item.material_id ?? null
    const materialCode = material.materialCode ?? material.code ?? item.materialCode ?? item.material_code ?? null

    const warehouseId = warehouse.id ?? warehouse.uuid ?? warehouse._id ?? item.warehouseId ?? item.warehouse_id ?? null
    const warehouseCode = warehouse.code ?? warehouse.warehouseCode ?? item.warehouseCode ?? item.warehouse_code ?? null

    const quantityOnHand = item.quantityOnHand ?? item.quantity ?? 0
    const quantityReserved = item.quantityLocked ?? item.quantityReserved ?? item.quantity_locked ?? 0

    return {
      // original id for DataGrid; stringify if present
      id: id != null ? String(id) : id,
      uuid: id != null ? String(id) : id,
      materialId: materialId != null ? String(materialId) : materialId,
      materialCode,
      warehouseId: warehouseId != null ? String(warehouseId) : warehouseId,
      warehouseCode,
      quantityOnHand,
      quantityReserved,
      // keep original item for reference
      __raw: item
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchInventory()
      setRows(Array.isArray(data) ? data.map(normalizeInventory) : [])
    } catch (e) {
      console.error('Failed to load inventory', e)
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
      if (payload.id) {
        res = await updateInventory(payload.id, payload)
      } else {
        res = await addStock(payload)
      }

      // Normalize the response into the grid shape
      const norm = normalizeInventory(res)
      const newRow = {
        id: norm.id ?? (payload.id ? String(payload.id) : undefined),
        uuid: norm.id ?? (payload.id ? String(payload.id) : undefined),
        materialId: norm.materialId ?? (payload.materialId ? String(payload.materialId) : (payload.material ? String(payload.material.id) : undefined)),
        materialCode: norm.materialCode ?? payload.materialCode ?? (payload.material ? payload.material.materialCode || payload.material.code : undefined),
        warehouseId: norm.warehouseId ?? (payload.warehouseId ? String(payload.warehouseId) : (payload.warehouse ? String(payload.warehouse.id) : undefined)),
        warehouseCode: norm.warehouseCode ?? payload.warehouseCode ?? (payload.warehouse ? payload.warehouse.code || payload.warehouse.warehouseCode : undefined),
        quantityOnHand: norm.quantityOnHand ?? res.quantityOnHand ?? payload.quantity ?? 0,
        quantityReserved: norm.quantityReserved ?? res.quantityLocked ?? 0
      }

      setRows(prev => {
        const exists = prev.some(r => r.id === newRow.id)
        if (exists) return prev.map(r => (r.id === newRow.id ? newRow : r))
        return [newRow, ...prev]
      })

      setEditOpen(false)
      return newRow
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
      const res = await reserveInventory(id, num)
      setRows(prev => prev.map(r => (r.id === res.id ? ({ ...r, quantityReserved: res.quantityLocked, quantityOnHand: res.quantityOnHand }) : r)))
      alert('Reserved')
    } catch (e) { alert('Reserve failed: ' + (e && e.message ? e.message : 'Unknown')) }
  }

  const handleRelease = async (id) => {
    const qty = prompt('Quantity to release:')
    if (qty == null) return
    const num = Number(qty)
    if (!Number.isFinite(num) || num <= 0) { alert('Invalid quantity'); return }
    try {
      const res = await releaseInventory(id, num)
      setRows(prev => prev.map(r => (r.id === res.id ? ({ ...r, quantityReserved: res.quantityLocked, quantityOnHand: res.quantityOnHand }) : r)))
      alert('Released')
    } catch (e) { alert('Release failed: ' + (e && e.message ? e.message : 'Unknown')) }
  }

  const columns = [
    { field: 'uuid', headerName: 'UUID', width: 220, hide: true },
    { field: 'materialId', headerName: 'Material ID', width: 220 },
    { field: 'materialCode', headerName: 'Material', width: 200 },
    { field: 'warehouseId', headerName: 'Warehouse ID', width: 220 },
    { field: 'warehouseCode', headerName: 'Warehouse', width: 140 },
    { field: 'quantityOnHand', headerName: 'Qty On Hand', width: 160 },
    { field: 'quantityReserved', headerName: 'Qty Reserved', width: 160 },
    { field: 'actions', type: 'actions', headerName: 'Actions', width: 220, getActions: (params) => [
      <GridActionsCellItem icon={<EditIcon/>} label="Edit" onClick={() => openEdit(params.row)} showInMenu={false} disabled={!!saving} />,
      <GridActionsCellItem icon={<LocalHospitalIcon/>} label="Reserve" onClick={() => handleReserve(params.id)} showInMenu={true} disabled={!!saving} />,
      <GridActionsCellItem icon={<CallReceivedIcon/>} label="Release" onClick={() => handleRelease(params.id)} showInMenu={true} disabled={!!saving} />
    ] }
  ]

  return (
    // top-level flex column so grid can flex-grow to fill available space when auto
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8 }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>
        <div>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Inventory</button>
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

      {/* Grid container: flex-grow when auto height, fixed px when manual */}
      <div style={{ flex: manualHeight ? 'none' : 1, height: manualHeight ? `${gridHeight}px` : 'auto', minHeight: 0 }}>
        <div style={{ height: manualHeight ? '100%' : '100%', width: '100%' }}>
          <DataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pageSizeOptions={[10,25,50]}
            sx={{ height: '100%' }}
          />
        </div>
      </div>

      <InventoryEditModal key={modalKey} open={editOpen} inventory={selected} onClose={closeEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}
