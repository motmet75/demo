import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardMedia from '@mui/material/CardMedia'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteIcon from '@mui/icons-material/Delete'
import CloseIcon from '@mui/icons-material/Close'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import NoteAltIcon from '@mui/icons-material/NoteAlt'
import TuneIcon from '@mui/icons-material/Tune'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import TakeoutDiningIcon from '@mui/icons-material/TakeoutDining'
import TableBarIcon from '@mui/icons-material/TableBar'
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import InputAdornment from '@mui/material/InputAdornment'
import { resolveToken, fetchMenu, createOrder, fetchPublicMenuOptions } from '../../api/shopApi'
import ItemOptionsDialog from './ItemOptionsDialog'
import OrderReceiptDialog from './OrderReceiptDialog'

const genUid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const fmt    = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

const FULFILLMENT_OPTIONS = [
  { value: 'PICKUP',   label: 'Pickup',   icon: <TakeoutDiningIcon fontSize="small" /> },
  { value: 'DINE_IN',  label: 'Dine In',  icon: <TableBarIcon fontSize="small" /> },
  { value: 'DELIVERY', label: 'Delivery', icon: <DeliveryDiningIcon fontSize="small" /> },
]

function fmtOpts(selectedOptions) {
  if (!selectedOptions) return null
  try {
    const obj = JSON.parse(selectedOptions)
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
      .join(' · ')
  } catch { return null }
}

function parseOpts(selectedOptions) {
  try { return selectedOptions ? JSON.parse(selectedOptions) : {} } catch { return {} }
}

export default function ShopMenuPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const tokenParam   = params.get('t')
  const rawTenantId  = params.get('tenantId')
  const rawCompanyId = params.get('companyId')
  const rawTableId   = params.get('tableId')
  const seqParam     = params.get('seq')

  const [ctx, setCtx] = useState(
    tokenParam ? null : { tenantId: rawTenantId, companyId: rawCompanyId, tableId: rawTableId }
  )
  const [menu, setMenu]                     = useState([])
  const [optionsByModel, setOptionsByModel] = useState({})
  const [loading, setLoading]               = useState(true)
  const [error, setError]                   = useState('')
  const [notes, setNotes]                   = useState('')
  const [checkout, setCheckout]             = useState(false)
  const [cartOpen, setCartOpen]             = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [placedOrder, setPlacedOrder]       = useState(null)
  const [form, setForm] = useState({
    fulfillmentType: 'PICKUP', customerName: '', customerPhone: '',
    deliveryAddress: '', paymentMethod: 'CASH',
  })

  // cart: { [uid]: { uid, modelId, qty, selectedOptions: string|null, itemNotes: string|null,
  //                  sideItems: [{uid, modelId, modelName, qty}] } }
  const [cart, setCart] = useState({})

  // sideForm: { [parentUid]: { model: menuItem|null, qty: number } }
  const [sideForm, setSideForm] = useState({})

  // optionsTarget: for initial add when item has configurable options
  const [optionsTarget, setOptionsTarget] = useState(null)

  // ── Data loading ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!tokenParam) return
    resolveToken(tokenParam)
      .then(({ res, data }) => {
        if (!res.ok) { setError('Invalid or expired QR code.'); setLoading(false); return }
        const resolved = { tenantId: data.tenantId, companyId: data.companyId, tableId: data.tableId }
        setCtx(resolved)
        if (resolved.tableId) setForm(f => ({ ...f, fulfillmentType: 'DINE_IN' }))
      })
      .catch(() => { setError('Failed to read QR code.'); setLoading(false) })
  }, [tokenParam])

  useEffect(() => {
    if (!ctx) return
    if (!ctx.tenantId || !ctx.companyId) { setError('Missing shop context.'); setLoading(false); return }
    Promise.all([
      fetchMenu(ctx.tenantId, ctx.companyId),
      fetchPublicMenuOptions(ctx.tenantId, ctx.companyId),
    ]).then(([menuRes, optsRes]) => {
      setMenu(Array.isArray(menuRes.data) ? menuRes.data : [])
      const byModel = {}
      ;(Array.isArray(optsRes.data) ? optsRes.data : []).forEach(opt => {
        if (!byModel[opt.modelId]) byModel[opt.modelId] = []
        byModel[opt.modelId].push(opt)
      })
      setOptionsByModel(byModel)
      setLoading(false)
    }).catch(() => { setError('Failed to load menu.'); setLoading(false) })
  }, [ctx])

  // ── Derived values ────────────────────────────────────────────────────
  const cartEntries = Object.values(cart)
  const itemCount   = cartEntries.reduce((n, e) => n + e.qty, 0)

  const calcOptAddOn = (entry) => {
    const groups = optionsByModel[entry.modelId] || []
    const opts   = parseOpts(entry.selectedOptions)
    return groups.reduce((sum, grp) => {
      if (grp.isFree) return sum
      let choiceDefs
      try { choiceDefs = JSON.parse(grp.choices) } catch { return sum }
      const cur    = opts[grp.groupName]
      const selArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
      return sum + choiceDefs
        .filter(c => typeof c === 'object' && selArr.includes(c.label))
        .reduce((s, c) => s + (Number(c.price) || 0), 0)
    }, 0)
  }

  const entryTotal = (entry) => {
    const m    = menu.find(x => x.id === entry.modelId)
    const base = m ? Number(m.sellingPrice || 0) : 0
    const main = entry.qty * (base + calcOptAddOn(entry))
    const side = (entry.sideItems || []).reduce((s, si) => {
      const sm = menu.find(x => x.id === si.modelId)
      return s + (sm ? Number(sm.sellingPrice || 0) : 0) * (si.qty || 1) * entry.qty
    }, 0)
    return main + side
  }

  const totalAmount = cartEntries.reduce((t, e) => t + entryTotal(e), 0)

  const getModelQty = (modelId) =>
    cartEntries.reduce((n, e) => n + (e.modelId === modelId ? e.qty : 0), 0)

  // ── Cart mutations ────────────────────────────────────────────────────
  const createEntry = (model, qty, selectedOptions, itemNotes) => {
    const id = genUid()
    setCart(prev => ({
      ...prev,
      [id]: { uid: id, modelId: model.id, qty, selectedOptions: selectedOptions || null, itemNotes: itemNotes || null, sideItems: [] },
    }))
  }

  const deleteEntry = (uid) =>
    setCart(prev => { const { [uid]: _, ...rest } = prev; return rest })

  const incrementEntry = (uid) =>
    setCart(prev => { const e = prev[uid]; if (!e) return prev; return { ...prev, [uid]: { ...e, qty: e.qty + 1 } } })

  const decrementEntry = (uid) =>
    setCart(prev => {
      const e = prev[uid]; if (!e) return prev
      if (e.qty <= 1) { const { [uid]: _, ...rest } = prev; return rest }
      return { ...prev, [uid]: { ...e, qty: e.qty - 1 } }
    })

  const toggleOption = (uid, groupName, value, multiSelect) =>
    setCart(prev => {
      const e = prev[uid]; if (!e) return prev
      const opts = parseOpts(e.selectedOptions)
      const cur  = opts[groupName]
      if (multiSelect) {
        const arr  = Array.isArray(cur) ? cur : (cur ? [cur] : [])
        const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
        if (next.length) opts[groupName] = next; else delete opts[groupName]
      } else {
        if (cur === value) delete opts[groupName]; else opts[groupName] = value
      }
      return { ...prev, [uid]: { ...e, selectedOptions: Object.keys(opts).length ? JSON.stringify(opts) : null } }
    })

  const setEntryNotes = (uid, val) =>
    setCart(prev => { const e = prev[uid]; if (!e) return prev; return { ...prev, [uid]: { ...e, itemNotes: val || null } } })

  const setSF = (parentUid, field, value) =>
    setSideForm(prev => ({ ...prev, [parentUid]: { ...(prev[parentUid] || {}), [field]: value } }))

  const addSideInline = (parentUid) => {
    const sf = sideForm[parentUid] || {}
    if (!sf.model) return
    const id = genUid()
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return {
        ...prev,
        [parentUid]: {
          ...parent,
          sideItems: [...(parent.sideItems || []),
            { uid: id, modelId: sf.model.id, modelName: sf.model.modelName, qty: sf.qty || 1 }],
        },
      }
    })
    setSideForm(prev => ({ ...prev, [parentUid]: {} }))
  }

  const changeSideQty = (parentUid, sideUid, delta) =>
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return {
        ...prev,
        [parentUid]: {
          ...parent,
          sideItems: parent.sideItems
            .map(si => si.uid === sideUid ? { ...si, qty: (si.qty || 1) + delta } : si)
            .filter(si => (si.qty || 1) > 0),
        },
      }
    })

  const removeSide = (parentUid, sideUid) =>
    setCart(prev => {
      const parent = prev[parentUid]; if (!parent) return prev
      return { ...prev, [parentUid]: { ...parent, sideItems: parent.sideItems.filter(si => si.uid !== sideUid) } }
    })

  // ── Menu card click handlers ──────────────────────────────────────────
  const handleAddClick = (model) => {
    const hasOpts = (optionsByModel[model.id] || []).length > 0
    if (hasOpts) {
      setOptionsTarget({ model })
    } else {
      const existing = cartEntries.find(e => e.modelId === model.id && !e.selectedOptions)
      if (existing) incrementEntry(existing.uid)
      else createEntry(model, 1, null, null)
    }
  }

  const handleRemoveClick = (modelId) => {
    const entries = cartEntries.filter(e => e.modelId === modelId)
    if (!entries.length) return
    decrementEntry([...entries].sort((a, b) => a.qty - b.qty)[0].uid)
  }

  const handleOptionsConfirm = ({ qty, selectedOptions, itemNotes }) => {
    if (qty > 0) createEntry(optionsTarget.model, qty, selectedOptions, itemNotes)
    setOptionsTarget(null)
  }

  // ── Order submission ──────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!itemCount) return
    setSubmitting(true); setError('')
    const items = cartEntries.map(entry => ({
      modelId: entry.modelId,
      quantity: entry.qty,
      selectedOptions: entry.selectedOptions || null,
      itemNotes: entry.itemNotes || null,
      sideItems: (entry.sideItems || []).map(side => ({
        modelId: side.modelId,
        quantity: side.qty || 1,
        selectedOptions: null,
        itemNotes: null,
        sideItems: [],
      })),
    }))
    const body = {
      fulfillmentType: form.fulfillmentType,
      tableId: ctx.tableId || null,
      customerName: form.customerName || null,
      customerPhone: form.customerPhone || null,
      deliveryAddress: form.fulfillmentType === 'DELIVERY' ? form.deliveryAddress : null,
      deliveryFee: null,
      paymentMethod: form.paymentMethod,
      notes: notes || null,
      manualOrderNumber: seqParam ? Number(seqParam) : null,
      token: tokenParam || null,
      items,
    }
    try {
      const { res, data } = await createOrder(ctx.tenantId, ctx.companyId, body)
      if (!res.ok) { setError(data?.message || 'Failed to place order'); setSubmitting(false); return }
      setCheckout(false); setCartOpen(false)
      setPlacedOrder({ ...data, _nav: `/shop/order/${data.orderCode}?tenantId=${ctx.tenantId}&companyId=${ctx.companyId}` })
    } catch { setError('Network error'); setSubmitting(false) }
  }

  const grouped = menu.reduce((g, m) => {
    const cat = m.category || 'Menu'
    if (!g[cat]) g[cat] = []
    g[cat].push(m)
    return g
  }, {})

  // ── Cart entry rows (used in both sidebar and mobile sheet) ───────────
  const CartEntryList = () => (
    <Stack spacing={0.75}>
      {cartEntries.map((entry, idx) => {
        const m      = menu.find(x => x.id === entry.modelId)
        if (!m) return null
        const opts   = parseOpts(entry.selectedOptions)
        const groups = optionsByModel[entry.modelId] || []
        const sf        = sideForm[entry.uid] || {}
        const eTotal    = entryTotal(entry)
        const sides     = entry.sideItems || []
        const unitPrice = Number(m.sellingPrice || 0) + calcOptAddOn(entry)
        const mainTotal = entry.qty * unitPrice
        const sideTotal = eTotal - mainTotal
        let allowedSideIds = null
        try { allowedSideIds = m.allowedSideIds ? JSON.parse(m.allowedSideIds) : null } catch { allowedSideIds = null }
        const allowedSideOptions = allowedSideIds ? menu.filter(x => allowedSideIds.includes(x.id)) : []
        const canAddSides = allowedSideOptions.length > 0

        return (
          <Box key={entry.uid} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>

            {/* ── Main item header ── */}
            <Box sx={{ bgcolor: '#f8faff', px: 1.5, pt: 1, pb: 0.75 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                <Typography variant="caption" sx={{ color: '#94a3b8', fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                  {idx + 1}.
                </Typography>
                {/* Name + unit price stacked */}
                <Box sx={{ flex: 1, minWidth: 80, overflow: 'hidden' }}>
                  <Typography variant="body2" fontWeight={700} noWrap>{m.modelName}</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11 }}>
                    {fmt(unitPrice)} / item
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                  <IconButton size="small" onClick={() => decrementEntry(entry.uid)} sx={{ p: 0.25 }}>
                    <RemoveIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <Typography variant="body2" fontWeight={700} sx={{ minWidth: 20, textAlign: 'center', fontSize: 13 }}>
                    {entry.qty}
                  </Typography>
                  <IconButton size="small" onClick={() => incrementEntry(entry.uid)}
                    sx={{ p: 0.25, bgcolor: '#1976d2', color: '#fff', borderRadius: 0.75, '&:hover': { bgcolor: '#1565c0' } }}>
                    <AddIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
                {/* Main item line total (sides shown separately below) */}
                <Typography variant="body2" color="primary" fontWeight={800}
                  sx={{ minWidth: 70, textAlign: 'right', fontSize: 13 }}>
                  {fmt(mainTotal)}
                </Typography>
                <IconButton size="small" color="error" onClick={() => deleteEntry(entry.uid)} sx={{ p: 0.25 }}>
                  <DeleteIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>

              {/* Inline option chips */}
              {groups.map(grp => {
                let choices = []
                try { choices = JSON.parse(grp.choices) } catch {}
                if (!choices.length) return null
                const cur    = opts[grp.groupName]
                const selArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
                return (
                  <Box key={grp.id} sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary"
                      sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      {grp.groupName}{grp.required ? ' *' : ''}{grp.isFree ? ' (free)' : ''}
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                      {choices.map(choice => {
                        const c      = typeof choice === 'object' ? choice : { label: String(choice), price: 0 }
                        const active = selArr.includes(c.label)
                        const tag    = (!grp.isFree && c.price > 0) ? ` +${Number(c.price).toLocaleString('vi-VN')}đ` : ''
                        return (
                          <Chip key={c.label} label={c.label + tag} size="small"
                            onClick={() => toggleOption(entry.uid, grp.groupName, c.label, grp.multiSelect)}
                            sx={{
                              height: 22, fontSize: 11, cursor: 'pointer',
                              bgcolor: active ? '#1976d2' : '#fff',
                              color: active ? '#fff' : '#555',
                              border: `1px solid ${active ? '#1976d2' : '#ddd'}`,
                              fontWeight: active ? 700 : 400,
                              '&:hover': { bgcolor: active ? '#1565c0' : '#f0f4ff' },
                            }} />
                        )
                      })}
                    </Box>
                  </Box>
                )
              })}

              {/* Inline item notes */}
              <TextField size="small" variant="standard" fullWidth
                placeholder="Item note (e.g. no sugar, extra spicy…)"
                value={entry.itemNotes || ''}
                onChange={e => setEntryNotes(entry.uid, e.target.value)}
                InputProps={{
                  disableUnderline: false,
                  startAdornment: <InputAdornment position="start"><NoteAltIcon sx={{ fontSize: 14, color: '#ccc' }} /></InputAdornment>,
                  sx: { fontSize: 12 },
                }}
                sx={{ mt: 0.5 }}
              />
            </Box>

            {/* ── Side items tree ── */}
            <Box sx={{ bgcolor: '#f0f4ff', borderTop: '1px solid #e2e8f0' }}>
              <Box sx={{ ml: 1.5, borderLeft: '2px solid #c7d2fe' }}>

                {/* Existing side items */}
                {sides.map(si => {
                  const sm = menu.find(x => x.id === si.modelId)
                  return (
                    <Box key={si.uid} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75, py: 0.5, borderBottom: '1px solid #e8eaf6', flexWrap: 'wrap' }}>
                      <Box sx={{ width: 12, height: 2, bgcolor: '#c7d2fe', flexShrink: 0 }} />
                      <Typography variant="caption" fontWeight={600} sx={{ flex: 1, fontSize: 12, minWidth: 60 }} noWrap>
                        {si.modelName}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.2 }}>
                        <IconButton size="small" onClick={() => changeSideQty(entry.uid, si.uid, -1)} sx={{ p: 0.2 }}>
                          <RemoveIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                        <Typography variant="caption" fontWeight={700} sx={{ minWidth: 18, textAlign: 'center', fontSize: 12 }}>
                          {si.qty || 1}
                        </Typography>
                        <IconButton size="small" onClick={() => changeSideQty(entry.uid, si.uid, 1)}
                          sx={{ p: 0.2, bgcolor: '#6366f1', color: '#fff', borderRadius: 0.5, '&:hover': { bgcolor: '#4f46e5' } }}>
                          <AddIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                      <Typography variant="caption" color="primary" fontWeight={700} sx={{ minWidth: 56, textAlign: 'right', fontSize: 12 }}>
                        {sm ? fmt((si.qty || 1) * Number(sm.sellingPrice || 0) * entry.qty) : ''}
                      </Typography>
                      <IconButton size="small" onClick={() => removeSide(entry.uid, si.uid)}
                        sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                        <CloseIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    </Box>
                  )
                })}

                {/* Block total — only shown when there are side items */}
                {sides.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.75, py: 0.5, borderTop: '1px dashed #c7d2fe' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11 }}>
                      {fmt(mainTotal)} + {fmt(sideTotal)} sides
                    </Typography>
                    <Typography variant="caption" fontWeight={800} color="primary" sx={{ fontSize: 12 }}>
                      = {fmt(eTotal)}
                    </Typography>
                  </Box>
                )}

                {/* Add side inline form — only shown when the item has configured allowed sides */}
                {canAddSides && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, py: 0.6, pr: 0.75, flexWrap: 'wrap' }}>
                  <Box sx={{ width: 12, height: 2, bgcolor: '#a5b4fc', flexShrink: 0, mt: 2.25 }} />
                  <Autocomplete
                    size="small"
                    options={allowedSideOptions}
                    getOptionLabel={m => m.modelName}
                    value={sf.model || null}
                    onChange={(_, v) => setSF(entry.uid, 'model', v)}
                    renderInput={params => <TextField {...params} label="Add side / topping…" size="small" />}
                    isOptionEqualToValue={(a, b) => a.id === b.id}
                    noOptionsText="No items"
                    sx={{ flex: 1, minWidth: 130 }}
                  />
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                    <IconButton size="small" onClick={() => setSF(entry.uid, 'qty', Math.max(1, (sf.qty || 1) - 1))} sx={{ p: 0.2 }}>
                      <RemoveIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                    <Typography variant="caption" fontWeight={700} sx={{ minWidth: 18, textAlign: 'center', fontSize: 12 }}>
                      {sf.qty || 1}
                    </Typography>
                    <IconButton size="small" onClick={() => setSF(entry.uid, 'qty', (sf.qty || 1) + 1)}
                      sx={{ p: 0.2, bgcolor: '#6366f1', color: '#fff', borderRadius: 0.5, '&:hover': { bgcolor: '#4f46e5' } }}>
                      <AddIcon sx={{ fontSize: 12 }} />
                    </IconButton>
                  </Box>
                  <Button size="small" variant="contained"
                    startIcon={<PlaylistAddIcon sx={{ fontSize: 14 }} />}
                    onClick={() => addSideInline(entry.uid)}
                    disabled={!sf.model}
                    sx={{
                      textTransform: 'none', fontSize: 11, height: 36, flexShrink: 0,
                      bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' },
                      '&.Mui-disabled': { bgcolor: '#e0e0e0' },
                    }}>
                    Add
                  </Button>
                </Box>
                )}

              </Box>
            </Box>
          </Box>
        )
      })}
    </Stack>
  )

  // ── Cart panel ────────────────────────────────────────────────────────
  const CartPanel = ({ onCheckout }) => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6" fontWeight={800}>Your Order</Typography>

      {itemCount === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
          <ShoppingCartIcon sx={{ fontSize: 36, mb: 0.5, opacity: 0.3 }} />
          <Typography variant="body2">Add items to start your order</Typography>
        </Box>
      ) : (
        <>
          <CartEntryList />

          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={700}>Total</Typography>
            <Typography fontWeight={800} color="primary">{fmt(totalAmount)}</Typography>
          </Box>

          <TextField size="small" fullWidth multiline rows={2} label="Order notes" placeholder="Special requests..."
            value={notes} onChange={e => setNotes(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />

          <Button variant="contained" fullWidth size="large" onClick={onCheckout}
            sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none', fontSize: 15 }}>
            Checkout · {fmt(totalAmount)}
          </Button>
        </>
      )}
    </Box>
  )

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
  if (!ctx?.tenantId || !ctx?.companyId) return (
    <Box sx={{ p: 3 }}><Alert severity="error">{error || 'Invalid QR code — missing shop context.'}</Alert></Box>
  )

  return (
    <Box sx={{ bgcolor: '#fafafa', minHeight: '100vh' }}>

      {/* ── Top banner ──────────────────────────────────────── */}
      <Box sx={{ background: 'linear-gradient(135deg, #1565c0 0%, #0288d1 100%)', color: '#fff', px: 2.5, py: { xs: 2.5, md: 3 }, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={800} letterSpacing={1}>Order</Typography>
        {ctx.tableId && (
          <Chip icon={<TableBarIcon sx={{ color: '#fff !important', fontSize: 14 }} />}
            label="Dine In" size="small"
            sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }} />
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{error}</Alert>}

      <Box sx={{
        display: { xs: 'block', md: 'flex' },
        alignItems: 'flex-start',
        maxWidth: { md: 1100 },
        mx: 'auto',
        px: { xs: 0, md: 2 },
        pt: { xs: 0, md: 2 },
        gap: 3,
      }}>

        {/* ── Menu grid ─────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0, px: { xs: 1.5, md: 0 }, pt: { xs: 1.5, md: 0 }, pb: { xs: 16, md: 4 } }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <Box key={cat} sx={{ mb: 3 }}>
              <Typography variant="overline" fontWeight={700} color="primary"
                sx={{ letterSpacing: 1.5, display: 'block', mb: 1 }}>{cat}</Typography>
              <Stack spacing={1}>
                {items.map(m => {
                  const qty      = getModelQty(m.id)
                  const hasOpts  = (optionsByModel[m.id] || []).length > 0
                  const variants = cartEntries.filter(e => e.modelId === m.id)
                  const solo     = variants.length === 1 ? variants[0] : null
                  const optsStr  = fmtOpts(solo?.selectedOptions)
                  const noteStr  = solo?.itemNotes
                  return (
                    <Card key={m.id} elevation={0} sx={{
                      borderRadius: 2,
                      border: qty > 0 ? '1.5px solid #1976d2' : '1px solid #e8e8e8',
                      bgcolor: '#fff', transition: 'border-color 0.15s', overflow: 'hidden',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {/* Thumbnail — always present; grey placeholder when no image */}
                        <Box sx={{
                          width: { xs: 88, md: 96 }, height: { xs: 88, md: 96 },
                          flexShrink: 0, bgcolor: '#f0f0f0', overflow: 'hidden',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {m.imageUrl ? (
                            <Box component="img" src={m.imageUrl} alt={m.modelName}
                              sx={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                              onError={e => { e.target.style.display = 'none'; e.target.parentNode.style.background = '#e8eaf6' }} />
                          ) : (
                            <Typography sx={{ fontSize: 28, lineHeight: 1, userSelect: 'none', opacity: 0.25 }}>🍽</Typography>
                          )}
                        </Box>
                        <Box sx={{ flex: 1, px: 1.5, py: 1.25 }}>
                          <Typography
                            fontWeight={800}
                            lineHeight={1.25}
                            sx={{ fontSize: { xs: 15, md: 16 }, letterSpacing: 0 }}>
                            {m.modelName}
                          </Typography>
                          <Typography
                            color="primary" fontWeight={700}
                            sx={{ mt: 0.4, fontSize: { xs: 14, md: 15 } }}>
                            {fmt(m.sellingPrice)}
                          </Typography>
                          {hasOpts && (
                            <Chip icon={<TuneIcon sx={{ fontSize: '12px !important' }} />} label="customizable"
                              size="small" variant="outlined"
                              sx={{ mt: 0.5, fontSize: 10, height: 18, color: 'text.secondary', borderColor: '#ddd' }} />
                          )}
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1 }}>
                          {qty > 0 && (
                            <>
                              <IconButton size="small" onClick={() => handleRemoveClick(m.id)}
                                sx={{ bgcolor: '#f0f0f0', '&:hover': { bgcolor: '#e0e0e0' } }}>
                                <RemoveIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                              <Typography variant="body2" fontWeight={700} sx={{ minWidth: 22, textAlign: 'center' }}>{qty}</Typography>
                            </>
                          )}
                          <IconButton size="small" onClick={() => handleAddClick(m)}
                            sx={{ bgcolor: '#1976d2', color: '#fff', '&:hover': { bgcolor: '#1565c0' } }}>
                            <AddIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      </Box>

                      {variants.length > 1 && (
                        <Box sx={{ px: 1.5, py: 0.5, bgcolor: '#e3f2fd', borderTop: '1px solid #bbdefb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" color="primary">
                            {variants.length} variations in cart
                          </Typography>
                          <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', fontWeight: 700, display: { xs: 'inline', md: 'none' } }}
                            onClick={() => setCartOpen(true)}>
                            Edit →
                          </Typography>
                        </Box>
                      )}

                      {solo && (optsStr || noteStr) && (
                        <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#e3f2fd', borderTop: '1px solid #bbdefb', display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Box sx={{ flex: 1 }}>
                            {optsStr && <Typography variant="caption" color="primary" display="block" noWrap>{optsStr}</Typography>}
                            {noteStr && <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ fontStyle: 'italic' }}>{noteStr}</Typography>}
                          </Box>
                          <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', fontWeight: 700, display: { xs: 'inline', md: 'none' } }}
                            onClick={() => setCartOpen(true)}>
                            Edit →
                          </Typography>
                        </Box>
                      )}
                    </Card>
                  )
                })}
              </Stack>
            </Box>
          ))}
        </Box>

        {/* ── Desktop right sidebar ──────────────────────────── */}
        <Box sx={{
          display: { xs: 'none', md: 'block' },
          width: 380, flexShrink: 0,
          position: 'sticky', top: 16,
          bgcolor: '#fff', borderRadius: 3,
          border: '1px solid #e8e8e8',
          p: 2.5,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
        }}>
          <CartPanel onCheckout={() => setCheckout(true)} />
        </Box>
      </Box>

      {/* ── Mobile bottom bar ──────────────────────────────────── */}
      {itemCount > 0 && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          borderTop: '1px solid #e0e0e0', bgcolor: '#fff',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.10)',
          alignItems: 'center', gap: 1, px: 2, py: 1.25,
        }}>
          <Button variant="outlined" size="medium" onClick={() => setCartOpen(true)}
            startIcon={<ShoppingCartIcon />}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', flexShrink: 0 }}>
            Cart ({itemCount})
          </Button>
          <Button variant="contained" size="medium" fullWidth onClick={() => setCheckout(true)}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
            Checkout · {fmt(totalAmount)}
          </Button>
        </Box>
      )}

      {/* ── Mobile cart bottom sheet ──────────────────────────── */}
      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} fullWidth maxWidth="sm"
        PaperProps={{ sx: { position: 'fixed', bottom: 0, left: 0, right: 0, m: 0, borderRadius: '16px 16px 0 0', maxHeight: '90vh' } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', pb: 1 }}>
          <Typography fontWeight={800} variant="h6" sx={{ flex: 1 }}>Your Cart</Typography>
          <IconButton size="small" onClick={() => setCartOpen(false)}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent sx={{ overflowY: 'auto' }}>
          <CartPanel onCheckout={() => { setCartOpen(false); setCheckout(true) }} />
        </DialogContent>
      </Dialog>

      {/* ── Checkout dialog ──────────────────────────────────────── */}
      <Dialog open={checkout} onClose={() => setCheckout(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography fontWeight={700} variant="h6">Place Order</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>Order type</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {FULFILLMENT_OPTIONS.map(opt => (
                  <Box key={opt.value} onClick={() => setForm(f => ({ ...f, fulfillmentType: opt.value }))} sx={{
                    flex: 1, border: '1.5px solid', borderRadius: 2, py: 1, px: 0.5, textAlign: 'center', cursor: 'pointer',
                    borderColor: form.fulfillmentType === opt.value ? 'primary.main' : '#e0e0e0',
                    bgcolor: form.fulfillmentType === opt.value ? '#e3f2fd' : '#fff',
                    transition: 'all 0.15s',
                  }}>
                    <Box sx={{ color: form.fulfillmentType === opt.value ? 'primary.main' : 'text.secondary' }}>{opt.icon}</Box>
                    <Typography variant="caption" fontWeight={600}
                      color={form.fulfillmentType === opt.value ? 'primary.main' : 'text.secondary'}>{opt.label}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <TextField label="Your name" size="small" fullWidth value={form.customerName}
              onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
            <TextField label="Phone" size="small" fullWidth type="tel" value={form.customerPhone}
              onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />
            {form.fulfillmentType === 'DELIVERY' && (
              <TextField label="Delivery address" size="small" fullWidth multiline rows={2}
                value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))} />
            )}
            <TextField label="Order notes" size="small" fullWidth multiline rows={2}
              placeholder="Delivery instructions, special requests..."
              value={notes} onChange={e => setNotes(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />
            <FormControl size="small" fullWidth>
              <InputLabel>Payment</InputLabel>
              <Select value={form.paymentMethod} label="Payment"
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="BANK_QR">Bank QR</MenuItem>
              </Select>
            </FormControl>

            <Divider />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Your order</Typography>
              {cartEntries.map((entry, idx) => {
                const m       = menu.find(x => x.id === entry.modelId)
                if (!m) return null
                const optsStr = fmtOpts(entry.selectedOptions)
                return (
                  <Box key={entry.uid} sx={{ mb: 0.75 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{idx + 1}. {entry.qty}× {m.modelName}</Typography>
                      <Typography variant="body2" color="primary">{fmt(entryTotal(entry))}</Typography>
                    </Box>
                    {optsStr && (
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block' }}>{optsStr}</Typography>
                    )}
                    {entry.itemNotes && (
                      <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block', fontStyle: 'italic' }}>
                        Note: {entry.itemNotes}
                      </Typography>
                    )}
                    {(entry.sideItems || []).map(side => {
                      const sm = menu.find(x => x.id === side.modelId)
                      if (!sm) return null
                      return (
                        <Box key={side.uid} sx={{ display: 'flex', justifyContent: 'space-between', pl: 2 }}>
                          <Typography variant="caption" color="text.secondary">↳ {side.qty || 1}× {sm.modelName}</Typography>
                          <Typography variant="caption" color="primary">{fmt((side.qty || 1) * Number(sm.sellingPrice) * entry.qty)}</Typography>
                        </Box>
                      )
                    })}
                  </Box>
                )
              })}
              <Divider sx={{ my: 0.75 }} />
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography fontWeight={700}>Total</Typography>
                <Typography fontWeight={700} color="primary">{fmt(totalAmount)}</Typography>
              </Box>
            </Box>

            {error && <Alert severity="error">{error}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setCheckout(false)} disabled={submitting}>Back</Button>
          <Button variant="contained" fullWidth onClick={handlePlaceOrder} disabled={submitting}
            sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}>
            {submitting ? <CircularProgress size={20} /> : `Confirm Order · ${fmt(totalAmount)}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Receipt dialog ───────────────────────────────────────── */}
      <OrderReceiptDialog
        open={Boolean(placedOrder)}
        order={placedOrder}
        onClose={() => { navigate(placedOrder?._nav); setPlacedOrder(null) }}
        onTrack={() => { navigate(placedOrder?._nav); setPlacedOrder(null) }}
      />

      {/* ── Options dialog (initial add for items with configurable options) ── */}
      {optionsTarget && (
        <ItemOptionsDialog
          open={Boolean(optionsTarget)}
          model={optionsTarget.model}
          options={optionsByModel[optionsTarget.model?.id] || []}
          initialCart={null}
          onConfirm={handleOptionsConfirm}
          onClose={() => setOptionsTarget(null)}
        />
      )}
    </Box>
  )
}
