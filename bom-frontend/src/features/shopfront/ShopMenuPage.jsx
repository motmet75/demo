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
import TakeoutDiningIcon from '@mui/icons-material/TakeoutDining'
import TableBarIcon from '@mui/icons-material/TableBar'
import DeliveryDiningIcon from '@mui/icons-material/DeliveryDining'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import InputAdornment from '@mui/material/InputAdornment'
import { resolveToken, fetchMenu, createOrder } from '../../api/shopApi'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

const FULFILLMENT_OPTIONS = [
  { value: 'PICKUP',   label: 'Pickup',    icon: <TakeoutDiningIcon fontSize="small" /> },
  { value: 'DINE_IN',  label: 'Dine In',   icon: <TableBarIcon fontSize="small" /> },
  { value: 'DELIVERY', label: 'Delivery',  icon: <DeliveryDiningIcon fontSize="small" /> },
]

export default function ShopMenuPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const tokenParam  = params.get('t')
  const rawTenantId = params.get('tenantId')
  const rawCompanyId = params.get('companyId')
  const rawTableId   = params.get('tableId')

  const [ctx, setCtx] = useState(
    tokenParam ? null : { tenantId: rawTenantId, companyId: rawCompanyId, tableId: rawTableId }
  )
  const [menu, setMenu]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [cart, setCart]         = useState({})
  const [notes, setNotes]       = useState('')
  const [showNotes, setShowNotes] = useState(false)
  const [checkout, setCheckout] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    fulfillmentType: 'PICKUP',
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    paymentMethod: 'CASH',
  })

  // Resolve token → context
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

  // Load menu once context is ready
  useEffect(() => {
    if (!ctx) return
    if (!ctx.tenantId || !ctx.companyId) { setError('Missing shop context.'); setLoading(false); return }
    fetchMenu(ctx.tenantId, ctx.companyId)
      .then(({ data }) => { setMenu(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setError('Failed to load menu.'); setLoading(false) })
  }, [ctx])

  const itemCount   = Object.values(cart).reduce((s, q) => s + q, 0)
  const totalAmount = menu.reduce((s, m) => s + (cart[m.id] || 0) * Number(m.sellingPrice || 0), 0)

  const setQty = (id, delta) => setCart(prev => {
    const next = (prev[id] || 0) + delta
    if (next <= 0) { const { [id]: _, ...rest } = prev; return rest }
    return { ...prev, [id]: next }
  })

  const grouped = menu.reduce((g, m) => {
    const cat = m.category || 'Menu'
    if (!g[cat]) g[cat] = []
    g[cat].push(m)
    return g
  }, {})

  const handlePlaceOrder = async () => {
    if (!itemCount) return
    setSubmitting(true); setError('')
    const items = Object.entries(cart).map(([modelId, quantity]) => ({ modelId, quantity }))
    const body = {
      fulfillmentType: form.fulfillmentType,
      tableId: ctx.tableId || null,
      customerName: form.customerName || null,
      customerPhone: form.customerPhone || null,
      deliveryAddress: form.fulfillmentType === 'DELIVERY' ? form.deliveryAddress : null,
      deliveryFee: null,
      paymentMethod: form.paymentMethod,
      notes: notes || null,
      items,
    }
    try {
      const { res, data } = await createOrder(ctx.tenantId, ctx.companyId, body)
      if (!res.ok) { setError(data?.message || 'Failed to place order'); setSubmitting(false); return }
      navigate(`/shop/order/${data.orderCode}?tenantId=${ctx.tenantId}&companyId=${ctx.companyId}`)
    } catch {
      setError('Network error'); setSubmitting(false)
    }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <CircularProgress />
    </Box>
  )
  if (!ctx?.tenantId || !ctx?.companyId) return (
    <Box sx={{ p: 3 }}>
      <Alert severity="error">{error || 'Invalid QR code — missing shop context.'}</Alert>
    </Box>
  )

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', bgcolor: '#fafafa', minHeight: '100vh', pb: 14 }}>

      {/* Top banner */}
      <Box sx={{ background: 'linear-gradient(135deg, #1565c0 0%, #0288d1 100%)', color: '#fff', px: 2.5, py: 3, textAlign: 'center' }}>
        <Typography variant="h5" fontWeight={800} letterSpacing={1}>Order</Typography>
        {ctx.tableId && (
          <Chip icon={<TableBarIcon sx={{ color: '#fff !important', fontSize: 14 }} />}
            label="Dine In" size="small"
            sx={{ mt: 1, bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 600 }} />
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mx: 2, mt: 1 }}>{error}</Alert>}

      {/* Menu sections */}
      <Box sx={{ px: 2, pt: 2 }}>
        {Object.entries(grouped).map(([cat, items]) => (
          <Box key={cat} sx={{ mb: 3 }}>
            <Typography variant="overline" fontWeight={700} color="primary"
              sx={{ letterSpacing: 1.5, display: 'block', mb: 1 }}>
              {cat}
            </Typography>
            <Stack spacing={1}>
              {items.map(m => {
                const qty = cart[m.id] || 0
                return (
                  <Card key={m.id} elevation={0} sx={{
                    display: 'flex', alignItems: 'center', borderRadius: 2,
                    border: qty > 0 ? '1.5px solid #1976d2' : '1px solid #e8e8e8',
                    bgcolor: '#fff', transition: 'border-color 0.15s',
                    overflow: 'hidden',
                  }}>
                    {m.imageUrl && (
                      <CardMedia component="img" image={m.imageUrl}
                        sx={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <Box sx={{ flex: 1, px: 1.5, py: 1 }}>
                      <Typography variant="body2" fontWeight={600} lineHeight={1.3}>{m.modelName}</Typography>
                      <Typography variant="body2" color="primary" fontWeight={700} sx={{ mt: 0.25 }}>
                        {fmt(m.sellingPrice)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1 }}>
                      {qty > 0 ? (
                        <>
                          <IconButton size="small" onClick={() => setQty(m.id, -1)}
                            sx={{ bgcolor: '#f0f0f0', '&:hover': { bgcolor: '#e0e0e0' } }}>
                            <RemoveIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 22, textAlign: 'center' }}>
                            {qty}
                          </Typography>
                        </>
                      ) : null}
                      <IconButton size="small" onClick={() => setQty(m.id, 1)}
                        sx={{ bgcolor: '#1976d2', color: '#fff', '&:hover': { bgcolor: '#1565c0' } }}>
                        <AddIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  </Card>
                )
              })}
            </Stack>
          </Box>
        ))}
      </Box>

      {/* Sticky bottom bar */}
      {itemCount > 0 && (
        <Box sx={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, zIndex: 200,
          borderTop: '1px solid #e0e0e0', bgcolor: '#fff',
          boxShadow: '0 -2px 12px rgba(0,0,0,0.10)',
        }}>
          {/* Notes input (collapsible) */}
          <Collapse in={showNotes}>
            <Box sx={{ px: 2, pt: 1.5, pb: 0.5 }}>
              <TextField
                size="small" fullWidth multiline rows={2}
                label="Order notes"
                placeholder="e.g. No sugar, extra ice, well done..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }}
              />
            </Box>
          </Collapse>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25 }}>
            {/* Notes toggle */}
            <IconButton size="small" onClick={() => setShowNotes(n => !n)}
              color={showNotes || notes ? 'primary' : 'default'}
              sx={{ border: '1px solid', borderColor: showNotes || notes ? 'primary.main' : '#ddd', borderRadius: 1.5 }}>
              <NoteAltIcon fontSize="small" />
            </IconButton>
            {notes && <Typography variant="caption" color="primary" noWrap sx={{ maxWidth: 80 }}>{notes}</Typography>}
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained" size="medium" onClick={() => setCheckout(true)}
              startIcon={<ShoppingCartIcon />}
              sx={{ borderRadius: 2, fontWeight: 700, minWidth: 140, textTransform: 'none' }}
            >
              {itemCount} items · {fmt(totalAmount)}
            </Button>
          </Box>
        </Box>
      )}

      {/* Checkout dialog */}
      <Dialog open={checkout} onClose={() => setCheckout(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography fontWeight={700} variant="h6">Place Order</Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 0.5 }}>

            {/* Fulfillment type */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>Order type</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {FULFILLMENT_OPTIONS.map(opt => (
                  <Box key={opt.value}
                    onClick={() => setForm(f => ({ ...f, fulfillmentType: opt.value }))}
                    sx={{
                      flex: 1, border: '1.5px solid', borderRadius: 2, py: 1, px: 0.5,
                      textAlign: 'center', cursor: 'pointer',
                      borderColor: form.fulfillmentType === opt.value ? 'primary.main' : '#e0e0e0',
                      bgcolor: form.fulfillmentType === opt.value ? '#e3f2fd' : '#fff',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Box sx={{ color: form.fulfillmentType === opt.value ? 'primary.main' : 'text.secondary' }}>{opt.icon}</Box>
                    <Typography variant="caption" fontWeight={600}
                      color={form.fulfillmentType === opt.value ? 'primary.main' : 'text.secondary'}>
                      {opt.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </Box>

            <TextField label="Your name" size="small" fullWidth
              value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))} />
            <TextField label="Phone" size="small" fullWidth type="tel"
              value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))} />

            {form.fulfillmentType === 'DELIVERY' && (
              <TextField label="Delivery address" size="small" fullWidth multiline rows={2}
                value={form.deliveryAddress} onChange={e => setForm(f => ({ ...f, deliveryAddress: e.target.value }))} />
            )}

            {/* Notes (always visible in checkout) */}
            <TextField
              label="Notes" size="small" fullWidth multiline rows={2}
              placeholder="Customizations, special requests..."
              value={notes} onChange={e => setNotes(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }}
            />

            <FormControl size="small" fullWidth>
              <InputLabel>Payment</InputLabel>
              <Select value={form.paymentMethod} label="Payment"
                onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="BANK_QR">Bank QR</MenuItem>
              </Select>
            </FormControl>

            <Divider />

            {/* Order summary */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Your order</Typography>
              {Object.entries(cart).map(([id, qty]) => {
                const m = menu.find(x => x.id === id)
                if (!m) return null
                return (
                  <Box key={id} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.25 }}>
                    <Typography variant="body2">{qty}× {m.modelName}</Typography>
                    <Typography variant="body2" color="primary">{fmt(qty * Number(m.sellingPrice))}</Typography>
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
