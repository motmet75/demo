import React, { useEffect, useMemo, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import EditIcon from '@mui/icons-material/Edit'
import SettingsIcon from '@mui/icons-material/Settings'
import TableBarIcon from '@mui/icons-material/TableBar'
import {
  clearOrderTable, completeShopOrder, confirmShopOrder, createStaffOrder, fetchShopTables, fetchStaffMenuItems,
  markOrderPaid, prepareShopOrder, readyShopOrder, setOrderTable,
} from '../../api/shopApi'
import { useAuth } from '../../context/useAuth'
import EditOrderDialog from '../shoporder/EditOrderDialog'

const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ'
const normalizeSearch = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd')
  .replace(/Đ/g, 'D')
  .toLowerCase()
const optionText = value => {
  if (!value) return ''
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value
    return Object.entries(parsed || {}).flatMap(([group, choice]) => {
      if (Array.isArray(choice)) return choice.map(item => `${group}: ${item}`)
      if (choice && typeof choice === 'object') return Object.entries(choice).map(([item, quantity]) => `${group}: ${item}${Number(quantity) > 1 ? ` × ${quantity}` : ''}`)
      return [`${group}: ${choice}`]
    }).join(' · ')
  } catch { return String(value) }
}

function OrderReadBack({ order, busy, onPaid, onComplete, onClear, onEdit, onMove }) {
  if (!order) return null
  const items = (order.items || []).filter(item => !item.parentItemId)
  return <Paper variant="outlined" sx={{ p: 1.5, borderColor: '#86efac', bgcolor: '#f0fdf4' }}>
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
      <CheckCircleIcon color="success" />
      <Typography fontWeight={900}>Đã tạo đơn #{order.orderNumber ?? order.dailySeq} · {order.tableName}</Typography>
      <Chip size="small" label={order.status || '-'} color={order.status === 'READY' ? 'info' : 'default'} />
      <Chip size="small" label={order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'} color={order.paymentStatus === 'PAID' ? 'success' : 'warning'} variant="outlined" />
    </Stack>
    <Typography variant="body2" fontWeight={800} sx={{ mb: 0.5 }}>Đọc lại với khách:</Typography>
    {items.map(item => {
      const toppings = optionText(item.selectedOptions)
      const sides = (order.items || []).filter(side => String(side.parentItemId || '') === String(item.id || ''))
      return <Box key={item.id || `${item.modelName}-${item.quantity}`} sx={{ py: 0.5 }}>
        <Typography><strong>{item.quantity} × {item.modelName}</strong>{item.itemNotes ? ` · Ghi chú: ${item.itemNotes}` : ''}</Typography>
        {toppings && <Typography variant="body2" color="text.secondary">Tùy chọn: {toppings}</Typography>}
        {sides.length > 0 && <Typography variant="body2" color="text.secondary">Món thêm: {sides.map(side => `${side.quantity} × ${side.modelName}`).join(' · ')}</Typography>}
      </Box>
    })}
    {order.notes && <Typography variant="body2"><strong>Ghi chú đơn:</strong> {order.notes}</Typography>}
    <Typography fontWeight={900} sx={{ mt: 0.5 }}>Tổng: {money(order.totalAmount)}</Typography>
    <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
      {order.status === 'PENDING' && <Button size="small" variant="outlined" startIcon={<EditIcon />} disabled={busy} onClick={() => onEdit(order)}>Sửa ghi chú, topping & món thêm</Button>}
      {!['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status) && <Button size="small" variant="outlined" startIcon={<TableBarIcon />} disabled={busy} onClick={() => onMove(order)}>Chuyển bàn</Button>}
      {order.paymentStatus !== 'PAID' && <Button size="small" variant="outlined" color="success" disabled={busy} onClick={() => onPaid(order)}>Đã thanh toán</Button>}
      {!['COMPLETED', 'PICKED_UP'].includes(order.status) && <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => onComplete(order)}>Hoàn tất & trả món</Button>}
      <Button size="small" variant="outlined" color="warning" disabled={busy} onClick={() => onClear(order)}>Khách đã rời bàn · Dọn đơn</Button>
      {busy && <CircularProgress size={18} />}
    </Stack>
  </Paper>
}

export default function QuickTableOrderDialog({ open, table, favoriteIds = [], tableOrders = [], onClose, onCreated, onSaveFavorites }) {
  const { user } = useAuth()
  const [models, setModels] = useState([])
  const [selected, setSelected] = useState(null)
  const [favorites, setFavorites] = useState([])
  const [favoriteQuery, setFavoriteQuery] = useState('')
  const [configure, setConfigure] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [orderActionId, setOrderActionId] = useState('')
  const [error, setError] = useState('')
  const [created, setCreated] = useState(null)
  const [orderUpdates, setOrderUpdates] = useState({})
  const [clearedOrderIds, setClearedOrderIds] = useState(new Set())
  const [editOrder, setEditOrder] = useState(null)
  const [tables, setTables] = useState([])
  const [moveOrder, setMoveOrder] = useState(null)
  const [moveTarget, setMoveTarget] = useState(null)

  useEffect(() => {
    if (!open) return
    setFavorites(favoriteIds.map(String)); setFavoriteQuery(''); setConfigure(false); setSelected(null); setCreated(null); setOrderUpdates({}); setClearedOrderIds(new Set()); setEditOrder(null); setMoveOrder(null); setMoveTarget(null); setOrderActionId(''); setError('')
    fetchShopTables().then(({ data }) => setTables(Array.isArray(data) ? data.filter(item => item.isActive !== false) : []))
      .catch(error => setError(error.message || 'Không tải được danh sách bàn'))
    if (!models.length) {
      setLoading(true)
      fetchStaffMenuItems().then(list => setModels((list || []).filter(model => model.sellingPrice != null && model.isActive !== false)))
        .catch(error => setError(error.message || 'Không tải được thực đơn')).finally(() => setLoading(false))
    }
  }, [open, favoriteIds, models.length])

  const favoriteModels = useMemo(() => favorites.map(id => models.find(model => String(model.id) === id)).filter(Boolean), [favorites, models])
  const filteredFavoriteModels = useMemo(() => {
    const query = normalizeSearch(favoriteQuery.trim())
    if (!query) return models
    return models.filter(model => normalizeSearch(`${model.modelCode || ''} ${model.modelName || ''}`).includes(query))
  }, [favoriteQuery, models])
  const ownOrders = useMemo(() => {
    const username = user?.username
    const list = created ? [created, ...tableOrders.filter(order => order.id !== created.id)] : tableOrders
    return list
      .map(order => orderUpdates[order.id] || order)
      .filter(order => !clearedOrderIds.has(order.id) && (created?.id === order.id || (username && order.staffName === username)))
      .slice(0, 5)
  }, [clearedOrderIds, created, orderUpdates, tableOrders, user?.username])
  const otherOwnOrders = ownOrders.filter(order => order.id !== created?.id)
  const moveTableOptions = useMemo(() => tables.filter(item => String(item.id) !== String(table?.id)), [table?.id, tables])

  const applyLocalOrder = order => {
    if (!order?.id) return
    setOrderUpdates(current => ({ ...current, [order.id]: order }))
    setCreated(current => current?.id === order.id ? order : current)
  }

  const callOrderAction = async (action, order, fallback) => {
    const { res, data } = await action(order.id)
    if (!res.ok) throw new Error(data?.message || data?.error || fallback)
    applyLocalOrder(data)
    return data
  }

  const markPaid = async order => {
    setOrderActionId(order.id); setError('')
    try {
      const updated = await callOrderAction(markOrderPaid, order, 'Không đánh dấu được thanh toán')
      onCreated?.(updated)
    } catch (actionError) { setError(actionError.message || 'Không đánh dấu được thanh toán') }
    finally { setOrderActionId('') }
  }

  const complete = async order => {
    setOrderActionId(order.id); setError('')
    try {
      let updated = orderUpdates[order.id] || order
      if (updated.status === 'PENDING') updated = await callOrderAction(confirmShopOrder, updated, 'Không xác nhận được đơn')
      if (updated.status === 'CONFIRMED') updated = await callOrderAction(prepareShopOrder, updated, 'Không bắt đầu làm được đơn')
      if (updated.status === 'PREPARING') updated = await callOrderAction(readyShopOrder, updated, 'Không chuyển đơn sang sẵn sàng được')
      if (updated.status === 'READY') updated = await callOrderAction(completeShopOrder, updated, 'Không hoàn tất được đơn')
      if (updated.status !== 'COMPLETED' && updated.status !== 'PICKED_UP') throw new Error(`Không thể hoàn tất đơn ở trạng thái ${updated.status || '-'}`)
      onCreated?.(updated)
    } catch (actionError) { setError(actionError.message || 'Không hoàn tất được đơn') }
    finally { setOrderActionId('') }
  }

  const clearTableOrder = async order => {
    if (!window.confirm(`Khách đã rời ${table?.tableName || 'bàn'}? Đơn ${order.orderNumber ?? order.dailySeq} sẽ được hoàn tất và xóa khỏi danh sách đang mở.`)) return
    setOrderActionId(order.id); setError('')
    try {
      let updated = orderUpdates[order.id] || order
      if (updated.status === 'PENDING') updated = await callOrderAction(confirmShopOrder, updated, 'Không xác nhận được đơn')
      if (updated.status === 'CONFIRMED') updated = await callOrderAction(prepareShopOrder, updated, 'Không bắt đầu làm được đơn')
      if (updated.status === 'PREPARING') updated = await callOrderAction(readyShopOrder, updated, 'Không chuyển đơn sang sẵn sàng được')
      if (updated.status === 'READY') updated = await callOrderAction(completeShopOrder, updated, 'Không dọn được đơn khỏi bàn')
      if (updated.status !== 'COMPLETED' && updated.status !== 'PICKED_UP') throw new Error(`Không thể dọn đơn ở trạng thái ${updated.status || '-'}`)
      updated = await callOrderAction(clearOrderTable, updated, 'Không dọn được đơn khỏi bàn')
      setClearedOrderIds(current => new Set([...current, order.id]))
      setCreated(current => current?.id === order.id ? null : current)
      onCreated?.(updated)
    } catch (actionError) { setError(actionError.message || 'Không dọn được đơn khỏi bàn') }
    finally { setOrderActionId('') }
  }

  const moveTableOrder = async () => {
    if (!moveOrder || !moveTarget || orderActionId) return
    setOrderActionId(moveOrder.id); setError('')
    try {
      const { res, data } = await setOrderTable(moveOrder.id, moveTarget.id)
      if (!res.ok) throw new Error(data?.message || data?.error || 'Không chuyển được bàn')
      setClearedOrderIds(current => new Set([...current, moveOrder.id]))
      setCreated(current => current?.id === moveOrder.id ? null : current)
      setMoveOrder(null); setMoveTarget(null)
      onCreated?.(data)
    } catch (actionError) { setError(actionError.message || 'Không chuyển được bàn') }
    finally { setOrderActionId('') }
  }

  const create = async model => {
    if (!model || !table?.id || saving) return
    setSaving(true); setError('')
    try {
      const { res, data } = await createStaffOrder({
        fulfillmentType: 'DINE_IN', tableId: table.id, paymentMethod: 'CASH',
        notes: null, items: [{ modelId: model.id, quantity: 1, selectedOptions: null, itemNotes: null, unitPriceOverride: Number(model.sellingPrice) || null, sideItems: [] }],
      })
      if (!res.ok) throw new Error(data?.message || 'Không tạo được đơn')
      setCreated(data); setSelected(null); onCreated?.(data)
    } catch (error) { setError(error.message || 'Không tạo được đơn') }
    finally { setSaving(false) }
  }

  const toggleFavorite = id => setFavorites(current => {
    const value = String(id)
    if (current.includes(value)) return current.filter(item => item !== value)
    return current.length >= 8 ? current : [...current, value]
  })

  return <><Dialog open={open} onClose={saving || editOrder || moveOrder ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={typeof window !== 'undefined' && window.matchMedia('(max-width:600px)').matches}>
    <DialogTitle>{table?.tableName} · Gọi món nhanh</DialogTitle>
    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box> : <>
        <Stack direction="row" gap={1} flexWrap="wrap">
          <Button size="small" startIcon={<SettingsIcon />} variant={configure ? 'contained' : 'outlined'} onClick={() => setConfigure(value => !value)}>Món hay gọi</Button>
          <Chip label={`${favoriteModels.length}/8 món`} size="small" />
        </Stack>
        {configure ? <>
          <Typography variant="body2">Chọn tối đa 8 món hiện trên bàn này.</Typography>
          <TextField autoFocus size="small" label="Gõ mã hoặc tên món để lọc" value={favoriteQuery} onChange={event => setFavoriteQuery(event.target.value)} />
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
            {filteredFavoriteModels.map(model => {
              const checked = favorites.includes(String(model.id))
              return <FormControlLabel key={model.id} sx={{ display: 'flex' }} control={<Checkbox checked={checked} disabled={!checked && favorites.length >= 8} onChange={() => toggleFavorite(model.id)} />} label={`${model.modelName} · ${money(model.sellingPrice)}`} />
            })}
            {!filteredFavoriteModels.length && <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>Không tìm thấy món phù hợp.</Typography>}
          </Box>
          <Button variant="contained" onClick={() => { onSaveFavorites?.(favorites); setConfigure(false) }}>Lưu món hay gọi</Button>
        </> : <>
          {favoriteModels.length > 0 && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 1 }}>
            {favoriteModels.map(model => <Button key={model.id} variant="contained" color="inherit" disabled={saving} onClick={() => create(model)} sx={{ minHeight: 64, justifyContent: 'space-between', textTransform: 'none' }}><span>{model.modelName}</span><strong>{money(model.sellingPrice)}</strong></Button>)}
          </Box>}
          <Stack direction="row" gap={1}>
            <Autocomplete autoHighlight options={models} value={selected} onChange={(_, value) => setSelected(value)} getOptionLabel={model => `${model.modelName} · ${money(model.sellingPrice)}`} isOptionEqualToValue={(a,b)=>a.id===b.id} filterOptions={(options, state) => { const query = normalizeSearch(state.inputValue); return query ? options.filter(model => normalizeSearch(`${model.modelCode || ''} ${model.modelName || ''}`).includes(query)) : options }} sx={{ flex: 1 }} renderInput={params => <TextField {...params} size="small" label="Gõ tên món để lọc" />} />
            <Button variant="contained" startIcon={<AddIcon />} disabled={!selected || saving} onClick={() => create(selected)}>Tạo đơn</Button>
          </Stack>
        </>}
      </>}
      <OrderReadBack order={created} busy={orderActionId === created?.id} onPaid={markPaid} onComplete={complete} onClear={clearTableOrder} onEdit={setEditOrder} onMove={setMoveOrder} />
      {otherOwnOrders.length > 0 && <Box><Typography fontWeight={800} sx={{ mb: 1 }}>{created ? 'Các đơn đang mở khác của bạn tại bàn này' : 'Đơn của bạn tại bàn này'}</Typography><Stack gap={1}>{otherOwnOrders.map(order => <OrderReadBack key={order.id} order={order} busy={orderActionId === order.id} onPaid={markPaid} onComplete={complete} onClear={clearTableOrder} onEdit={setEditOrder} onMove={setMoveOrder} />)}</Stack></Box>}
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving || Boolean(editOrder) || Boolean(moveOrder)}>Đóng</Button></DialogActions>
  </Dialog>
  {editOrder && <EditOrderDialog
    open
    order={orderUpdates[editOrder.id] || editOrder}
    onClose={() => setEditOrder(null)}
    onUpdated={updated => { applyLocalOrder(updated); setEditOrder(null); onCreated?.(updated) }}
  />}
  <Dialog open={Boolean(moveOrder)} onClose={orderActionId ? undefined : () => { setMoveOrder(null); setMoveTarget(null) }} fullWidth maxWidth="xs">
    <DialogTitle>Chuyển đơn #{moveOrder?.orderNumber ?? moveOrder?.dailySeq} sang bàn khác</DialogTitle>
    <DialogContent sx={{ pt: '10px !important' }}>
      <Alert severity="info" sx={{ mb: 1.5 }}>Đơn sẽ rời {table?.tableName || 'bàn hiện tại'} và xuất hiện ngay tại bàn mới.</Alert>
      <Autocomplete autoHighlight options={moveTableOptions} value={moveTarget} onChange={(_, value) => setMoveTarget(value)}
        getOptionLabel={item => item.tableName || ''} isOptionEqualToValue={(a,b)=>a.id===b.id}
        filterOptions={(options,state)=>{const query=normalizeSearch(state.inputValue);return query?options.filter(item=>normalizeSearch(item.tableName).includes(query)):options}}
        renderInput={params=><TextField {...params} autoFocus label="Gõ tên bàn đích để tìm" placeholder="Không cần gõ dấu" />} />
    </DialogContent>
    <DialogActions><Button disabled={Boolean(orderActionId)} onClick={() => { setMoveOrder(null); setMoveTarget(null) }}>Hủy</Button><Button variant="contained" disabled={!moveTarget || Boolean(orderActionId)} onClick={moveTableOrder}>{orderActionId ? 'Đang chuyển...' : 'Xác nhận chuyển bàn'}</Button></DialogActions>
  </Dialog></>
}
