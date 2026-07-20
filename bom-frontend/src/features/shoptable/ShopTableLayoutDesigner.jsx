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
import ButtonGroup from '@mui/material/ButtonGroup'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import TableBarIcon from '@mui/icons-material/TableBar'
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom'
import EventSeatIcon from '@mui/icons-material/EventSeat'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import ZoomInIcon from '@mui/icons-material/ZoomIn'
import ZoomOutIcon from '@mui/icons-material/ZoomOut'
import PanToolIcon from '@mui/icons-material/PanTool'
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import {
  createShopTableDrawing,
  deleteShopTableDrawing,
  fetchShopTableDrawings,
  updateShopTableDrawing,
} from '../../api/shopApi'

const STAGE_WIDTH = 960
const STAGE_HEIGHT = 430
const EXPANDED_STAGE_HEIGHT = 620
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1
const TABLE_MIN_SIZE = 40
const TABLE_MAX_WIDTH = 320
const TABLE_MAX_HEIGHT = 240
const MAX_CHAIRS = 24
const CHAIR_WIDTH = 18
const CHAIR_HEIGHT = 14
const CHAIR_GAP = 14
const TABLE_SHAPES = [
  { value: 'rectangle', label: 'Rectangle' },
  { value: 'circle', label: 'Circle' },
  { value: 'ellipse', label: 'Ellipse' },
  { value: 'half-circle-rect', label: 'Half circle + rectangle' },
]
const makeId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const clamp = (value, min, max) => Math.min(Math.max(value, min), max)
const activeOrders = (table) => Array.isArray(table?.activeOrders) ? table.activeOrders : []
const orderNumberText = (orders) => orders.map(order => order.orderNumber != null ? `#${order.orderNumber}` : order.orderCode).filter(Boolean).join(', ')
const numberValue = (value, fallback = 0) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}
const dimensionValue = (value, fallback, max) => Math.round(clamp(numberValue(value, fallback), TABLE_MIN_SIZE, max))
const normalizeRotation = (value) => {
  const rounded = Math.round(numberValue(value, 0))
  return ((rounded % 360) + 360) % 360
}
const normalizeChairCount = (value, fallback = 4) => Math.round(clamp(numberValue(value, fallback), 0, MAX_CHAIRS))
const normalizeTableShape = (shape) => {
  if (shape === 'round') return 'circle'
  if (shape === 'square') return 'rectangle'
  if (shape === 'oval') return 'ellipse'
  if (shape === 'half-round' || shape === 'halfCircleRectangle' || shape === 'half-circle' || shape === 'semi-round') return 'half-circle-rect'
  return TABLE_SHAPES.some(option => option.value === shape) ? shape : 'rectangle'
}
const shapeLabel = (shape) => TABLE_SHAPES.find(option => option.value === normalizeTableShape(shape))?.label || 'Rectangle'

function normalizeLayoutItem(item) {
  if (!item || item.type !== 'table') return item
  const shape = normalizeTableShape(item.shape)
  const currentW = dimensionValue(item.w, 92, TABLE_MAX_WIDTH)
  const currentH = dimensionValue(item.h, 72, TABLE_MAX_HEIGHT)
  const size = dimensionValue(Math.max(currentW, currentH), 92, Math.min(TABLE_MAX_WIDTH, TABLE_MAX_HEIGHT))
  return {
    ...item,
    shape,
    w: shape === 'circle' ? size : currentW,
    h: shape === 'circle' ? size : currentH,
    rotation: normalizeRotation(item.rotation),
    chairs: normalizeChairCount(item.chairs),
  }
}

function tableShapePatch(item, rawShape) {
  const shape = normalizeTableShape(rawShape)
  const currentW = dimensionValue(item.w, 92, TABLE_MAX_WIDTH)
  const currentH = dimensionValue(item.h, 72, TABLE_MAX_HEIGHT)
  const patch = { shape }

  if (shape === 'circle') {
    const size = dimensionValue(Math.max(currentW, currentH), 92, Math.min(TABLE_MAX_WIDTH, TABLE_MAX_HEIGHT))
    return { ...patch, w: size, h: size }
  }

  if (shape === 'ellipse' && Math.abs(currentW - currentH) < 12) {
    const size = Math.max(currentW, currentH)
    return {
      ...patch,
      w: dimensionValue(size * 1.45, 132, TABLE_MAX_WIDTH),
      h: dimensionValue(size * 0.8, 76, TABLE_MAX_HEIGHT),
    }
  }

  if (shape === 'half-circle-rect' && currentW < currentH * 1.45) {
    return { ...patch, w: dimensionValue(currentH * 1.65, 128, TABLE_MAX_WIDTH) }
  }

  if (shape === 'rectangle' && Math.abs(currentW - currentH) < 12) {
    return {
      ...patch,
      w: dimensionValue(currentW * 1.35, 118, TABLE_MAX_WIDTH),
      h: dimensionValue(currentH * 0.85, 68, TABLE_MAX_HEIGHT),
    }
  }

  return patch
}

function chairPositions(count, width, height) {
  const chairs = []
  const total = normalizeChairCount(count, 0)
  const w = numberValue(width, 92)
  const h = numberValue(height, 72)
  for (let index = 0; index < total; index += 1) {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / total
    const x = w / 2 + (w / 2 + CHAIR_GAP) * Math.cos(angle) - CHAIR_WIDTH / 2
    const y = h / 2 + (h / 2 + CHAIR_GAP) * Math.sin(angle) - CHAIR_HEIGHT / 2
    chairs.push({
      x: Math.round(x),
      y: Math.round(y),
      rotation: Math.round((angle * 180) / Math.PI + 90),
    })
  }
  return chairs
}

function tableBorderRadius(shape, item) {
  const normalized = normalizeTableShape(shape)
  if (normalized === 'circle' || normalized === 'ellipse') return '50%'
  if (normalized === 'half-circle-rect') {
    const radius = Math.round(Math.min(numberValue(item.h, 72) / 2, numberValue(item.w, 92) / 2))
    return `${radius}px 8px 8px ${radius}px`
  }
  return 1
}

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
    items: Array.isArray(parsed.items) ? parsed.items.map(normalizeLayoutItem) : [],
  }
}

function payloadForLayout(layout) {
  return {
    drawingName: (layout.name || 'Untitled drawing').trim() || 'Untitled drawing',
    layoutJson: JSON.stringify({ items: (layout.items || []).map(normalizeLayoutItem) }),
  }
}

function apiMessage(data, fallback) {
  return (data && (data.message || data.error)) || (typeof data === 'string' ? data : null) || fallback
}

export default function ShopTableLayoutDesigner({ tables = [], expanded = false }) {
  const stageRef = useRef(null)
  const [layouts, setLayouts] = useState([defaultLayout()])
  const [selectedLayoutId, setSelectedLayoutId] = useState('')
  const [selectedItemId, setSelectedItemId] = useState('')
  const [dragging, setDragging] = useState(null)
  const [panning, setPanning] = useState(null)
  const [panMode, setPanMode] = useState(false)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [savedText, setSavedText] = useState('')
  const [loadingDrawings, setLoadingDrawings] = useState(false)
  const [savingDrawing, setSavingDrawing] = useState(false)
  const [drawingError, setDrawingError] = useState('')
  const [toolsHidden, setToolsHidden] = useState(false)

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
  const stageHeight = expanded ? EXPANDED_STAGE_HEIGHT : STAGE_HEIGHT

  const screenToCanvas = (event) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return null
    return {
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    }
  }

  const setZoomLevel = (nextZoom) => {
    setZoom(clamp(Math.round(nextZoom * 100) / 100, MIN_ZOOM, MAX_ZOOM))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setPanMode(false)
  }

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
    if (type === 'table') Object.assign(base, { tableId: '', shape: 'rectangle', chairs: 4, rotation: 0, ...extra })
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

  const changeSelectedTableShape = (shape) => {
    if (!selectedItem || selectedItem.type !== 'table') return
    updateItem(selectedItem.id, tableShapePatch(selectedItem, shape))
  }

  const updateSelectedTableSize = (axis, value) => {
    if (!selectedItem || selectedItem.type !== 'table') return
    const shape = normalizeTableShape(selectedItem.shape)
    const next = dimensionValue(value, axis === 'w' ? 92 : 72, axis === 'w' ? TABLE_MAX_WIDTH : TABLE_MAX_HEIGHT)
    if (shape === 'circle') {
      const size = dimensionValue(next, 92, Math.min(TABLE_MAX_WIDTH, TABLE_MAX_HEIGHT))
      updateItem(selectedItem.id, { w: size, h: size })
      return
    }
    updateItem(selectedItem.id, { [axis]: next })
  }

  const scaleSelectedTable = (factor) => {
    if (!selectedItem || selectedItem.type !== 'table') return
    const shape = normalizeTableShape(selectedItem.shape)
    const nextW = dimensionValue(numberValue(selectedItem.w, 92) * factor, 92, TABLE_MAX_WIDTH)
    const nextH = dimensionValue(numberValue(selectedItem.h, 72) * factor, 72, TABLE_MAX_HEIGHT)
    if (shape === 'circle') {
      const size = dimensionValue(Math.max(nextW, nextH), 92, Math.min(TABLE_MAX_WIDTH, TABLE_MAX_HEIGHT))
      updateItem(selectedItem.id, { w: size, h: size })
      return
    }
    updateItem(selectedItem.id, { w: nextW, h: nextH })
  }

  const rotateSelectedTable = (delta) => {
    if (!selectedItem || selectedItem.type !== 'table') return
    updateItem(selectedItem.id, { rotation: normalizeRotation(numberValue(selectedItem.rotation, 0) + delta) })
  }
  const beginPan = (event) => {
    event.stopPropagation()
    event.preventDefault()
    setSelectedItemId('')
    setPanning({ startX: event.clientX, startY: event.clientY, x: pan.x, y: pan.y })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const beginDrag = (event, item) => {
    if (panMode) {
      beginPan(event)
      return
    }
    event.stopPropagation()
    const pos = screenToCanvas(event)
    if (!pos) return
    setSelectedItemId(item.id)
    setDragging({ id: item.id, offsetX: pos.x - item.x, offsetY: pos.y - item.y })
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const moveDrag = (event) => {
    if (panning) {
      setPan({ x: panning.x + event.clientX - panning.startX, y: panning.y + event.clientY - panning.startY })
      return
    }
    if (!dragging) return
    const pos = screenToCanvas(event)
    const item = items.find(i => i.id === dragging.id)
    if (!pos || !item) return
    const x = pos.x - dragging.offsetX
    const y = pos.y - dragging.offsetY
    updateItem(item.id, {
      x: Math.round(clamp(x, 0, STAGE_WIDTH - (item.w || 80))),
      y: Math.round(clamp(y, 0, stageHeight - (item.h || 60))),
    })
  }

  const endPointer = () => {
    setDragging(null)
    setPanning(null)
  }

  const handleCanvasPointerDown = (event) => {
    if (panMode || event.button === 1) {
      beginPan(event)
      return
    }
    setSelectedItemId('')
  }

  const renderItem = (item) => {
    const isSelected = item.id === selectedItemId
    const rotation = normalizeRotation(item.rotation)
    const commonSx = {
      position: 'absolute',
      left: `${item.x}px`,
      top: `${item.y}px`,
      width: `${item.w}px`,
      height: `${item.h}px`,
      cursor: 'move',
      userSelect: 'none',
      transform: rotation ? `rotate(${rotation}deg)` : undefined,
      transformOrigin: 'center center',
      zIndex: isSelected ? 3 : 1,
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
    const shape = normalizeTableShape(item.shape)
    const tableLabel = shapeLabel(shape)
    return (
      <Box
        key={item.id}
        onPointerDown={event => beginDrag(event, item)}
        sx={{
          ...commonSx,
          border: 'none',
          boxShadow: 'none',
          overflow: 'visible',
        }}
      >
        {chairPositions(item.chairs, item.w, item.h).map((chair, index) => (
          <Box
            key={`${item.id}-chair-${index}`}
            sx={{
              position: 'absolute',
              left: `${chair.x}px`,
              top: `${chair.y}px`,
              width: CHAIR_WIDTH,
              height: CHAIR_HEIGHT,
              borderRadius: 0.75,
              bgcolor: '#fff7ed',
              border: '1px solid #c2410c',
              boxShadow: '0 1px 2px rgba(15,23,42,0.16)',
              transform: `rotate(${chair.rotation}deg)`,
              transformOrigin: 'center center',
              pointerEvents: 'none',
            }}
          />
        ))}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: orders.length ? '#e3f2fd' : '#ffffff',
            border: isSelected ? '2px solid #1565c0' : `1px solid ${orders.length ? '#0288d1' : '#90a4ae'}`,
            boxShadow: isSelected ? '0 0 0 3px rgba(21,101,192,0.12)' : 'none',
            borderRadius: tableBorderRadius(shape, item),
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
          <Typography variant="caption" color="text.secondary" noWrap sx={{ width: '100%' }}>{tableLabel}</Typography>
          <Typography variant="caption" color="text.secondary">{normalizeChairCount(item.chairs, 0)} chairs</Typography>
        </Box>
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
        <Button size="small" variant={toolsHidden ? "contained" : "outlined"} startIcon={toolsHidden ? <VisibilityIcon /> : <VisibilityOffIcon />} onClick={() => setToolsHidden(v => !v)}>{toolsHidden ? "Show Tools" : "Hide Tools"}</Button>
        {savedText && <Chip label={savedText} color="success" size="small" />}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 'auto' }}>
          <Button size="small" variant="outlined" startIcon={<ZoomOutIcon />} onClick={() => setZoomLevel(zoom - ZOOM_STEP)} disabled={zoom <= MIN_ZOOM}>Zoom</Button>
          <Chip label={`${Math.round(zoom * 100)}%`} size="small" variant="outlined" />
          <Button size="small" variant="outlined" startIcon={<ZoomInIcon />} onClick={() => setZoomLevel(zoom + ZOOM_STEP)} disabled={zoom >= MAX_ZOOM}>Zoom</Button>
          <Button size="small" variant={panMode ? 'contained' : 'outlined'} startIcon={<PanToolIcon />} onClick={() => setPanMode(v => !v)}>Move</Button>
          <Button size="small" variant="outlined" startIcon={<CenterFocusStrongIcon />} onClick={resetView}>Reset</Button>
        </Box>
      </Box>
      {drawingError && <Alert severity="error" sx={{ mb: 1 }} onClose={() => setDrawingError('')}>{drawingError}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch', overflowX: 'auto' }}>
        {!toolsHidden && (
        <Box sx={{ width: 250, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75 }}>
            <Tooltip title="Add wall"><Button size="small" variant="outlined" onClick={() => addItem('wall')} disabled={loadingDrawings || savingDrawing}>Wall</Button></Tooltip>
            <Tooltip title="Add door"><Button size="small" variant="outlined" startIcon={<MeetingRoomIcon />} onClick={() => addItem('door')} disabled={loadingDrawings || savingDrawing}>Door</Button></Tooltip>
            <Tooltip title="Add rectangle table"><Button size="small" variant="outlined" startIcon={<CropSquareIcon />} onClick={() => addItem('table', { shape: 'rectangle', w: 118, h: 72 })} disabled={loadingDrawings || savingDrawing}>Rect</Button></Tooltip>
            <Tooltip title="Add circle table"><Button size="small" variant="outlined" startIcon={<RadioButtonUncheckedIcon />} onClick={() => addItem('table', { shape: 'circle', w: 88, h: 88 })} disabled={loadingDrawings || savingDrawing}>Circle</Button></Tooltip>
            <Tooltip title="Add ellipse table"><Button size="small" variant="outlined" startIcon={<RadioButtonUncheckedIcon />} onClick={() => addItem('table', { shape: 'ellipse', w: 132, h: 76 })} disabled={loadingDrawings || savingDrawing}>Ellipse</Button></Tooltip>
            <Tooltip title="Add half circle + rectangle table"><Button size="small" variant="outlined" startIcon={<TableBarIcon />} onClick={() => addItem('table', { shape: 'half-circle-rect', w: 132, h: 76 })} disabled={loadingDrawings || savingDrawing}>Half+Rect</Button></Tooltip>
            <Tooltip title="Add chair"><Button size="small" variant="outlined" startIcon={<EventSeatIcon />} onClick={() => addItem('chair')} disabled={loadingDrawings || savingDrawing}>Chair</Button></Tooltip>
          </Box>
          <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, p: 1, minHeight: 190 }}>
            <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1 }}>Selected object</Typography>
            {!selectedItem ? (
              <Typography variant="caption" color="text.secondary">Select an object in the drawing.</Typography>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Chip label={selectedItem.type === 'table' ? `${shapeLabel(selectedItem.shape)} table` : selectedItem.type} size="small" icon={selectedItem.type === 'table' ? <TableBarIcon /> : undefined} />
                {selectedItem.type === 'table' && (
                  <>
                    <TextField select size="small" label="Shop table" value={selectedItem.tableId || ''} onChange={event => updateItem(selectedItem.id, { tableId: event.target.value })}>
                      <MenuItem value=""><em>No table</em></MenuItem>
                      {tables.map(table => <MenuItem key={table.id} value={String(table.id)}>{table.tableName}</MenuItem>)}
                    </TextField>
                    <TextField select size="small" label="Shape" value={normalizeTableShape(selectedItem.shape)} onChange={event => changeSelectedTableShape(event.target.value)}>
                      {TABLE_SHAPES.map(option => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                    </TextField>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 0.5, alignItems: 'center' }}>
                      <TextField
                        size="small"
                        type="number"
                        label="Rotate"
                        value={normalizeRotation(selectedItem.rotation)}
                        onChange={event => updateItem(selectedItem.id, { rotation: normalizeRotation(event.target.value) })}
                        inputProps={{ min: 0, max: 359, step: 15 }}
                      />
                      <Tooltip title="Rotate left 15 deg">
                        <IconButton size="small" onClick={() => rotateSelectedTable(-15)}><RotateLeftIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Rotate right 15 deg">
                        <IconButton size="small" onClick={() => rotateSelectedTable(15)}><RotateRightIcon fontSize="small" /></IconButton>
                      </Tooltip>
                    </Box>
                    <TextField
                      size="small"
                      type="number"
                      label="Chairs around"
                      value={normalizeChairCount(selectedItem.chairs, 0)}
                      onChange={event => updateItem(selectedItem.id, { chairs: normalizeChairCount(event.target.value, 0) })}
                      inputProps={{ min: 0, max: MAX_CHAIRS }}
                    />
                    <ButtonGroup size="small" variant="outlined" fullWidth>
                      {[2, 4, 6, 8].map(count => (
                        <Button key={count} onClick={() => updateItem(selectedItem.id, { chairs: count })}>{count}</Button>
                      ))}
                    </ButtonGroup>
                  </>
                )}
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <TextField size="small" type="number" label="W" value={selectedItem.w} onChange={event => selectedItem.type === 'table' ? updateSelectedTableSize('w', event.target.value) : updateItem(selectedItem.id, { w: Number(event.target.value || 1) })} />
                  <TextField size="small" type="number" label="H" value={selectedItem.h} onChange={event => selectedItem.type === 'table' ? updateSelectedTableSize('h', event.target.value) : updateItem(selectedItem.id, { h: Number(event.target.value || 1) })} />
                </Box>
                {selectedItem.type === 'table' && (
                  <ButtonGroup size="small" variant="outlined" fullWidth>
                    <Button startIcon={<ZoomOutIcon />} onClick={() => scaleSelectedTable(0.9)}>Smaller</Button>
                    <Button startIcon={<ZoomInIcon />} onClick={() => scaleSelectedTable(1.1)}>Larger</Button>
                  </ButtonGroup>
                )}
                <Button size="small" color="error" variant="outlined" startIcon={<DeleteIcon />} onClick={deleteSelectedItem}>Remove object</Button>
              </Box>
            )}
          </Box>
        </Box>
        )}

        <Box
          ref={stageRef}
          onPointerMove={moveDrag}
          onPointerUp={endPointer}
          onPointerLeave={endPointer}
          onPointerDown={handleCanvasPointerDown}
          sx={{
            position: 'relative',
            width: '100%',
            minWidth: 0,
            height: stageHeight,
            overflow: 'hidden',
            border: '1px solid #cfd8dc',
            borderRadius: 1,
            bgcolor: '#eceff1',
            cursor: panMode ? (panning ? 'grabbing' : 'grab') : 'default',
            touchAction: 'none',
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: STAGE_WIDTH,
              height: stageHeight,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: '0 0',
              bgcolor: '#fafafa',
              backgroundImage: 'linear-gradient(#eceff1 1px, transparent 1px), linear-gradient(90deg, #eceff1 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          >
            {loadingDrawings ? <CircularProgress sx={{ position: 'absolute', left: 24, top: 24 }} /> : items.map(renderItem)}
          </Box>
        </Box>
      </Box>
    </Paper>
  )
}
