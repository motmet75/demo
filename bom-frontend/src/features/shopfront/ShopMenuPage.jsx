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
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import NoteAltIcon from '@mui/icons-material/NoteAlt'
import TuneIcon from '@mui/icons-material/Tune'
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

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

const FULFILLMENT_OPTIONS = [
  { value: 'PICKUP',   label: 'Pickup',   icon: <TakeoutDiningIcon fontSize="small" /> },
  { value: 'DINE_IN',  label: 'Dine In',  icon: <TableBarIcon fontSize="small" /> },
  { value: 'DELIVERY', label: 'Delivery', icon: <DeliveryDiningIcon fontSize="small" /> },
]

function fmtOpts(selectedOptions) {
  if (!selectedOptions) return null
  try {
    const obj = JSON.parse(selectedOptions)
    return Object.entries(obj).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')
  } catch { return null }
}

export default function ShopMenuPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const tokenParam   = params.get('t')
  const rawTenantId  = params.get('tenantId')
  const rawCompanyId = params.get('companyId')
  const rawTableId   = params.get('tableId')
  const seqParam     = params.get('seq')    // pre-assigned order sequence number

  const [ctx, setCtx] = useState(
    tokenParam ? null : { tenantId: rawTenantId, companyId: rawCompanyId, tableId: rawTableId }
  )
  const [menu, setMenu]                   = useState([])
  const [optionsByModel, setOptionsByModel] = useState({})
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [cart, setCart]                   = useState({})   // { [modelId]: { qty, selectedOptions, itemNotes } }
  const [notes, setNotes]                 = useState('')
  const [checkout, setCheckout]           = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [optionsTarget, setOptionsTarget] = useState(null)
  const [placedOrder, setPlacedOrder]     = useState(null)
  const [form, setForm] = useState({ fulfillmentType: 'PICKUP', customerName: '', customerPhone: '', deliveryAddress: '', paymentMethod: 'CASH' })

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

  const itemCount   = Object.values(cart).reduce((s, e) => s + e.qty, 0)
  const totalAmount = menu.reduce((s, m) => s + (cart[m.id]?.qty || 0) * Number(m.sellingPrice || 0), 0)

  const handleAddClick = (m) => {
    const hasOpts = (optionsByModel[m.id] || []).length > 0
    if (hasOpts && !cart[m.id]) {
      setOptionsTarget(m)
    } else {
      setCart(prev => {
        const existing = prev[m.id] || { qty: 0, selectedOptions: null, itemNotes: null }
        return { ...prev, [m.id]: { ...existing, qty: existing.qty + 1 } }
      })
    }
  }

  const handleRemoveClick = (id) => {
    setCart(prev => {
      const existing = prev[id]
      if (!existing || existing.qty <= 1) { const { [id]: _, ...rest } = prev; return rest }
      return { ...prev, [id]: { ...existing, qty: existing.qty - 1 } }
    })
  }

  const handleOptionsConfirm = ({ qty, selectedOptions, itemNotes }) => {
    const id = optionsTarget.id
    if (qty <= 0) { setCart(prev => { const { [id]: _, ...rest } = prev; return rest }) }
    else setCart(prev => ({ ...prev, [id]: { qty, selectedOptions, itemNotes } }))
    setOptionsTarget(null)
  }

  const grouped = menu.reduce((g, m) => {
    const cat = m.category || 'Menu'
    if (!g[cat]) g[cat] = []
    g[cat].push(m)
    return g
  }, {})

  const handlePlaceOrder = async () => {
    if (!itemCount) return
    setSubmitting(true); setError('')
    const items = Object.entries(cart).map(([modelId, { qty, selectedOptions, itemNotes }]) => ({
      modelId, quantity: qty, selectedOptions: selectedOptions || null, itemNotes: itemNotes || null,
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
      setCheckout(false)
      setPlacedOrder({ ...data, _nav: `/shop/order/${data.orderCode}?tenantId=${ctx.tenantId}&companyId=${ctx.companyId}` })
    } catch { setError('Network error'); setSubmitting(false) }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
  if (!ctx?.tenantId || !ctx?.companyId) return (
    <Box sx={{ p: 3 }}><Alert severity="error">{error || 'Invalid QR code — missing shop context.'}</Alert></Box>
  )

  // ── Cart panel used on desktop right column ───────────────────────
  const CartPanel = () => (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h6" fontWeight={800}>Your Order</Typography>

      {itemCount === 0 ? (
        <Box sx={{ textAlign: 'center', py: 4, color: 'text.disabled' }}>
          <ShoppingCartIcon sx={{ fontSize: 36, mb: 0.5, opacity: 0.3 }} />
          <Typography variant="body2">Add items to start your order</Typography>
        </Box>
      ) : (
        <>
          <Stack spacing={0.75}>
            {Object.entries(cart).map(([id, { qty, selectedOptions, itemNotes }]) => {
              const m = menu.find(x => x.id === id)
              if (!m) return null
              const optsStr = fmtOpts(selectedOptions)
              const hasOpts = (optionsByModel[m.id] || []).length > 0
              return (
                <Box key={id} sx={{ bgcolor: '#f9f9f9', borderRadius: 1.5, px: 1.25, py: 0.75 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600} noWrap>{m.modelName}</Typography>
                      {optsStr && <Typography variant="caption" color="text.secondary" noWrap display="block">{optsStr}</Typography>}
                      {itemNotes && <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }} noWrap display="block">{itemNotes}</Typography>}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                      <IconButton size="small" onClick={() => handleRemoveClick(id)} sx={{ p: 0.25 }}><RemoveIcon sx={{ fontSize: 14 }} /></IconButton>
                      <Typography variant="body2" fontWeight={700} sx={{ minWidth: 18, textAlign: 'center' }}>{qty}</Typography>
                      <IconButton size="small" onClick={() => handleAddClick(m)} sx={{ p: 0.25, bgcolor: '#1976d2', color: '#fff', '&:hover': { bgcolor: '#1565c0' } }}><AddIcon sx={{ fontSize: 14 }} /></IconButton>
                    </Box>
                    <Typography variant="body2" color="primary" fontWeight={700} sx={{ ml: 0.5, minWidth: 64, textAlign: 'right', fontSize: 13 }}>
                      {fmt(qty * Number(m.sellingPrice || 0))}
                    </Typography>
                    {hasOpts && (
                      <IconButton size="small" onClick={() => setOptionsTarget(m)} sx={{ p: 0.25, ml: 0.25 }}><TuneIcon sx={{ fontSize: 14, color: '#90a4ae' }} /></IconButton>
                    )}
                  </Box>
                </Box>
              )
            })}
          </Stack>

          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={700}>Total</Typography>
            <Typography fontWeight={800} color="primary">{fmt(totalAmount)}</Typography>
          </Box>

          <TextField size="small" fullWidth multiline rows={2} label="Order notes" placeholder="Special requests..."
            value={notes} onChange={e => setNotes(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }} />

          <Button variant="contained" fullWidth size="large" onClick={() => setCheckout(true)}
            sx={{ borderRadius: 2, fontWeight: 800, textTransform: 'none', fontSize: 15 }}>
            Checkout · {fmt(totalAmount)}
          </Button>
        </>
      )}
    </Box>
  )

  return (
    <Box sx={{ bgcolor: '#fafafa', minHeight: '100vh' }}>

      {/* Top banner */}
      <Box sx={{ background: 'linear-gradient(135deg, #1565c0 0%, #0288d1 100%)', color: '#fff', px: 2.5, py: { xs: 2.5, md: 3 }, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={800} letterSpacing={1}>Order</Typography>
        {ctx.tableId && (
          <Chip icon={<TableBarIcon sx={{ color: '#fff !important', fontSize: 14 }} />}
            label="Dine In" size="small"
            sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }} />
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{error}</Alert>}

      {/* Main layout: single column on mobile, two-column on desktop */}
      <Box sx={{
        display: { xs: 'block', md: 'flex' },
        alignItems: 'flex-start',
        maxWidth: { md: 1100 },
        mx: 'auto',
        px: { xs: 0, md: 2 },
        pt: { xs: 0, md: 2 },
        gap: 3,
      }}>

        {/* ── Menu (left / full) ─────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0, px: { xs: 1.5, md: 0 }, pt: { xs: 1.5, md: 0 }, pb: { xs: 14, md: 4 } }}>
          {Object.entries(grouped).map(([cat, items]) => (
            <Box key={cat} sx={{ mb: 3 }}>
              <Typography variant="overline" fontWeight={700} color="primary"
                sx={{ letterSpacing: 1.5, display: 'block', mb: 1 }}>{cat}</Typography>
              <Stack spacing={1}>
                {items.map(m => {
                  const entry   = cart[m.id]
                  const qty     = entry?.qty || 0
                  const hasOpts = (optionsByModel[m.id] || []).length > 0
                  const optsStr = fmtOpts(entry?.selectedOptions)
                  const noteStr = entry?.itemNotes
                  return (
                    <Card key={m.id} elevation={0} sx={{
                      borderRadius: 2,
                      border: qty > 0 ? '1.5px solid #1976d2' : '1px solid #e8e8e8',
                      bgcolor: '#fff', transition: 'border-color 0.15s', overflow: 'hidden',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        {m.imageUrl && (
                          <CardMedia component="img" image={m.imageUrl}
                            sx={{ width: { xs: 72, md: 80 }, height: { xs: 72, md: 80 }, objectFit: 'cover', flexShrink: 0 }} />
                        )}
                        <Box sx={{ flex: 1, px: 1.5, py: 1 }}>
                          <Typography variant="body2" fontWeight={600} lineHeight={1.3}>{m.modelName}</Typography>
                          <Typography variant="body2" color="primary" fontWeight={700} sx={{ mt: 0.25 }}>{fmt(m.sellingPrice)}</Typography>
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
                      {qty > 0 && (optsStr || noteStr) && (
                        <Box onClick={() => hasOpts && setOptionsTarget(m)} sx={{
                          px: 1.5, py: 0.75, bgcolor: '#e3f2fd', borderTop: '1px solid #bbdefb',
                          display: 'flex', gap: 1, alignItems: 'center',
                          cursor: hasOpts ? 'pointer' : 'default',
                        }}>
                          <Box sx={{ flex: 1 }}>
                            {optsStr && <Typography variant="caption" color="primary" display="block" noWrap>{optsStr}</Typography>}
                            {noteStr && <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ fontStyle: 'italic' }}>{noteStr}</Typography>}
                          </Box>
                          {hasOpts && <TuneIcon sx={{ fontSize: 14, color: '#1976d2' }} />}
                        </Box>
                      )}
                    </Card>
                  )
                })}
              </Stack>
            </Box>
          ))}
        </Box>

        {/* ── Cart panel — desktop right sidebar ─────────── */}
        <Box sx={{
          display: { xs: 'none', md: 'block' },
          width: 320, flexShrink: 0,
          position: 'sticky', top: 16,
          bgcolor: '#fff', borderRadius: 3,
          border: '1px solid #e8e8e8',
          p: 2.5,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
        }}>
          <CartPanel />
        </Box>
      </Box>

      {/* ── Mobile sticky bottom bar ───────────────────────── */}
      {itemCount > 0 && (
        <Box sx={{
          display: { xs: 'flex', md: 'none' },
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 200,
          borderTop: '1px solid #e0e0e0', bgcolor: '#fff',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.10)',
          alignItems: 'center', gap: 1, px: 2, py: 1.25,
        }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">{itemCount} item{itemCount > 1 ? 's' : ''}</Typography>
          </Box>
          <Button variant="contained" size="medium" onClick={() => setCheckout(true)}
            startIcon={<ShoppingCartIcon />}
            sx={{ borderRadius: 2, fontWeight: 700, minWidth: 160, textTransform: 'none' }}>
            Checkout · {fmt(totalAmount)}
          </Button>
        </Box>
      )}

      {/* Receipt dialog after order placement */}
      <OrderReceiptDialog
        open={Boolean(placedOrder)}
        order={placedOrder}
        onClose={() => { navigate(placedOrder?._nav); setPlacedOrder(null) }}
        onTrack={() => { navigate(placedOrder?._nav); setPlacedOrder(null) }}
      />

      {/* Item options dialog */}
      {optionsTarget && (
        <ItemOptionsDialog
          open={Boolean(optionsTarget)}
          model={optionsTarget}
          options={optionsByModel[optionsTarget.id] || []}
          initialCart={cart[optionsTarget.id] || null}
          onConfirm={handleOptionsConfirm}
          onClose={() => setOptionsTarget(null)}
        />
      )}

      {/* Checkout dialog */}
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
              {Object.entries(cart).map(([id, { qty, selectedOptions, itemNotes }]) => {
                const m = menu.find(x => x.id === id); if (!m) return null
                const optsStr = fmtOpts(selectedOptions)
                return (
                  <Box key={id} sx={{ mb: 0.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2">{qty}× {m.modelName}</Typography>
                      <Typography variant="body2" color="primary">{fmt(qty * Number(m.sellingPrice))}</Typography>
                    </Box>
                    {optsStr && <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block' }}>{optsStr}</Typography>}
                    {itemNotes && <Typography variant="caption" color="text.secondary" sx={{ pl: 1.5, display: 'block', fontStyle: 'italic' }}>Note: {itemNotes}</Typography>}
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
    </Box>
  )
}
