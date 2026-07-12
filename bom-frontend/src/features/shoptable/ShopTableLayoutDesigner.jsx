import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import MenuItem from '@mui/material/MenuItem'
import Paper from '@mui/material/Paper'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import TableBarIcon from '@mui/icons-material/TableBar'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import EventSeatIcon from '@mui/icons-material/EventSeat'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import {
  createShopTableDrawing,
  deleteShopTableDrawing,
  fetchShopTableDrawings,
  updateShopTableDrawing,
} from '../../api/shopApi'

const STAGE_WIDTH = 960
const STAGE_HEIGHT = 430

const makeId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const activeOrders = (table) => Array.isArray(table?.activeOrders) ? table.activeOrders : []
const orderNumberText = (orders) => orders.map(order => order.orderNumber != null ? `#${order.orderNumber}` : order.orderCode).filter(Boolean).join(', ')

function defaultLayout() {
  return {
    id: makeId(),
    name: 'Main room',
    persisted: false,
    items: [
      { id: makeId(), type: 'wall', x: 40, y: 28, w: 410, h: 16 },
      { id: makeId(), type: 'door', x: 480, y: 20, w: 92, h: 28 },
    ],
  }
}

function entityToLayout(entity) {
  let parsed = {}
  try {
    parsed = entity?.layoutJson ? JSON.parse(entity.layoutJson) : {}
  } catch {
    parsed = {}
  }
  return {
    id: String(entity.id),
    name: entity.drawingName || 'Drawing',
    persisted: true,
    items: Array.isArray(parsed.items) ? parsed.items : [],
  }
}

function payloadForLayout(layout) {
  return {
    drawingName: (layout.name || 'Untitled drawing').trim() || 'Untitled drawing',
    layoutJson: JSON.stringify({ items: layout.items || [] }),
  }
}

function apiMessage(data, fallback) {
  return (data && (data.message || data.error)) || (typeof data === 'string' ? data : null) || fallback
}

export default function ShopTableLayoutDesigner({ tables = [] }) {
  const stageRef = useRef(null)
  const [layouts, setLayouts] = useState([defaultLayout()])
  const [selectedLayoutId, setSelectedLayoutId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [dragging, setDragging] = useState(null)
  const [savedText, setSavedText] = useState('')
  const [loadingDrawings, setLoadingDrawings] = useState(false)
  const [savingDrawing, setSavingDrawing] = useState(false)
  const [drawingError, setDrawingError] = useState('')

  const loadDrawings = useCallback(async () => {
    setLoadingDrawings(true)
    setDrawingError('')
    try {
      const { res, data } = await fetchShopTableDrawings()
      if (!res.ok) throw new Error(apiMessage(data, 'Failed to load drawings'))
      const next = Array.isArray(data) && data.length ? data.map(entityToLayout) : [defaultLayout()]
      setLayouts(next)
      setSelectedLayoutId(next[0]?.id || '')
      setSelectedItemId('')
    } catch (e) {
      setDrawingError(e.message || 'Failed to load drawings')
      const fallback = [defaultLayout()]
      setLayouts(fallback)
      setSelectedLayoutId(fallback[0].id)
    } finally {
      setLoadingDrawings(false)
    }
  }, [])

  useEffect(() => { loadDrawings() }, [loadDrawings])

  useEffect(() => {
    if (!savedText) return undefined
    const timer = window.setTimeout(() => setSavedText(''), 1600)
    return () => window.clearTimeout(timer)
  }, [savedText])

  const tableMap = useMemo(() => new Map(tables.map(table => [String(table.id), table])), [tables])
  const selectedLayout = layouts.find(layout => layout.id === selectedLayoutId) || layouts[0]
  const items = selectedLayout?.items || []
  const selectedItem = items.find(item => item.id === selectedItemId) || null

  const updateLayout = (patcher) => {
    setLayouts(prev => prev.map(layout => {
      if (layout.id !== selectedLayout?.id) return layout
      return typeof patcher === 'function' ? patcher(layout) : { ...layout, ...patcher }
    }))
  }

  const updateItem = (itemId, patch) => {
    updateLayout(layout => ({
      ...layout,
      items: (layout.items || []).map(item => item.id === itemId ? { ...item, ...patch } : item),
    }))
  }

  const addItem = (type, extra = {}) => {
    if (!selectedLayout) return
    const count = items.length
    const base = {
      id: makeId(),
      type,
      x: 72 + ((count * 36) % 520),
      y: 78 + ((count * 28) % 260),
      w: 92,
      h: 72,
      ...extra,
    }
    if (type === 'wall') Object.assign(base, { w: 210, h: 16 })
    if (type === 'door') Object.assign(base, { w: 84, h: 28 })
    if (type === 'chair') Object.assign(base, { w: 28, h: 28 })
    if (type === 'table') Object.assign(base, { tableId: '', shape: 'square', chairs: 4 })
    updateLayout(layout => ({ ...layout, items: [...(layout.items || []), base] }))
    setSelectedItemId(base.id)
  }

  const createDrawing = () => {
    const layout = { ...defaultLayout(), name: `Drawing ${layouts.length + 1}`, items: [] }
    setLayouts(prev => [...prev, layout])
    setSelectedLayoutId(layout.id)
    setSelectedItemId('')
    setDrawingError('')
  }

  const deleteDrawing = async () => {
    if (!selectedLayout) return
    if (!window.confirm(`Delete drawing "${selectedLayout.name}"?`)) return

    setSavingDrawing(true)
    setDrawingError('')
    try {
      if (selectedLayout.persisted) {
        const { res, data } = await deleteShopTableDrawing(selectedLayout.id)
        if (!res.ok) throw new Error(apiMessage(data, 'Failed to delete drawing'))
      }
      const next = layouts.filter(layout => layout.id !== selectedLayout.id)
      const finalLayouts = next.length ? next : [defaultLayout()]
      setLayouts(finalLayouts)
      setSelectedLayoutId(finalLayouts[0].id)
      setSelectedItemId('')
      setSavedText('Deleted')
    } catch (e) {
      setDrawingError(e.message || 'Failed to delete drawing')
    } finally {
      setSavingDrawing(false)
    }
  }

  const saveDrawing = async () => {
    if (!selectedLayout) return
    setSavingDrawing(true)
    setDrawingError('')
    try {
      const payload = payloadForLayout(selectedLayout)
      const response = selectedLayout.persisted
        ? await updateShopTableDrawing(selectedLayout.id, payload)
        : await createShopTableDrawing(payload)
      if (!response.res.ok) throw new Error(apiMessage(response.data, 'Failed to save drawing'))
      const saved = entityToLayout(response.data)
      setLayouts(prev => prev.map(layout => layout.id === selectedLayout.id ? saved : layout))
      setSelectedLayoutId(saved.id)
      setSelectedItemId('')
      setSavedText('Saved')
    } catch (e) {
      setDrawingError(e.message || 'Failed to save drawing')
    } finally {
      setSavingDrawing(false)
    }
  }

  const deleteSelectedItem = () => {
    if (!selectedItem) return
    updateLayout(layout => ({ ...layout, items: (layout.items || []).filter(item => item.id !== selectedItem.id) }))
    setSelectedItemId('')
  }

  const beginDrag = (event, item) => {
    event.stopPropagation()
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    setSelectedItemId(item.id)
    setDragging({ id: item.id, offsetX: event.clientX - rect.left - item.x, offsetY: event.clientY - rect.top - item.y })
  }

  const moveDrag = (event) => {
    if (!dragging) return
    const rect = stageRef.current?.getBoundingClientRect()
    const item = items.find(i => i.id === dragging.id)
    if (!rect || !item) return
    const scaleX = STAGE_WIDTH / rect.width
    const scaleY = STAGE_HEIGHT / rect.height
    const x = (event.clientX - rect.left) * scaleX - dragging.offsetX
    const y = (event.clientY - rect.top) * scaleY - dragging.offsetY
    updateItem(item.id, {
      x: Math.round(clamp(x, 0, STAGE_WIDTH - (item.w || 80))),
      y: Math.round(clamp(y, 0, STAGE_HEIGHT - (item.h || 60))),
    })
  }

  const renderItem = (item) => {
    const isSelected = item.id === selectedItemId
    const commonSx = {
      position: 'absolute',
      left: `${item.x}px`,
      top: `${item.y}px`,
      width: `${item.w}px`,
      height: `${item.h}px`,
      cursor: 'move',
      userSelect: 'none',
      border: isSelected ? '2px solid #1565c0' : '1px solid rgba(0,0,0,0.25)',
      boxShadow: isSelected ? '0 0 0 3px rgba(21,101,192,0.12)' : 'none',
    }

    if (item.type === 'wall') {
      return <Box key={item.id} onPointerDown={event => beginDrag(event, item)} sx={{ ...commonSx, bgcolor: '#263238', borderRadius: 0.5 }} />
    }

    if (item.type === 'door') {
      return (
        <Box key={item.id} onPointerDown={event => beginDrag(event, item)} sx={{ ...commonSx, bgcolor: '#fff8e1', border: isSelected ? '2px solid #1565c0' : '2px solid #8d6e63', borderTop: '4px solid #6d4c41', borderRadius: '0 0 28px 0' }}>
          <Typography variant="caption" sx={{ position: 'absolute', left: 6, top: 4, fontWeight: 800, color: '#5d4037' }}>Door</Typography>
        </Box>
      )
    }

    if (item.type === 'chair') {
      return <Box key={item.id} onPointerDown={event => beginDrag(event, item)} sx={{ ...commonSx, bgcolor: '#f9fbe7', borderRadius: 1, display: 'grid', placeItems: 'center', color: '#827717', fontSize: 12, fontWeight: 900 }}>C</Box>
    }

    const table = item.tableId ? tableMap.get(String(item.tableId)) : null
    const orders = activeOrders(table)
    const numbers = orderNumberText(orders)
    const round = item.shape === 'round'
    return (
      <Box
        key={item.id}
        onPointerDown={event => beginDrag(event, item)}
        sx={{
          ...commonSx,
          bgcolor: orders.length ? '#e3f2fd' : '#ffffff',
          borderColor: isSelected ? '#1565c0' : orders.length ? '#0288d1' : '#90a4ae',
          borderRadius: round ? '50%' : 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          p: 0.75,
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <Typography variant="caption" fontWeight={900} noWrap sx={{ width: '100%' }}>{table?.tableName || 'No table'}</Typography>
        <Typography variant="caption" color={orders.length ? 'primary.main' : 'text.secondary'} fontWeight={900} noWrap sx={{ width: '100%' }}>{numbers || 'No order'}</Typography>
        <Typography variant="caption" color="text.secondary">{item.chairs || 0} chairs</Typography>
      </Box>
    )
  }

  return (
    <Paper variant="outlined" sx={{ p: 1.5, mb: 1.5, borderRadius: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <TextField select size="small" label="Drawing" value={selectedLayout?.id || ''} onChange={event => { setSelectedLayoutId(event.target.value); setSelectedItemId('') }} sx={{ minWidth: 220 }} disabled={loadingDrawings || savingDrawing}>
          {layouts.map(layout => <MenuItem key={layout.id} value={layout.id}>{layout.name}{layout.persisted ? '' : ' (new)'}</MenuItem>)}
        </TextField>
        <TextField size="small" label="Drawing name" value={selectedLayout?.name || ''} onChange={event => updateLayout({ name: event.target.value })} sx={{ minWidth: 210 }} disabled={loadingDrawings || savingDrawing} />
        <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={createDrawing} disabled={savingDrawing}>New</Button>
        <Button size="small" variant="contained" startIcon={savingDrawing ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />} onClick={saveDrawing} disabled={loadingDrawings || savingDrawing}>Save</Button>
        <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={deleteDrawing} disabled={loadingDrawings || savingDrawing}>Delete</Button>
        {savedText && <Chip label={savedText} color="success" size="small" />}
      </Box>
      {drawingError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setDrawingError('')}>{drawingError}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', overflowX: 'auto' }}>
        <Box sx={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
            <Tooltip title="Add wall"><Button size="small" variant="outlined" onClick={() => addItem('wall')} disabled={loadingDrawings || savingDrawing}>Wall</Button></Tooltip>
            <Tooltip title="Add door"><Button size="small" variant="outlined" startIcon={<MeetingRoomIcon />} onClick={() => addItem('door')} disabled={loadingDrawings || savingDrawing}>Door</Button></Tooltip>
            <Tooltip title="Add square table"><Button size="small" variant="outlined" startIcon={<CropSquareIcon />} onClick={() => addItem('table', { shape: 'square' })} disabled={loadingDrawings || savingDrawing}>Square</Button></Tooltip>
            <Tooltip title="Add round table"><Button size="small" variant="outlined" startIcon={<RadioButtonUncheckedIcon />} onClick={() => addItem('table', { shape: 'round' })} disabled={loadingDrawings || savingDrawing}>Round</Button></Tooltip>
            <Tooltip title="Add chair"><Button size="small" variant="outlined" startIcon={<EventSeatIcon />} onClick={() => addItem('chair')} disabled={loadingDrawings || savingDrawing}>Chair</Button></Tooltip>
          </Box>

          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1, minHeight: 190 }}>
            <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1 }}>Selected object</Typography>
            {!selectedItem ? (
              <Typography variant="caption" color="text.secondary">Select an object in the drawing.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip label={selectedItem.type === 'table' ? `${selectedItem.shape} table` : selectedItem.type} size="small" icon={selectedItem.type === 'table' ? <TableBarIcon /> : undefined} />
                {selectedItem.type === 'table' && (
                  <>
                    <TextField select size="small" label="Shop table" value={selectedItem.tableId || ''} onChange={event => updateItem(selectedItem.id, { tableId: event.target.value })}>
                      <MenuItem value=""><em>No table</em></MenuItem>
                      {tables.map(table => <MenuItem key={table.id} value={String(table.id)}>{table.tableName}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Shape" value={selectedItem.shape || 'square'} onChange={event => updateItem(selectedItem.id, { shape: event.target.value })}>
                      <MenuItem value="square">Square</MenuItem>
                      <MenuItem value="round">Round</MenuItem>
                    </TextField>
                    <TextField size="small" type="number" label="Chairs" value={selectedItem.chairs ?? 0} onChange={event => updateItem(selectedItem.id, { chairs: Number(event.target.value || 0) })} inputProps={{ min: 0 }} />
                  </>
                )}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <TextField size="small" type="number" label="W" value={selectedItem.w} onChange={event => updateItem(selectedItem.id, { w: Number(event.target.value || 1) })} />
                  <TextField size="small" type="number" label="H" value={selectedItem.h} onChange={event => updateItem(selectedItem.id, { h: Number(event.target.value || 1) })} />
                </Box>
                <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={deleteSelectedItem}>Remove object</Button>
              </Box>
            )}
          </Box>
        </Box>

        <Box
          ref={stageRef}
          onPointerMove={moveDrag}
          onPointerUp={() => setDragging(null)}
          onPointerLeave={() => setDragging(null)}
          onPointerDown={() => setSelectedItemId('')}
          sx={{
            position: 'relative',
            width: STAGE_WIDTH,
            minWidth: STAGE_WIDTH,
            height: STAGE_HEIGHT,
            overflow: 'hidden',
            border: '1px solid #cfd8dc',
            borderRadius: 1,
            bgcolor: '#fafafa',
            backgroundImage: 'linear-gradient(#eceff1 1px, transparent 1px), linear-gradient(90deg, #eceff1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
          {loadingDrawings ? <CircularProgress sx={{ position: 'absolute', left: 24, top: 24 }} /> : items.map(renderItem)}
        </Box>
      </Box>
    </Paper>
  )
}
