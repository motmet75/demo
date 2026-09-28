import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, IconButton, Paper, Stack, TextField, Typography } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import RemoveIcon from '@mui/icons-material/Remove'
import SettingsIcon from '@mui/icons-material/Settings'
import TableBarIcon from '@mui/icons-material/TableBar'
import PrintIcon from '@mui/icons-material/Print'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import {
  clearOrderTable, clearTableOrderDraft, completeShopOrder, confirmShopOrder, confirmTableOrderDraft,
  fetchMenuOptions, fetchShopTables, fetchStaffMenuItems, fetchTableOrderDraft, markOrderPaid,
  prepareShopOrder, readyShopOrder, saveTableOrderDraft, setOrderTable,
  switchToQrPayment, revertToCash, splitPayment,
} from '../../api/shopApi'
import { printCounterOrderAlertTracked, printOrderReceiptTracked } from '../../utils/printWithHistory'
import { decorateAllowedSideOptions } from '../../utils/sideItemConfig'
import ItemOptionsDialog from '../shopfront/ItemOptionsDialog'
import EditOrderDialog from '../shoporder/EditOrderDialog'
import PaymentMethodConfirmDialog from '../shoporder/PaymentMethodConfirmDialog'

const money = value => Number(value || 0).toLocaleString('vi-VN') + 'đ'
const normalizeSearch = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()
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

function OrderReadBack({ order, busy, printed, onPrint, onPrintAlert, onPaid, onComplete, onClear, onEdit, onMove }) {
  if (!order) return null
  const items = (order.items || []).filter(item => !item.parentItemId)
  return <Paper variant="outlined" sx={{ p: 1.5, borderColor: '#86efac', bgcolor: '#f0fdf4' }}>
    <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
      <CheckCircleIcon color="success" />
      <Typography fontWeight={900}>Đơn #{order.orderNumber ?? order.dailySeq} · {order.tableName}</Typography>
      <Chip size="small" label={order.status || '-'} color={order.status === 'READY' ? 'info' : 'default'} />
      <Chip size="small" label={order.paymentStatus === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'} color={order.paymentStatus === 'PAID' ? 'success' : 'warning'} variant="outlined" />
    </Stack>
    <Typography variant="body2" fontWeight={800}>Đọc lại với khách:</Typography>
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
    <Typography fontWeight={900}>Tổng: {money(order.totalAmount)}</Typography>
    <Stack direction="row" gap={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
      <Button size="small" variant="outlined" color="warning" startIcon={<NotificationsActiveIcon />} disabled={busy} onClick={() => onPrintAlert(order)}>In lại báo đơn</Button>
      <Button size="small" variant="outlined" color="primary" startIcon={<PrintIcon />} disabled={busy} onClick={() => onPrint(order, printed)}>{printed ? 'In lại' : 'In hóa đơn'}</Button>
      {order.status === 'PENDING' && <Button size="small" variant="outlined" startIcon={<EditIcon />} disabled={busy} onClick={() => onEdit(order)}>Sửa đơn</Button>}
      {!['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status) && <Button size="small" variant="outlined" startIcon={<TableBarIcon />} disabled={busy} onClick={() => onMove(order)}>Chuyển bàn</Button>}
      {order.paymentStatus !== 'PAID' && <Button size="small" variant="outlined" color="success" disabled={busy} onClick={() => onPaid(order)}>Đã thanh toán</Button>}
      {!['COMPLETED', 'PICKED_UP'].includes(order.status) && <Button size="small" variant="contained" color="success" disabled={busy} onClick={() => onComplete(order)}>Hoàn tất & trả món</Button>}
      <Button size="small" variant="outlined" color="warning" disabled={busy} onClick={() => onClear(order)}>Khách đã rời bàn · Dọn đơn</Button>
      {busy && <CircularProgress size={18} />}
    </Stack>
  </Paper>
}

export default function QuickTableOrderDialog({ open, table, favoriteIds = [], tableOrders = [], onClose, onCreated, onSaveFavorites }) {
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
  const [draft, setDraft] = useState(null)
  const [draftItems, setDraftItems] = useState([])
  const [draftNotes, setDraftNotes] = useState('')
  const [draftDirty, setDraftDirty] = useState(false)
  const [configuring, setConfiguring] = useState(null)
  const [configuringOptions, setConfiguringOptions] = useState([])
  const [configuringLoading, setConfiguringLoading] = useState(false)
  const [paymentAction, setPaymentAction] = useState(null)
  const [printedOrderIds, setPrintedOrderIds] = useState(new Set())
  const savingDraft = useRef(false)
  const draftDirtyRef = useRef(false)

  const applyDraft = value => {
    setDraft(value || null)
    setDraftItems(Array.isArray(value?.displayItems) ? value.displayItems : [])
    setDraftNotes(value?.order?.notes || '')
    setDraftDirty(false)
    draftDirtyRef.current = false
  }

  useEffect(() => {
    if (!open || !table?.id) return undefined
    setFavorites(favoriteIds.map(String)); setFavoriteQuery(''); setConfigure(false); setSelected(null); setCreated(null); setOrderUpdates({}); setClearedOrderIds(new Set()); setPrintedOrderIds(new Set()); setEditOrder(null); setMoveOrder(null); setMoveTarget(null); setOrderActionId(''); setError('')
    setLoading(true)
    Promise.all([fetchShopTables(), fetchStaffMenuItems(), fetchTableOrderDraft(table.id)])
      .then(([tablesResult, menu, draftResult]) => {
        setTables(Array.isArray(tablesResult.data) ? tablesResult.data.filter(item => item.isActive !== false) : [])
        setModels((menu || []).filter(model => model.sellingPrice != null && model.isActive !== false))
        applyDraft(draftResult.res.status === 204 ? null : draftResult.data)
      })
      .catch(actionError => setError(actionError.message || 'Không tải được đơn tạm của bàn')).finally(() => setLoading(false))
    const poll = setInterval(() => {
      if (savingDraft.current || draftDirtyRef.current) return
      fetchTableOrderDraft(table.id).then(({ res, data }) => applyDraft(res.status === 204 ? null : data)).catch(() => {})
    }, 4000)
    return () => clearInterval(poll)
  }, [open, table?.id, favoriteIds])

  const favoriteModels = useMemo(() => favorites.map(id => models.find(model => String(model.id) === id)).filter(Boolean), [favorites, models])
  const filteredFavoriteModels = useMemo(() => {
    const query = normalizeSearch(favoriteQuery.trim())
    return query ? models.filter(model => normalizeSearch(`${model.modelCode || ''} ${model.modelName || ''}`).includes(query)) : models
  }, [favoriteQuery, models])
  const visibleOrders = useMemo(() => {
    const list = created ? [created, ...tableOrders.filter(order => order.id !== created.id)] : tableOrders
    return list.map(order => orderUpdates[order.id] || order).filter(order => !clearedOrderIds.has(order.id)).slice(0, 8)
  }, [clearedOrderIds, created, orderUpdates, tableOrders])
  const otherOrders = visibleOrders.filter(order => order.id !== created?.id)
  const moveTableOptions = useMemo(() => tables.filter(item => String(item.id) !== String(table?.id)), [table?.id, tables])
  const draftTotal = draftItems.reduce((sum, item) => sum + Number(item.unitPrice || 0) * Number(item.quantity || 0) + (item.sideItems || []).reduce((sideSum, side) => sideSum + Number(side.unitPrice || 0) * Number(side.quantity || 0) * Number(item.quantity || 0), 0), 0)

  const orderItemsFromDraft = items => items.map(item => ({
    modelId: item.modelId,
    quantity: Number(item.quantity || 1),
    selectedOptions: item.selectedOptions || null,
    itemNotes: item.itemNotes || null,
    unitPriceOverride: Number(item.unitPrice || 0) || null,
    sideItems: (item.sideItems || []).map(side => ({
      modelId: side.modelId,
      quantity: Number(side.quantity || 1) * Number(item.quantity || 1),
      selectedOptions: null,
      itemNotes: null,
      unitPriceOverride: Number(side.unitPrice || 0) || null,
      sideItems: [],
    })),
  }))

  const persistDraft = async (nextItems, nextNotes = draftNotes) => {
    if (!table?.id) return
    if (!nextItems.length) {
      if (draft?.draftId) await clearTableOrderDraft(table.id, draft.draftId)
      applyDraft(null)
      return
    }
    savingDraft.current = true; setSaving(true); setError('')
    try {
      const payload = {
        draftId: draft?.draftId || crypto.randomUUID(),
        order: { fulfillmentType: 'DINE_IN', tableId: table.id, paymentMethod: 'CASH', notes: nextNotes || null, items: orderItemsFromDraft(nextItems) },
        displayItems: nextItems,
      }
      const { res, data } = await saveTableOrderDraft(table.id, payload)
      if (!res.ok) throw new Error(data?.message || 'Không lưu được đơn tạm')
      applyDraft(data)
    } catch (actionError) { setError(actionError.message || 'Không lưu được đơn tạm') }
    finally { savingDraft.current = false; setSaving(false) }
  }

  const startConfigure = async (model, item = null) => {
    if (!model || configuringLoading) return
    setConfiguringLoading(true); setError('')
    try {
      const { data } = await fetchMenuOptions(model.id)
      setConfiguring({ model, item })
      setConfiguringOptions(Array.isArray(data) ? data : [])
    } catch (actionError) { setError(actionError.message || 'Không tải được tùy chọn món') }
    finally { setConfiguringLoading(false) }
  }

  const saveConfiguredItem = configured => {
    const model = configuring.model
    const nextItem = {
      lineId: configuring.item?.lineId || crypto.randomUUID(), modelId: model.id, modelName: model.modelName,
      quantity: Number(configured.qty || 1), unitPrice: Number(model.sellingPrice || 0),
      selectedOptions: configured.selectedOptions || null, itemNotes: configured.itemNotes || null,
      sideItems: (configured.sideItems || []).map(side => ({ modelId: side.modelId, modelName: side.modelName, quantity: Number(side.qty || 1), unitPrice: Number(side.sellingPrice || 0) })),
    }
    const next = configuring.item ? draftItems.map(item => item.lineId === configuring.item.lineId ? nextItem : item) : [...draftItems, nextItem]
    setConfiguring(null); setSelected(null); void persistDraft(next)
  }

  const changeDraftQuantity = (lineId, delta) => {
    const next = draftItems.map(item => item.lineId === lineId ? { ...item, quantity: Number(item.quantity || 1) + delta } : item).filter(item => item.quantity > 0)
    void persistDraft(next)
  }

  const confirmDraft = async () => {
    if (!draft?.draftId || !draftItems.length) return
    setSaving(true); setError('')
    try {
      const { res, data } = await confirmTableOrderDraft(table.id, draft.draftId)
      if (!res.ok) throw new Error(data?.message || 'Không xác nhận được đơn tạm')
      applyDraft(null); setCreated(data); onCreated?.(data)
      await printCounterOrderAlertTracked(data, setError)
    } catch (actionError) { setError(actionError.message || 'Không xác nhận được đơn tạm') }
    finally { setSaving(false) }
  }

  const applyLocalOrder = order => {
    if (!order?.id) return
    setOrderUpdates(current => ({ ...current, [order.id]: order }))
    setCreated(current => current?.id === order.id ? order : current)
  }
  const callOrderAction = async (action, order, fallback, payment = {}) => {
    const { res, data } = await action(order.id, payment?.paymentMethod, payment?.splitCashAmount)
    if (!res.ok) throw new Error(data?.message || data?.error || fallback)
    applyLocalOrder(data)
    return data
  }
  const advanceAndFinish = async (order, payment = {}) => {
    let updated = orderUpdates[order.id] || order
    if (updated.status === 'PENDING') updated = await callOrderAction(confirmShopOrder, updated, 'Không xác nhận được đơn')
    if (updated.status === 'CONFIRMED') updated = await callOrderAction(prepareShopOrder, updated, 'Không bắt đầu làm được đơn')
    if (updated.status === 'PREPARING') updated = await callOrderAction(readyShopOrder, updated, 'Không chuyển đơn sang sẵn sàng được')
    if (updated.status === 'READY') updated = await callOrderAction(completeShopOrder, updated, 'Không hoàn tất được đơn', payment)
    if (!['COMPLETED', 'PICKED_UP'].includes(updated.status)) throw new Error(`Không thể hoàn tất đơn ở trạng thái ${updated.status || '-'}`)
    return updated
  }
  const runPaymentAction = async payment => {
    const action = paymentAction
    if (!action) return
    setOrderActionId(action.order.id); setError('')
    try {
      let updated
      if (action.type === 'print') {
        if (payment?.paymentMethod === 'BANK_QR') updated = await callOrderAction(switchToQrPayment, action.order, 'Không đổi được hình thức thanh toán')
        else if (payment?.paymentMethod === 'SPLIT') {
          const { res, data } = await splitPayment(action.order.id, payment.splitCashAmount)
          if (!res.ok) throw new Error(data?.message || data?.error || 'Không lưu được chia tiền')
          applyLocalOrder(data); updated = data
        }
        else updated = await callOrderAction(revertToCash, action.order, 'Không đổi được hình thức thanh toán')
        await printOrderReceiptTracked(updated, null, setError)
        setPrintedOrderIds(current => new Set([...current, action.order.id]))
      } else if (action.type === 'paid') updated = await callOrderAction(markOrderPaid, action.order, 'Không đánh dấu được thanh toán', payment)
      else {
        updated = await advanceAndFinish(action.order, payment)
        if (action.type === 'clear' && updated.paymentStatus !== 'PAID') {
          updated = await callOrderAction(markOrderPaid, updated, 'Không đánh dấu được thanh toán', payment)
        }
      }
      if (action.type === 'clear') {
        updated = await callOrderAction(clearOrderTable, updated, 'Không dọn được đơn khỏi bàn')
        setClearedOrderIds(current => new Set([...current, action.order.id]))
        setCreated(current => current?.id === action.order.id ? null : current)
      }
      onCreated?.(updated); setPaymentAction(null)
    } catch (actionError) { setError(actionError.message || 'Không xử lý được thanh toán') }
    finally { setOrderActionId('') }
  }
  const requestPrint = (order, printed = false) => {
    if (printed || ['COMPLETED', 'PICKED_UP', 'CANCELLED'].includes(order.status)) {
      setOrderActionId(order.id)
      printOrderReceiptTracked(order, null, setError)
        .then(() => setPrintedOrderIds(current => new Set([...current, order.id])))
        .finally(() => setOrderActionId(''))
      return
    }
    setPaymentAction({ order, type: 'print' })
  }
  const requestPrintAlert = order => {
    setOrderActionId(order.id); setError('')
    printCounterOrderAlertTracked(order, setError)
      .catch(actionError => setError(actionError.message || 'Không in lại được báo đơn'))
      .finally(() => setOrderActionId(''))
  }
  const requestClear = order => {
    if (!window.confirm(`Khách đã rời ${table?.tableName || 'bàn'}? Đơn sẽ được hoàn tất và dọn khỏi bàn.`)) return
    if (order.paymentStatus !== 'PAID') setPaymentAction({ order, type: 'clear' })
    else {
      setOrderActionId(order.id)
      advanceAndFinish(order).then(updated => callOrderAction(clearOrderTable, updated, 'Không dọn được đơn khỏi bàn')).then(updated => {
        setClearedOrderIds(current => new Set([...current, order.id])); setCreated(current => current?.id === order.id ? null : current); onCreated?.(updated)
      }).catch(actionError => setError(actionError.message || 'Không dọn được đơn khỏi bàn')).finally(() => setOrderActionId(''))
    }
  }

  const moveTableOrder = async () => {
    if (!moveOrder || !moveTarget || orderActionId) return
    setOrderActionId(moveOrder.id); setError('')
    try {
      const { res, data } = await setOrderTable(moveOrder.id, moveTarget.id)
      if (!res.ok) throw new Error(data?.message || data?.error || 'Không chuyển được bàn')
      setClearedOrderIds(current => new Set([...current, moveOrder.id])); setCreated(current => current?.id === moveOrder.id ? null : current)
      setMoveOrder(null); setMoveTarget(null); onCreated?.(data)
    } catch (actionError) { setError(actionError.message || 'Không chuyển được bàn') }
    finally { setOrderActionId('') }
  }

  const toggleFavorite = id => setFavorites(current => {
    const value = String(id)
    if (current.includes(value)) return current.filter(item => item !== value)
    return current.length >= 8 ? current : [...current, value]
  })

  return <><Dialog open={open} onClose={saving || editOrder || moveOrder || configuring ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={typeof window !== 'undefined' && window.matchMedia('(max-width:600px)').matches}>
    <DialogTitle>{table?.tableName} · Gọi món nhanh</DialogTitle>
    <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      {error && <Alert severity="error">{error}</Alert>}
      {loading ? <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box> : <>
        <Alert severity="info">Món đang chọn là <strong>đơn tạm dùng chung</strong>. Chưa tạo đơn trong hệ thống cho đến khi bấm “Xác nhận & in báo đơn”.</Alert>
        <Stack direction="row" gap={1} flexWrap="wrap"><Button size="small" startIcon={<SettingsIcon />} variant={configure ? 'contained' : 'outlined'} onClick={() => setConfigure(value => !value)}>Món hay gọi</Button><Chip label={`${favoriteModels.length}/8 món`} size="small" /></Stack>
        {configure ? <>
          <Typography variant="body2">Chọn tối đa 8 món hiện trên bàn này.</Typography>
          <TextField autoFocus size="small" label="Gõ mã hoặc tên món để lọc" value={favoriteQuery} onChange={event => setFavoriteQuery(event.target.value)} />
          <Box sx={{ maxHeight: 300, overflow: 'auto' }}>{filteredFavoriteModels.map(model => { const checked = favorites.includes(String(model.id)); return <FormControlLabel key={model.id} sx={{ display: 'flex' }} control={<Checkbox checked={checked} disabled={!checked && favorites.length >= 8} onChange={() => toggleFavorite(model.id)} />} label={`${model.modelName} · ${money(model.sellingPrice)}`} /> })}</Box>
          <Button variant="contained" onClick={() => { onSaveFavorites?.(favorites); setConfigure(false) }}>Lưu món hay gọi</Button>
        </> : <>
          {favoriteModels.length > 0 && <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 1 }}>{favoriteModels.map(model => <Button key={model.id} variant="contained" color="inherit" disabled={saving || configuringLoading} onClick={() => startConfigure(model)} sx={{ minHeight: 64, justifyContent: 'space-between', textTransform: 'none' }}><span>{model.modelName}</span><strong>{money(model.sellingPrice)}</strong></Button>)}</Box>}
          <Stack direction="row" gap={1}><Autocomplete autoHighlight options={models} value={selected} onChange={(_, value) => setSelected(value)} getOptionLabel={model => `${model.modelName} · ${money(model.sellingPrice)}`} isOptionEqualToValue={(a,b)=>a.id===b.id} filterOptions={(options, state) => { const query = normalizeSearch(state.inputValue); return query ? options.filter(model => normalizeSearch(`${model.modelCode || ''} ${model.modelName || ''}`).includes(query)) : options }} sx={{ flex: 1 }} renderInput={params => <TextField {...params} size="small" label="Gõ tên món để lọc" />} /><Button variant="contained" startIcon={<AddIcon />} disabled={!selected || saving || configuringLoading} onClick={() => startConfigure(selected)}>Thêm</Button></Stack>
        </>}
      </>}

      {draftItems.length > 0 && <Paper variant="outlined" sx={{ p: 1.5, border: '2px solid #f59e0b', bgcolor: '#fffbeb' }}>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap"><Typography fontWeight={900} sx={{ flex: 1 }}>Đơn tạm tại {table?.tableName} · chưa lưu database</Typography><Chip size="small" color="warning" label={`${draftItems.length} dòng`} />{draft?.updatedBy && <Chip size="small" variant="outlined" label={`Cập nhật: ${draft.updatedBy}`} />}</Stack>
        {draftItems.map(item => <Box key={item.lineId} sx={{ py: 1, borderBottom: '1px solid #fde68a' }}>
          <Stack direction="row" alignItems="center" gap={0.5}>
            <IconButton size="small" disabled={saving} onClick={() => changeDraftQuantity(item.lineId, -1)}><RemoveIcon fontSize="small" /></IconButton><Typography fontWeight={900}>{item.quantity}</Typography><IconButton size="small" disabled={saving} onClick={() => changeDraftQuantity(item.lineId, 1)}><AddIcon fontSize="small" /></IconButton>
            <Box sx={{ flex: 1 }}><Typography fontWeight={800}>{item.modelName} · {money(Number(item.unitPrice || 0) * Number(item.quantity || 0))}</Typography>{optionText(item.selectedOptions) && <Typography variant="caption">Tùy chọn: {optionText(item.selectedOptions)}</Typography>}{item.itemNotes && <Typography variant="caption" display="block">Ghi chú: {item.itemNotes}</Typography>}{item.sideItems?.length > 0 && <Typography variant="caption" display="block">Món thêm: {item.sideItems.map(side => `${side.quantity} × ${side.modelName}`).join(' · ')}</Typography>}</Box>
            <IconButton size="small" onClick={() => startConfigure(models.find(model => String(model.id) === String(item.modelId)) || { id: item.modelId, modelName: item.modelName, sellingPrice: item.unitPrice }, item)}><EditIcon fontSize="small" /></IconButton><IconButton color="error" size="small" onClick={() => persistDraft(draftItems.filter(row => row.lineId !== item.lineId))}><DeleteIcon fontSize="small" /></IconButton>
          </Stack>
        </Box>)}
        <TextField fullWidth size="small" sx={{ mt: 1 }} label="Ghi chú chung của đơn" value={draftNotes} onChange={event => { setDraftNotes(event.target.value); setDraftDirty(true); draftDirtyRef.current = true }} onBlur={() => { if (draftDirtyRef.current) void persistDraft(draftItems, draftNotes) }} />
        <Stack direction="row" gap={1} alignItems="center" sx={{ mt: 1 }}><Typography fontWeight={900} sx={{ flex: 1 }}>Tạm tính: {money(draftTotal)}</Typography><Button color="error" disabled={saving} onClick={() => { if (window.confirm('Xóa toàn bộ đơn tạm của bàn này?')) void persistDraft([]) }}>Bỏ đơn tạm</Button><Button variant="contained" color="success" disabled={saving || draftDirty} onClick={confirmDraft}>{saving ? 'Đang xác nhận…' : 'Xác nhận & in báo đơn'}</Button></Stack>
      </Paper>}

      <OrderReadBack order={created} busy={orderActionId === created?.id} printed={printedOrderIds.has(created?.id)} onPrint={requestPrint} onPrintAlert={requestPrintAlert} onPaid={order => setPaymentAction({ order, type: 'paid' })} onComplete={order => setPaymentAction({ order, type: 'complete' })} onClear={requestClear} onEdit={setEditOrder} onMove={setMoveOrder} />
      {otherOrders.length > 0 && <Box><Typography fontWeight={800} sx={{ mb: 1 }}>Các đơn đã xác nhận tại bàn này</Typography><Stack gap={1}>{otherOrders.map(order => <OrderReadBack key={order.id} order={order} busy={orderActionId === order.id} printed={printedOrderIds.has(order.id)} onPrint={requestPrint} onPrintAlert={requestPrintAlert} onPaid={row => setPaymentAction({ order: row, type: 'paid' })} onComplete={row => setPaymentAction({ order: row, type: 'complete' })} onClear={requestClear} onEdit={setEditOrder} onMove={setMoveOrder} />)}</Stack></Box>}
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving || Boolean(editOrder) || Boolean(moveOrder) || Boolean(configuring)}>Đóng</Button></DialogActions>
  </Dialog>
  {configuring && <ItemOptionsDialog open model={configuring.model} options={configuringOptions} allowedSideOptions={decorateAllowedSideOptions(models, configuring.model.allowedSideIds)} initialCart={configuring.item ? { qty: configuring.item.quantity, selectedOptions: configuring.item.selectedOptions, itemNotes: configuring.item.itemNotes, sideItems: configuring.item.sideItems?.map(side => ({ modelId: side.modelId, qty: side.quantity })) } : null} onConfirm={saveConfiguredItem} onClose={() => setConfiguring(null)} />}
  {editOrder && <EditOrderDialog open order={orderUpdates[editOrder.id] || editOrder} onClose={() => setEditOrder(null)} onUpdated={updated => { applyLocalOrder(updated); setEditOrder(null); onCreated?.(updated) }} />}
  {paymentAction && <PaymentMethodConfirmDialog open order={paymentAction.order} action={paymentAction.type === 'paid' ? 'paid' : paymentAction.type === 'print' ? 'print' : paymentAction.type === 'clear' ? 'clear' : 'complete'} busy={Boolean(orderActionId)} onCancel={() => setPaymentAction(null)} onConfirm={runPaymentAction} />}
  <Dialog open={Boolean(moveOrder)} onClose={orderActionId ? undefined : () => { setMoveOrder(null); setMoveTarget(null) }} fullWidth maxWidth="xs">
    <DialogTitle>Chuyển đơn #{moveOrder?.orderNumber ?? moveOrder?.dailySeq} sang bàn khác</DialogTitle>
    <DialogContent sx={{ pt: '10px !important' }}><Alert severity="info" sx={{ mb: 1.5 }}>Đơn sẽ rời {table?.tableName || 'bàn hiện tại'} và xuất hiện ngay tại bàn mới.</Alert><Autocomplete autoHighlight options={moveTableOptions} value={moveTarget} onChange={(_, value) => setMoveTarget(value)} getOptionLabel={item => item.tableName || ''} isOptionEqualToValue={(a,b)=>a.id===b.id} filterOptions={(options,state)=>{const query=normalizeSearch(state.inputValue);return query?options.filter(item=>normalizeSearch(item.tableName).includes(query)):options}} renderInput={params=><TextField {...params} autoFocus label="Gõ tên bàn đích để tìm" placeholder="Không cần gõ dấu" />} /></DialogContent>
    <DialogActions><Button disabled={Boolean(orderActionId)} onClick={() => { setMoveOrder(null); setMoveTarget(null) }}>Hủy</Button><Button variant="contained" disabled={!moveTarget || Boolean(orderActionId)} onClick={moveTableOrder}>{orderActionId ? 'Đang chuyển...' : 'Xác nhận chuyển bàn'}</Button></DialogActions>
  </Dialog></>
}
