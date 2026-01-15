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

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchInventory()
      setRows(Array.isArray(data) ? data : [])
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

      const newRow = {
        id: res.id,
        materialCode: res.material ? res.material.materialCode : payload.materialCode,
        warehouseCode: res.warehouse ? res.warehouse.code : payload.warehouseCode,
        quantityOnHand: res.quantityOnHand || payload.quantity,
        quantityReserved: res.quantityLocked || 0
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
    { field: 'materialCode', headerName: 'Material', width: 200 },
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
    <div style={{ height: '100%', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 8 }}>
        <h2 style={{ margin: 0 }}>Inventory</h2>
        <div>
          <button onClick={() => { setSelected(null); setModalKey(k => k + 1); setEditOpen(true) }} disabled={saving}>Add Inventory</button>
        </div>
      </div>

      <div style={{ height: 520, width: '100%' }}>
        <DataGrid rows={rows} columns={columns} loading={loading} pageSizeOptions={[10,25,50]} />
      </div>

      <InventoryEditModal key={modalKey} open={editOpen} inventory={selected} onClose={closeEdit} onSave={handleSave} saving={saving} />
    </div>
  )
}
