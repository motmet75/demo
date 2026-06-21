import React, { useEffect, useState, useMemo, useRef } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import Badge from '@mui/material/Badge'
import InputAdornment from '@mui/material/InputAdornment'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteIcon from '@mui/icons-material/Delete'
import PrintIcon from '@mui/icons-material/Print'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import CloseIcon from '@mui/icons-material/Close'
import TableBarIcon from '@mui/icons-material/TableBar'
import TakeoutDiningIcon from '@mui/icons-material/TakeoutDining'
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import MonitorIcon from '@mui/icons-material/Monitor'
import PersonIcon from '@mui/icons-material/Person'
import { fetchModels } from '../../api/modelApi'
import { fetchShopTables, createStaffOrder, fetchOrderTagQr, fetchMenuOptions, fetchCustomers, linkOrderCustomer } from '../../api/shopApi'
import { printOrderReceipt, printOrderTag } from '../../utils/printOrderReceipt'
import { broadcastToCounter } from '../shopboard/CounterDisplayPage'

const fmt         = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const fmtDots     = (digits) => digits ? Number(digits).toLocaleString('vi-VN') : ''
const stripDigits = (s) => s.replace(/[^0-9]/g, '')

const FULFILLMENT = [
  { value: 'PICKUP',   label: 'Pickup',   icon: <TakeoutDiningIcon fontSize="small" /> },
  { value: 'DINE_IN',  label: 'Dine In',  icon: <TableBarIcon fontSize="small" /> },
  { value: 'DELIVERY', label: 'Delivery', icon: <DeliveryDiningIcon fontSize="small" /> },
]

export default function ManualOrderDialog({ open, onClose, onCreated, defaultTable, defaultItems }) {
  const [models, setModels]         = useState([])
  const [tables, setTables]         = useState([])
  const [loading, setLoading]       = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  // form state
  const [manualNum, setManualNum]       = useState('')
  const [fulfillment, setFulfillment]   = useState(defaultTable ? 'DINE_IN' : 'PICKUP')
  const [tableId, setTableId]           = useState(defaultTable?.id || '')
  const [customer, setCustomer]         = useState({ name: '', phone: '' })
  const [payment, setPayment]           = useState('CASH')
  const [notes, setNotes]               = useState('')
  const [customerCash, setCustomerCash] = useState('')
  const [items, setItems]               = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [optsByModel, setOptsByModel]   = useState({})
  const [sideForm, setSideForm]         = useState({})

  // customer search/link
  const [customerId, setCustomerId]         = useState(null)
  const [custOptions, setCustOptions]       = useState([])
  const [custSearching, setCustSearching]   = useState(false)
  const custTimerRef = useRef(null)

  // post-create state
  const [createdOrder, setCreatedOrder] = useState(null)
  const [tagQr, setTagQr]               = useState('')
  const [tagLoading, setTagLoading]     = useState(false)

  // counter display broadcast highlight
  const [justBroadcast, setJustBroadcast] = useState(false)
  const bcTimerRef = useRef(null)

  const tableName = useMemo(() => tables.find(t => t.id === tableId)?.tableName || '', [tableId, tables])

  const handleCustInput = (val) => {
    setCustomer(c => ({ ...c, name: val }))
    setCustomerId(null)
    clearTimeout(custTimerRef.current)
    if (!val || val.length < 1) { setCustOptions([]); return }
    custTimerRef.current = setTimeout(async () => {
      setCustSearching(true)
      try {
        const { data } = await fetchCustomers(val)
        setCustOptions(Array.isArray(data) ? data : [])
      } catch { setCustOptions([]) }
      setCustSearching(false)
    }, 300)
  }

  const calcOptAddOn = (item) => {
    const groups = optsByModel[item.modelId] || []
    return groups.reduce((sum, grp) => {
      if (grp.isFree) return sum
      let choiceDefs
      try { choiceDefs = JSON.parse(grp.choices) } catch { return sum }
      const cur = item.selectedOptions[grp.groupName]
      const selArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
      return sum + choiceDefs
        .filter(c => typeof c === 'object' && selArr.includes(c.label))
        .reduce((s, c) => s + (Number(c.price) || 0), 0)
    }, 0)
  }

  const itemBasePrice = (item) => Number(item.customPriceDigits) || 0

  const sidesTotal = (item) =>
    (item.sideItems || []).reduce((s, si) => s + (Number(si.customPriceDigits) || 0) * (si.qty || 1), 0)

  const total = items.reduce((s, i) => s + i.qty * (itemBasePrice(i) + calcOptAddOn(i)) + sidesTotal(i), 0)

  // Load models + tables when dialog opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    if (defaultItems?.length) {
      setItems(defaultItems.map(i => ({
        uid: crypto.randomUUID(),
        modelId: i.modelId, modelName: i.modelName,
        sellingPrice: i.sellingPrice,
        customPriceDigits: String(Math.round(Number(i.sellingPrice) || 0)),
        qty: i.qty,
        selectedOptions: i.selectedOptions || {}, itemNotes: i.itemNotes || '',
        sideItems: [],
      })))
    }
    Promise.all([fetchModels(), fetchShopTables()])
      .then(([mList, tRes]) => {
        setModels((mList || []).filter(m => m.sellingPrice != null))
        setTables(Array.isArray(tRes.data) ? tRes.data : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-broadcast temp order to counter display whenever items change
  useEffect(() => {
    if (!items.length) return
    const tempItems = []
    items.forEach(i => {
      const tempId = crypto.randomUUID()
      tempItems.push({
        id: tempId,
        modelName: i.modelName,
        quantity: i.qty,
        selectedOptions: Object.keys(i.selectedOptions || {}).length > 0
          ? JSON.stringify(i.selectedOptions) : null,
        itemNotes: i.itemNotes || null,
        lineTotal: i.qty * (itemBasePrice(i) + calcOptAddOn(i)),
        parentItemId: null,
      })
      ;(i.sideItems || []).forEach(si => {
        tempItems.push({
          id: crypto.randomUUID(),
          modelName: si.modelName,
          quantity: si.qty || 1,
          selectedOptions: null,
          itemNotes: null,
          lineTotal: (Number(si.customPriceDigits) || 0) * (si.qty || 1),
          parentItemId: tempId,
        })
      })
    })
    const tempOrder = {
      orderNumber: null,
      orderCode: '―',
      customerName: customer.name || null,
      tableName: tableName || null,
      items: tempItems,
      totalAmount: total,
      paymentQr: null,
      tagQrBase64: null,
    }
    broadcastToCounter(tempOrder, null)
    setJustBroadcast(true)
    clearTimeout(bcTimerRef.current)
    bcTimerRef.current = setTimeout(() => setJustBroadcast(false), 3000)
  }, [items]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { clearTimeout(bcTimerRef.current); clearTimeout(custTimerRef.current) }, [])

  const reset = () => {
    setManualNum(''); setFulfillment(defaultTable ? 'DINE_IN' : 'PICKUP'); setTableId(defaultTable?.id || '')
    setCustomer({ name: '', phone: '' }); setCustomerId(null); setCustOptions([])
    setPayment('CASH'); setNotes('')
    setItems([]); setSelectedModel(null); setError('')
    setCreatedOrder(null); setTagQr(''); setOptsByModel({})
    setJustBroadcast(false); setCustomerCash(''); setSideForm({})
  }

  const handleClose = () => { reset(); onClose() }

  // ── Side item helpers ──────────────────────────────────────────────
  const setSF = (parentUid, field, value) =>
    setSideForm(prev => ({ ...prev, [parentUid]: { ...(prev[parentUid] || {}), [field]: value } }))

  const addSideItem = (parentUid) => {
    const sf = sideForm[parentUid] || {}
    if (!sf.model) return
    const price = sf.priceDigits ?? String(Math.round(Number(sf.model.sellingPrice) || 0))
    const qty = sf.qty || 1
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: [...(i.sideItems || []), {
          uid: crypto.randomUUID(),
          modelId: sf.model.id, modelName: sf.model.modelName,
          customPriceDigits: price,
          qty,
        }]
      }
    ))
    setSideForm(prev => ({ ...prev, [parentUid]: {} }))
  }

  const removeSideItem = (parentUid, sideUid) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : { ...i, sideItems: i.sideItems.filter(si => si.uid !== sideUid) }
    ))

  const setSideItemPrice = (parentUid, sideUid, digits) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: i.sideItems.map(si =>
          si.uid === sideUid ? { ...si, customPriceDigits: digits } : si
        )
      }
    ))

  const changeSideQty = (parentUid, sideUid, delta) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: i.sideItems
          .map(si => si.uid === sideUid ? { ...si, qty: (si.qty || 1) + delta } : si)
          .filter(si => si.qty > 0)
      }
    ))

  const changeSideModel = (parentUid, sideUid, newModel) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: i.sideItems.map(si =>
          si.uid === sideUid ? {
            ...si,
            modelId: newModel.id,
            modelName: newModel.modelName,
            customPriceDigits: String(Math.round(Number(newModel.sellingPrice) || 0)),
          } : si
        )
      }
    ))

  const addItem = () => {
    if (!selectedModel) return
    const mid = selectedModel.id
    setItems(prev => [...prev, {
      uid: crypto.randomUUID(),
      modelId: mid, modelName: selectedModel.modelName,
      sellingPrice: selectedModel.sellingPrice,
      customPriceDigits: String(Math.round(Number(selectedModel.sellingPrice) || 0)),
      qty: 1, selectedOptions: {}, itemNotes: '',
      sideItems: [],
    }])
    if (!optsByModel[mid]) {
      fetchMenuOptions(mid)
        .then(({ data }) => setOptsByModel(prev => ({ ...prev, [mid]: Array.isArray(data) ? data : [] })))
        .catch(() => setOptsByModel(prev => ({ ...prev, [mid]: [] })))
    }
    setSelectedModel(null)
  }

  const toggleOption = (uid, groupName, value, multiSelect) => {
    setItems(prev => prev.map(item => {
      if (item.uid !== uid) return item
      const cur = item.selectedOptions[groupName]
      let next
      if (multiSelect) {
        const arr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
        next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
        if (!next.length) next = undefined
      } else {
        next = cur === value ? undefined : value
      }
      const opts = { ...item.selectedOptions }
      if (next === undefined) delete opts[groupName]
      else opts[groupName] = next
      return { ...item, selectedOptions: opts }
    }))
  }

  const setItemNotes = (uid, val) => {
    setItems(prev => prev.map(i => i.uid === uid ? { ...i, itemNotes: val } : i))
  }

  const setItemPrice = (uid, digits) =>
    setItems(prev => prev.map(i => i.uid === uid ? { ...i, customPriceDigits: digits } : i))

  const changeQty = (uid, delta) => {
    setItems(prev =>
      prev.map(i => i.uid === uid ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
    )
  }

  const handleSubmit = async () => {
    if (!items.length) { setError('Add at least one item'); return }
    setSubmitting(true); setError('')
    const body = {
      fulfillmentType: fulfillment,
      tableId: fulfillment === 'DINE_IN' && tableId ? tableId : null,
      customerName: customer.name || null,
      customerPhone: customer.phone || null,
      paymentMethod: payment,
      notes: notes || null,
      manualOrderNumber: manualNum !== '' ? Number(manualNum) : null,
      items: items.map(i => ({
        modelId: i.modelId, quantity: i.qty,
        selectedOptions: Object.keys(i.selectedOptions || {}).length > 0
          ? JSON.stringify(i.selectedOptions) : null,
        itemNotes: i.itemNotes || null,
        unitPriceOverride: Number(i.customPriceDigits) || null,
        sideItems: (i.sideItems || []).map(si => ({
          modelId: si.modelId, quantity: si.qty || 1,
          selectedOptions: null, itemNotes: null,
          unitPriceOverride: Number(si.customPriceDigits) || null,
          sideItems: [],
        })),
      })),
    }
    try {
      const { res, data } = await createStaffOrder(body)
      if (!res.ok) { setError(data?.message || 'Failed to create order'); setSubmitting(false); return }
      if (customerId) {
        try { await linkOrderCustomer(data.id, customerId) } catch { /* silent */ }
      }
      setCreatedOrder(data)
      onCreated?.(data)
      // broadcast real order (with order number), then again once tagQr is loaded
      broadcastToCounter(data, null)
      setTagLoading(true)
      fetchOrderTagQr(data.id)
        .then(({ data: qr }) => {
          const qrB64 = qr?.qrBase64 || ''
          setTagQr(qrB64)
          broadcastToCounter(data, qrB64 || null)
        })
        .catch(() => {})
        .finally(() => setTagLoading(false))
    } catch (e) { setError(e.message || 'Network error') }
    setSubmitting(false)
  }

  const counterBtn = (
    <Tooltip title={justBroadcast ? 'Counter display updated!' : 'Open counter customer display'}>
      <Badge
        variant="dot"
        color="success"
        invisible={!justBroadcast}
        overlap="circular"
      >
        <Button
          size="small"
          variant={justBroadcast ? 'contained' : 'outlined'}
          color={justBroadcast ? 'success' : 'info'}
          startIcon={<MonitorIcon sx={{ fontSize: '16px !important' }} />}
          onClick={() => window.open(window.location.origin + '/bom-inventory/shop/counter', '_blank')}
          sx={{
            textTransform: 'none',
            fontWeight: 700,
            fontSize: 12,
            transition: 'all 0.25s',
            animation: justBroadcast ? 'counterPulse 0.7s ease-in-out infinite' : 'none',
            '@keyframes counterPulse': {
              '0%,100%': { boxShadow: '0 0 0 0 rgba(34,197,94,0)' },
              '50%':     { boxShadow: '0 0 0 7px rgba(34,197,94,0.4)' },
            },
          }}
        >
          {justBroadcast ? '📺 Live' : 'Counter'}
        </Button>
      </Badge>
    </Tooltip>
  )

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onClose={!submitting ? handleClose : undefined} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3 } }}>

      {/* Title row — always visible */}
      <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography fontWeight={800} variant="h6">New Manual Order</Typography>
          <Typography variant="caption" color="text.secondary">Staff-created order</Typography>
        </Box>
        {counterBtn}
      </DialogTitle>

      <DialogContent sx={{ pt: 0 }}>

        {/* ── Success banner (appears after order created) ── */}
        {createdOrder && (() => {
          const num = createdOrder.orderNumber ? `#${createdOrder.orderNumber}` : createdOrder.orderCode
          return (
            <Box sx={{
              bgcolor: '#1e293b', borderRadius: 2, px: 2, py: 1.5, mb: 2,
              display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
            }}>
              <CheckCircleIcon sx={{ color: '#4ade80', fontSize: 30, flexShrink: 0 }} />
              <Box sx={{ flex: 1, minWidth: 80 }}>
                <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                  Order Created
                </Typography>
                <Typography sx={{ fontSize: 36, fontWeight: 900, lineHeight: 1, color: '#fff', letterSpacing: -1 }}>
                  {num}
                </Typography>
                {createdOrder.tableName && (
                  <Chip icon={<TableBarIcon sx={{ color: '#fff !important', fontSize: 12 }} />}
                    label={`Table ${createdOrder.tableName}`} size="small"
                    sx={{ mt: 0.25, bgcolor: 'rgba(255,255,255,0.12)', color: '#fff', fontSize: 11 }} />
                )}
              </Box>
              {/* Payment QR for BANK_QR orders */}
              {createdOrder.paymentMethod === 'BANK_QR' && createdOrder.paymentQr && (
                <Box sx={{ textAlign: 'center' }}>
                  <Typography sx={{ fontSize: 10, color: '#4ade80', fontWeight: 700, mb: 0.5 }}>Scan to Pay</Typography>
                  <img
                    src={createdOrder.paymentQr.startsWith('https://')
                      ? createdOrder.paymentQr
                      : `data:image/png;base64,${createdOrder.paymentQr}`}
                    alt="VietQR"
                    style={{ width: 90, height: 90, borderRadius: 6, background: '#fff', padding: 4 }}
                  />
                  <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', mt: 0.25 }}>
                    {fmt(createdOrder.totalAmount)}
                  </Typography>
                </Box>
              )}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Button size="small" variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', textTransform: 'none', fontSize: 12 }}
                  startIcon={tagLoading ? <CircularProgress size={12} sx={{ color: '#fff' }} /> : <QrCode2Icon />}
                  disabled={tagLoading || !tagQr}
                  onClick={() => printOrderTag(createdOrder, tagQr)}>
                  Print Tag
                </Button>
                <Button size="small" variant="outlined"
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', textTransform: 'none', fontSize: 12 }}
                  startIcon={<PrintIcon />}
                  onClick={() => printOrderReceipt(createdOrder)}>
                  Receipt
                </Button>
              </Box>
            </Box>
          )
        })()}

        {/* ── Form (dimmed after order created) ── */}
        <Box sx={{ opacity: createdOrder ? 0.45 : 1, pointerEvents: createdOrder ? 'none' : 'auto', transition: 'opacity 0.3s' }}>
          {loading ? (
            <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
          ) : (
            <Stack spacing={2} sx={{ mt: 0.5 }}>
              {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

              {/* Order number + fulfillment */}
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <TextField
                  label="Order # (optional)"
                  size="small" type="number" value={manualNum}
                  onChange={e => setManualNum(e.target.value)}
                  placeholder="auto" sx={{ width: 140, flexShrink: 0 }}
                  inputProps={{ min: 1 }} helperText="Leave blank for auto"
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Type</Typography>
                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    {FULFILLMENT.map(opt => (
                      <Box key={opt.value} onClick={() => setFulfillment(opt.value)} sx={{
                        flex: 1, border: '1.5px solid', borderRadius: 1.5, py: 0.75, textAlign: 'center', cursor: 'pointer', fontSize: 11,
                        borderColor: fulfillment === opt.value ? 'primary.main' : '#e0e0e0',
                        bgcolor: fulfillment === opt.value ? '#e3f2fd' : '#fff',
                      }}>
                        <Box sx={{ color: fulfillment === opt.value ? 'primary.main' : 'text.secondary' }}>{opt.icon}</Box>
                        <Typography variant="caption" fontWeight={600}
                          color={fulfillment === opt.value ? 'primary.main' : 'text.secondary'}>{opt.label}</Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>

              {/* Table */}
              {fulfillment === 'DINE_IN' && (
                <FormControl size="small" fullWidth>
                  <InputLabel>Table</InputLabel>
                  <Select value={tableId} label="Table" onChange={e => setTableId(e.target.value)}>
                    <MenuItem value=""><em>No table</em></MenuItem>
                    {tables.map(t => <MenuItem key={t.id} value={t.id}>{t.tableName}</MenuItem>)}
                  </Select>
                </FormControl>
              )}

              {/* Customer */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Autocomplete
                  freeSolo
                  size="small"
                  options={custOptions}
                  getOptionLabel={opt => typeof opt === 'string' ? opt : opt.name}
                  filterOptions={x => x}
                  loading={custSearching}
                  inputValue={customer.name}
                  onInputChange={(_, val, reason) => {
                    if (reason === 'input') handleCustInput(val)
                    if (reason === 'clear') { setCustomer({ name: '', phone: '' }); setCustomerId(null); setCustOptions([]) }
                  }}
                  onChange={(_, val) => {
                    if (val && typeof val === 'object') {
                      setCustomer({ name: val.name, phone: val.phone || '' })
                      setCustomerId(val.id)
                      setCustOptions([])
                    }
                  }}
                  renderOption={(props, opt) => (
                    <li {...props} key={opt.id}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{opt.name}</Typography>
                        {opt.phone && <Typography variant="caption" color="text.secondary">{opt.phone}</Typography>}
                      </Box>
                    </li>
                  )}
                  renderInput={params => (
                    <TextField {...params} label={customerId ? 'Customer (linked)' : 'Customer name'}
                      InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                          <>
                            {custSearching && <CircularProgress size={14} />}
                            {customerId && <PersonIcon sx={{ fontSize: 16, color: 'success.main', mr: 0.5 }} />}
                            {params.InputProps.endAdornment}
                          </>
                        ),
                      }}
                    />
                  )}
                  sx={{ flex: 1 }}
                />
                <TextField size="small" label="Phone" sx={{ width: 140 }} value={customer.phone}
                  onChange={e => setCustomer(c => ({ ...c, phone: e.target.value }))} />
              </Box>

              {/* Payment */}
              <FormControl size="small" fullWidth>
                <InputLabel>Payment</InputLabel>
                <Select value={payment} label="Payment" onChange={e => setPayment(e.target.value)}>
                  <MenuItem value="CASH">Cash</MenuItem>
                  <MenuItem value="BANK_QR">Bank QR</MenuItem>
                </Select>
              </FormControl>

              <Divider>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>Items</Typography>
              </Divider>

              {/* Item search + add */}
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Autocomplete
                  size="small"
                  options={models}
                  getOptionLabel={m => `${m.modelName} — ${fmt(m.sellingPrice)}`}
                  value={selectedModel}
                  onChange={(_, v) => setSelectedModel(v)}
                  renderInput={params => <TextField {...params} label="Search item…" />}
                  sx={{ flex: 1 }}
                  isOptionEqualToValue={(a, b) => a.id === b.id}
                  noOptionsText="No items with price"
                />
                <Button variant="contained" onClick={addItem} disabled={!selectedModel}
                  startIcon={<AddIcon />} sx={{ textTransform: 'none', flexShrink: 0 }}>
                  Add
                </Button>
              </Box>

              {/* Items list */}
              {items.length > 0 ? (
                <Stack spacing={0.75}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault()
                    try {
                      const item = JSON.parse(e.dataTransfer.getData('application/json'))
                      setItems(prev => [...prev, {
                        uid: crypto.randomUUID(),
                        modelId: item.modelId, modelName: item.modelName,
                        sellingPrice: item.sellingPrice,
                        customPriceDigits: String(Math.round(Number(item.sellingPrice) || 0)),
                        qty: item.qty || 1,
                        selectedOptions: {}, itemNotes: '', sideItems: [],
                      }])
                      if (!optsByModel[item.modelId]) {
                        fetchMenuOptions(item.modelId)
                          .then(({ data }) => setOptsByModel(p => ({ ...p, [item.modelId]: Array.isArray(data) ? data : [] })))
                          .catch(() => setOptsByModel(p => ({ ...p, [item.modelId]: [] })))
                      }
                    } catch { /* ignore */ }
                  }}
                >
                  {items.map((item, itemIdx) => {
                    const modelOpts = optsByModel[item.modelId] || []
                    const sf = sideForm[item.uid] || {}
                    const mainSubtotal = item.qty * (itemBasePrice(item) + calcOptAddOn(item))
                    const blockTotal = mainSubtotal + sidesTotal(item)
                    return (
                      <Box key={item.uid} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>

                        {/* ── Main item ─────────────────────────────────────── */}
                        <Box sx={{ bgcolor: '#f8faff', px: 1.5, pt: 1, pb: 0.75 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, minWidth: 18, flexShrink: 0, fontSize: 11 }}>
                              {itemIdx + 1}.
                            </Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ flex: 1, minWidth: 80 }} noWrap>
                              {item.modelName}
                            </Typography>
                            <TextField
                              size="small" type="text" inputMode="numeric" placeholder="0"
                              value={fmtDots(item.customPriceDigits || '')}
                              onChange={e => setItemPrice(item.uid, stripDigits(e.target.value))}
                              inputProps={{ maxLength: 12, style: { fontSize: 12, fontWeight: 700, textAlign: 'right', width: 68 } }}
                              InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                              sx={{ width: 106, '& .MuiInputBase-root': { height: 30 } }}
                            />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                              <IconButton size="small" onClick={() => changeQty(item.uid, -1)} sx={{ p: 0.25 }}>
                                <RemoveIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 20, textAlign: 'center', fontSize: 13 }}>
                                {item.qty}
                              </Typography>
                              <IconButton size="small" onClick={() => changeQty(item.uid, 1)}
                                sx={{ p: 0.25, bgcolor: '#1976d2', color: '#fff', borderRadius: 0.75, '&:hover': { bgcolor: '#1565c0' } }}>
                                <AddIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Box>
                            <Typography variant="body2" color="primary" fontWeight={800}
                              sx={{ minWidth: 70, textAlign: 'right', fontSize: 13 }}>
                              {fmt(mainSubtotal)}
                            </Typography>
                            <IconButton size="small" color="error"
                              onClick={() => setItems(prev => prev.filter(i => i.uid !== item.uid))}
                              sx={{ p: 0.25 }}>
                              <DeleteIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>

                          {/* Option chips */}
                          {modelOpts.map(grp => {
                            const rawChoices = (() => { try { return JSON.parse(grp.choices) } catch { return [] } })()
                            const choices = rawChoices.map(c => typeof c === 'object' ? c : { label: String(c), price: 0 })
                            if (!choices.length) return null
                            const curVal = item.selectedOptions[grp.groupName]
                            const selArr = Array.isArray(curVal) ? curVal : (curVal ? [curVal] : [])
                            return (
                              <Box key={grp.id} sx={{ mt: 0.5 }}>
                                <Typography variant="caption" color="text.secondary"
                                  sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                  {grp.groupName}{grp.isFree ? ' (free)' : ''}
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                                  {choices.map(choice => {
                                    const active = selArr.includes(choice.label)
                                    const priceTag = (!grp.isFree && choice.price > 0)
                                      ? ` +${Number(choice.price).toLocaleString('vi-VN')}đ` : ''
                                    return (
                                      <Chip key={choice.label} label={choice.label + priceTag} size="small"
                                        onClick={() => toggleOption(item.uid, grp.groupName, choice.label, grp.multiSelect)}
                                        sx={{
                                          height: 22, fontSize: 11, cursor: 'pointer',
                                          bgcolor: active ? '#1976d2' : '#fff', color: active ? '#fff' : '#555',
                                          border: `1px solid ${active ? '#1976d2' : '#ddd'}`, fontWeight: active ? 700 : 400,
                                          '&:hover': { bgcolor: active ? '#1565c0' : '#f0f4ff' },
                                        }} />
                                    )
                                  })}
                                </Box>
                              </Box>
                            )
                          })}

                          <TextField size="small" variant="standard" fullWidth
                            placeholder="Item note (e.g. no sugar, extra spicy…)"
                            value={item.itemNotes || ''}
                            onChange={e => setItemNotes(item.uid, e.target.value)}
                            InputProps={{ disableUnderline: false, sx: { fontSize: 12 } }}
                            sx={{ mt: 0.5 }}
                          />
                        </Box>

                        {/* ── Children (tree) ─────────────────────────────────── */}
                        <Box sx={{ bgcolor: '#f0f4ff', borderTop: '1px solid #e2e8f0' }}>
                          <Box sx={{ ml: 1.5, borderLeft: '2px solid #c7d2fe' }}>

                            {/* Side item rows */}
                            {(item.sideItems || []).map(si => (
                              <Box key={si.uid} sx={{ borderBottom: '1px solid #e8eaf6', pt: 0.5, pb: 0.4, pr: 0.75 }}>
                                {/* Row 1: connector + editable name + delete */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box sx={{ width: 14, height: 2, bgcolor: '#c7d2fe', flexShrink: 0 }} />
                                  <Autocomplete
                                    size="small" disableClearable options={models}
                                    getOptionLabel={m => m.modelName}
                                    value={{ id: si.modelId, modelName: si.modelName, sellingPrice: si.customPriceDigits }}
                                    onChange={(_, v) => v && changeSideModel(item.uid, si.uid, v)}
                                    isOptionEqualToValue={(a, b) => a.id === b.id}
                                    renderInput={params => (
                                      <TextField {...params} variant="standard"
                                        InputProps={{ ...params.InputProps, disableUnderline: true,
                                          sx: { fontSize: 12, fontWeight: 600, p: 0 } }}
                                        inputProps={{ ...params.inputProps, style: { fontSize: 12, fontWeight: 600, padding: '1px 0' } }}
                                      />
                                    )}
                                    sx={{ flex: 1, '& .MuiAutocomplete-endAdornment': { top: 'calc(50% - 10px)' } }}
                                    noOptionsText="No items"
                                  />
                                  <IconButton size="small" onClick={() => removeSideItem(item.uid, si.uid)}
                                    sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                                    <CloseIcon sx={{ fontSize: 13 }} />
                                  </IconButton>
                                </Box>
                                {/* Row 2: qty → price → total */}
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, ml: 2.75 }}>
                                  <IconButton size="small" onClick={() => changeSideQty(item.uid, si.uid, -1)} sx={{ p: 0.2 }}>
                                    <RemoveIcon sx={{ fontSize: 12 }} />
                                  </IconButton>
                                  <Typography variant="caption" fontWeight={700} sx={{ minWidth: 18, textAlign: 'center', fontSize: 13 }}>
                                    {si.qty || 1}
                                  </Typography>
                                  <IconButton size="small" onClick={() => changeSideQty(item.uid, si.uid, 1)}
                                    sx={{ p: 0.2, bgcolor: '#6366f1', color: '#fff', borderRadius: 0.5, '&:hover': { bgcolor: '#4f46e5' } }}>
                                    <AddIcon sx={{ fontSize: 12 }} />
                                  </IconButton>
                                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>×</Typography>
                                  <TextField
                                    size="small" type="text" inputMode="numeric" placeholder="0"
                                    value={fmtDots(si.customPriceDigits || '')}
                                    onChange={e => setSideItemPrice(item.uid, si.uid, stripDigits(e.target.value))}
                                    inputProps={{ maxLength: 12, style: { fontSize: 12, fontWeight: 700, textAlign: 'right', width: 56 } }}
                                    InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                                    sx={{ width: 94, '& .MuiInputBase-root': { height: 26 } }}
                                  />
                                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11 }}>=</Typography>
                                  <Typography variant="caption" color="primary" fontWeight={800} sx={{ fontSize: 12 }}>
                                    {fmt((Number(si.customPriceDigits) || 0) * (si.qty || 1))}
                                  </Typography>
                                </Box>
                              </Box>
                            ))}

                            {/* Block total row — only when there are side items */}
                            {(item.sideItems || []).length > 0 && (
                              <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.4, borderBottom: '1px solid #e8eaf6' }}>
                                <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11 }}>Block total</Typography>
                                <Typography variant="caption" fontWeight={800} color="primary" sx={{ fontSize: 12 }}>
                                  {fmt(blockTotal)}
                                </Typography>
                              </Box>
                            )}

                            {/* Add side item */}
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 0.6, pr: 0.75, flexWrap: 'wrap' }}>
                              <Box sx={{ width: 14, height: 2, bgcolor: '#a5b4fc', flexShrink: 0, mt: 2.25 }} />
                              <Autocomplete
                                size="small" options={models} getOptionLabel={m => m.modelName}
                                value={sf.model || null}
                                onChange={(_, v) => {
                                  setSF(item.uid, 'model', v)
                                  if (v) setSF(item.uid, 'priceDigits', String(Math.round(Number(v.sellingPrice) || 0)))
                                }}
                                renderInput={params => <TextField {...params} label="Add topping / side…" size="small" />}
                                sx={{ flex: 1, minWidth: 130 }}
                                isOptionEqualToValue={(a, b) => a.id === b.id}
                                noOptionsText="No items"
                              />
                              {/* Qty for the new side item */}
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0, mt: 0.5 }}>
                                <IconButton size="small"
                                  onClick={() => setSF(item.uid, 'qty', Math.max(1, (sf.qty || 1) - 1))}
                                  sx={{ p: 0.2 }}>
                                  <RemoveIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                                <Typography variant="caption" fontWeight={700} sx={{ minWidth: 18, textAlign: 'center', fontSize: 12 }}>
                                  {sf.qty || 1}
                                </Typography>
                                <IconButton size="small"
                                  onClick={() => setSF(item.uid, 'qty', (sf.qty || 1) + 1)}
                                  sx={{ p: 0.2, bgcolor: '#6366f1', color: '#fff', borderRadius: 0.5, '&:hover': { bgcolor: '#4f46e5' } }}>
                                  <AddIcon sx={{ fontSize: 12 }} />
                                </IconButton>
                              </Box>
                              <TextField
                                size="small" type="text" inputMode="numeric" label="Price" placeholder="0"
                                value={fmtDots(sf.priceDigits || '')}
                                onChange={e => setSF(item.uid, 'priceDigits', stripDigits(e.target.value))}
                                inputProps={{ maxLength: 12 }}
                                InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                                sx={{ width: 98 }}
                              />
                              <Button size="small" variant="contained"
                                startIcon={<PlaylistAddIcon sx={{ fontSize: 14 }} />}
                                onClick={() => addSideItem(item.uid)} disabled={!sf.model}
                                sx={{ textTransform: 'none', fontSize: 11, height: 40, flexShrink: 0,
                                  bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' }, '&.Mui-disabled': { bgcolor: '#e0e0e0' } }}>
                                Add
                              </Button>
                            </Box>

                          </Box>
                        </Box>

                      </Box>
                    )
                  })}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, px: 1 }}>
                    <Typography fontWeight={800}>Total</Typography>
                    <Typography fontWeight={800} color="primary">{fmt(total)}</Typography>
                  </Box>
                  {payment === 'CASH' && (
                    <Box sx={{ bgcolor: '#fff8e1', borderRadius: 1.5, px: 1.25, py: 1, mt: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          label="Customer cash" type="text" inputMode="numeric" size="small" sx={{ flex: 1 }}
                          value={fmtDots(customerCash)}
                          onChange={e => setCustomerCash(stripDigits(e.target.value))}
                          placeholder="0"
                          inputProps={{ maxLength: 15, style: { fontSize: 15, fontWeight: 700 } }}
                          InputProps={{ endAdornment: <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5, whiteSpace: 'nowrap' }}>đ</Typography> }}
                        />
                        {customerCash !== '' && Number(customerCash) > 0 && (
                          <Box sx={{ minWidth: 120, textAlign: 'right' }}>
                            {Number(customerCash) >= total ? (
                              <>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>Change</Typography>
                                <Typography fontWeight={800} color="#2e7d32" sx={{ fontSize: 18, lineHeight: 1.1 }}>
                                  {fmt(Number(customerCash) - total)}
                                </Typography>
                              </>
                            ) : (
                              <>
                                <Typography variant="caption" color="error" sx={{ fontSize: 11 }}>Short</Typography>
                                <Typography fontWeight={800} color="error.main" sx={{ fontSize: 18, lineHeight: 1.1 }}>
                                  {fmt(total - Number(customerCash))}
                                </Typography>
                              </>
                            )}
                          </Box>
                        )}
                      </Box>
                    </Box>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 1 }}>
                  No items added yet
                </Typography>
              )}

              {/* Notes */}
              <TextField size="small" fullWidth multiline rows={2} label="Notes (optional)"
                value={notes} onChange={e => setNotes(e.target.value)} />
            </Stack>
          )}
        </Box>
      </DialogContent>

      {/* Actions */}
      <DialogActions sx={{ px: 2, pb: 2, gap: 1 }}>
        {createdOrder ? (
          <>
            <Button onClick={reset} sx={{ textTransform: 'none' }}>New Order</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={handleClose}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 100 }}>
              Close
            </Button>
          </>
        ) : (
          <>
            <Button onClick={handleClose} disabled={submitting} sx={{ textTransform: 'none' }}>Cancel</Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={handleSubmit}
              disabled={submitting || !items.length}
              sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 160 }}>
              {submitting
                ? <CircularProgress size={18} />
                : `Create Order${total ? ' · ' + fmt(total) : ''}`}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
