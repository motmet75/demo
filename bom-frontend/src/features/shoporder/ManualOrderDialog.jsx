import React, { useEffect, useState, useMemo } from 'react'
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
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteIcon from '@mui/icons-material/Delete'
import PrintIcon from '@mui/icons-material/Print'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import TableBarIcon from '@mui/icons-material/TableBar'
import TakeoutDiningIcon from '@mui/icons-material/TakeoutDining'
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import { fetchModels } from '../../api/modelApi'
import { fetchShopTables, createStaffOrder, fetchOrderTagQr, fetchMenuOptions } from '../../api/shopApi'
import { printOrderReceipt } from '../../utils/printOrderReceipt'
import { printOrderTag } from '../../utils/printOrderReceipt'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

const FULFILLMENT = [
  { value: 'PICKUP',   label: 'Pickup',   icon: <TakeoutDiningIcon fontSize="small" /> },
  { value: 'DINE_IN',  label: 'Dine In',  icon: <TableBarIcon fontSize="small" /> },
  { value: 'DELIVERY', label: 'Delivery', icon: <DeliveryDiningIcon fontSize="small" /> },
]

export default function ManualOrderDialog({ open, onClose, onCreated, defaultTable, defaultItems }) {
  const [models, setModels]     = useState([])
  const [tables, setTables]     = useState([])
  const [loading, setLoading]   = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  // form state
  const [manualNum, setManualNum]     = useState('')
  const [fulfillment, setFulfillment] = useState(defaultTable ? 'DINE_IN' : 'PICKUP')
  const [tableId, setTableId]         = useState(defaultTable?.id || '')
  const [customer, setCustomer]       = useState({ name: '', phone: '' })
  const [payment, setPayment]         = useState('CASH')
  const [notes, setNotes]             = useState('')
  const [items, setItems]             = useState([])   // [{ modelId, modelName, sellingPrice, qty, selectedOptions:{}, itemNotes:'' }]
  const [selectedModel, setSelectedModel] = useState(null)
  const [optsByModel, setOptsByModel] = useState({})  // { [modelId]: ModelMenuOption[] }

  // success state
  const [createdOrder, setCreatedOrder]   = useState(null)
  const [tagQr, setTagQr]                 = useState('')
  const [tagLoading, setTagLoading]       = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    // Pre-populate items from stock if provided
    if (defaultItems?.length) {
      setItems(defaultItems.map(i => ({
        modelId: i.modelId, modelName: i.modelName,
        sellingPrice: i.sellingPrice, qty: i.qty,
        selectedOptions: i.selectedOptions || {}, itemNotes: i.itemNotes || '',
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

  const reset = () => {
    setManualNum(''); setFulfillment(defaultTable ? 'DINE_IN' : 'PICKUP'); setTableId(defaultTable?.id || '')
    setCustomer({ name: '', phone: '' }); setPayment('CASH'); setNotes('')
    setItems([]); setSelectedModel(null); setError('')
    setCreatedOrder(null); setTagQr(''); setOptsByModel({})
  }

  const handleClose = () => { reset(); onClose() }

  const addItem = () => {
    if (!selectedModel) return
    const mid = selectedModel.id
    setItems(prev => {
      const existing = prev.find(i => i.modelId === mid)
      if (existing) return prev.map(i => i.modelId === mid ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { modelId: mid, modelName: selectedModel.modelName, sellingPrice: selectedModel.sellingPrice, qty: 1, selectedOptions: {}, itemNotes: '' }]
    })
    // fetch options for this model if not already loaded
    if (!optsByModel[mid]) {
      fetchMenuOptions(mid)
        .then(({ data }) => setOptsByModel(prev => ({ ...prev, [mid]: Array.isArray(data) ? data : [] })))
        .catch(() => setOptsByModel(prev => ({ ...prev, [mid]: [] })))
    }
    setSelectedModel(null)
  }

  const toggleOption = (modelId, groupName, value, multiSelect) => {
    setItems(prev => prev.map(item => {
      if (item.modelId !== modelId) return item
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

  const setItemNotes = (modelId, notes) => {
    setItems(prev => prev.map(i => i.modelId === modelId ? { ...i, itemNotes: notes } : i))
  }

  const changeQty = (modelId, delta) => {
    setItems(prev => {
      const next = prev.map(i => i.modelId === modelId ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
      return next
    })
  }

  const total = items.reduce((s, i) => s + i.qty * Number(i.sellingPrice || 0), 0)

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
        modelId: i.modelId,
        quantity: i.qty,
        selectedOptions: Object.keys(i.selectedOptions || {}).length > 0 ? JSON.stringify(i.selectedOptions) : null,
        itemNotes: i.itemNotes || null,
      })),
    }
    try {
      const { res, data } = await createStaffOrder(body)
      if (!res.ok) { setError(data?.message || 'Failed to create order'); setSubmitting(false); return }
      setCreatedOrder(data)
      onCreated?.()
      // fetch tag QR
      setTagLoading(true)
      fetchOrderTagQr(data.id)
        .then(({ data: qr }) => setTagQr(qr?.qrBase64 || ''))
        .catch(() => {})
        .finally(() => setTagLoading(false))
    } catch (e) { setError(e.message || 'Network error') }
    setSubmitting(false)
  }

  const tableName = useMemo(() => {
    if (!tableId) return ''
    return tables.find(t => t.id === tableId)?.tableName || ''
  }, [tableId, tables])

  // ── Success screen ───────────────────────────────────────────────
  if (createdOrder) {
    const num = createdOrder.orderNumber ? `#${createdOrder.orderNumber}` : createdOrder.orderCode
    return (
      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
        <Box sx={{ bgcolor: '#1e293b', color: '#fff', textAlign: 'center', px: 3, pt: 3, pb: 2.5 }}>
          <CheckCircleIcon sx={{ fontSize: 28, color: '#4ade80', mb: 0.5 }} />
          <Typography variant="body2" sx={{ opacity: 0.6, letterSpacing: 1, textTransform: 'uppercase' }}>Order Created</Typography>
          <Typography sx={{ fontSize: 64, fontWeight: 900, lineHeight: 1, letterSpacing: -2 }}>{num}</Typography>
          {createdOrder.tableName && <Chip icon={<TableBarIcon sx={{ color: '#fff !important', fontSize: 13 }} />}
            label={`Table ${createdOrder.tableName}`} size="small"
            sx={{ mt: 0.5, bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />}
        </Box>
        <DialogContent sx={{ pt: 1.5, pb: 0 }}>
          <Stack spacing={0.5} sx={{ mb: 1 }}>
            {(createdOrder.items || []).map(item => (
              <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body2">{Number(item.quantity)}× {item.modelName}</Typography>
                <Typography variant="body2" color="primary">{fmt(item.lineTotal)}</Typography>
              </Box>
            ))}
            <Divider sx={{ my: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography fontWeight={800}>Total</Typography>
              <Typography fontWeight={800} color="primary">{fmt(createdOrder.totalAmount)}</Typography>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2, pt: 1, flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
            <Button variant="outlined" fullWidth startIcon={tagLoading ? <CircularProgress size={14} /> : <QrCode2Icon />}
              disabled={tagLoading || !tagQr}
              onClick={() => printOrderTag(createdOrder, tagQr)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
              Print Tag
            </Button>
            <Button variant="outlined" fullWidth startIcon={<PrintIcon />}
              onClick={() => printOrderReceipt(createdOrder)}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
              Receipt
            </Button>
          </Box>
          <Button variant="contained" fullWidth onClick={handleClose}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    )
  }

  // ── Form screen ──────────────────────────────────────────────────
  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={800} variant="h6">New Manual Order</Typography>
        <Typography variant="caption" color="text.secondary">Staff-created order</Typography>
      </DialogTitle>
      <DialogContent>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

            {/* Order number + fulfillment */}
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField
                label="Order # (optional)"
                size="small"
                type="number"
                value={manualNum}
                onChange={e => setManualNum(e.target.value)}
                placeholder="auto"
                sx={{ width: 140, flexShrink: 0 }}
                inputProps={{ min: 1 }}
                helperText="Leave blank for auto"
              />
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Type</Typography>
                <Box sx={{ display: 'flex', gap: 0.75 }}>
                  {FULFILLMENT.map(opt => (
                    <Box key={opt.value} onClick={() => setFulfillment(opt.value)} sx={{
                      flex: 1, border: '1.5px solid', borderRadius: 1.5, py: 0.75, textAlign: 'center',
                      cursor: 'pointer', fontSize: 11,
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

            {/* Table selector */}
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
              <TextField size="small" label="Customer name" fullWidth value={customer.name}
                onChange={e => setCustomer(c => ({ ...c, name: e.target.value }))} />
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

            {/* Item search + add (also a drop zone) */}
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

            {/* Items list — also a drop zone for stock items */}
            {items.length > 0 ? (
              <Stack spacing={0.75}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault()
                  try {
                    const item = JSON.parse(e.dataTransfer.getData('application/json'))
                    setItems(prev => {
                      const existing = prev.find(i => i.modelId === item.modelId)
                      if (existing) return prev.map(i => i.modelId === item.modelId ? { ...i, qty: i.qty + (item.qty || 1) } : i)
                      return [...prev, { modelId: item.modelId, modelName: item.modelName, sellingPrice: item.sellingPrice, qty: item.qty || 1, selectedOptions: {}, itemNotes: '' }]
                    })
                  } catch { /* ignore */ }
                }}
              >
                {items.map(item => {
                  const modelOpts = optsByModel[item.modelId] || []
                  return (
                    <Box key={item.modelId} sx={{ bgcolor: '#f9f9f9', borderRadius: 1.5, px: 1.25, pt: 0.75, pb: 0.5 }}>
                      {/* Item row */}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ flex: 1, minWidth: 0 }} noWrap>
                          {item.modelName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: 12 }}>
                          {fmt(item.sellingPrice)}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <IconButton size="small" onClick={() => changeQty(item.modelId, -1)} sx={{ p: 0.25 }}>
                            <RemoveIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 20, textAlign: 'center' }}>
                            {item.qty}
                          </Typography>
                          <IconButton size="small" onClick={() => changeQty(item.modelId, 1)}
                            sx={{ p: 0.25, bgcolor: '#1976d2', color: '#fff', '&:hover': { bgcolor: '#1565c0' } }}>
                            <AddIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                        <Typography variant="body2" color="primary" fontWeight={700} sx={{ minWidth: 64, textAlign: 'right', fontSize: 13 }}>
                          {fmt(item.qty * Number(item.sellingPrice || 0))}
                        </Typography>
                        <IconButton size="small" color="error" onClick={() => setItems(prev => prev.filter(i => i.modelId !== item.modelId))} sx={{ p: 0.25, ml: 0.25 }}>
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>

                      {/* Option groups (chips) */}
                      {modelOpts.map(grp => {
                        const choices = (() => { try { return JSON.parse(grp.choices) } catch { return [] } })()
                        if (!choices.length) return null
                        const curVal = item.selectedOptions[grp.groupName]
                        const selArr = Array.isArray(curVal) ? curVal : (curVal ? [curVal] : [])
                        return (
                          <Box key={grp.id} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {grp.groupName}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                              {choices.map(choice => {
                                const active = selArr.includes(choice)
                                return (
                                  <Chip
                                    key={choice}
                                    label={choice}
                                    size="small"
                                    onClick={() => toggleOption(item.modelId, grp.groupName, choice, grp.multiSelect)}
                                    sx={{
                                      height: 22, fontSize: 11, cursor: 'pointer',
                                      bgcolor: active ? '#1976d2' : '#fff',
                                      color: active ? '#fff' : '#555',
                                      border: `1px solid ${active ? '#1976d2' : '#ddd'}`,
                                      fontWeight: active ? 700 : 400,
                                      '&:hover': { bgcolor: active ? '#1565c0' : '#f0f4ff' },
                                    }}
                                  />
                                )
                              })}
                            </Box>
                          </Box>
                        )
                      })}

                      {/* Per-item notes */}
                      <TextField
                        size="small" variant="standard" fullWidth
                        placeholder="Item note (e.g. no sugar, extra spicy…)"
                        value={item.itemNotes || ''}
                        onChange={e => setItemNotes(item.modelId, e.target.value)}
                        InputProps={{ disableUnderline: false, sx: { fontSize: 12 } }}
                        sx={{ mt: 0.5, mb: 0.25 }}
                      />
                    </Box>
                  )
                })}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, px: 1 }}>
                  <Typography fontWeight={800}>Total</Typography>
                  <Typography fontWeight={800} color="primary">{fmt(total)}</Typography>
                </Box>
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
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={handleClose} disabled={submitting}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit}
          disabled={submitting || !items.length}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 140 }}>
          {submitting ? <CircularProgress size={18} /> : `Create Order${total ? ' · ' + fmt(total) : ''}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
