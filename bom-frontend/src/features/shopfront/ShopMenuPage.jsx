import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Badge from '@mui/material/Badge'
import IconButton from '@mui/material/IconButton'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import { resolveToken, fetchMenu, createOrder } from '../../api/shopApi'

const FULFILLMENT = ['DINE_IN', 'PICKUP', 'DELIVERY']
const PAYMENT = ['CASH', 'BANK_QR']
const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

export default function ShopMenuPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  // Context can come from either a token (?t=) or raw params (?tenantId=&companyId=&tableId=)
  const tokenParam = params.get('t')
  const rawTenantId = params.get('tenantId')
  const rawCompanyId = params.get('companyId')
  const rawTableId = params.get('tableId')

  const [ctx, setCtx] = useState(
    tokenParam ? null : { tenantId: rawTenantId, companyId: rawCompanyId, tableId: rawTableId }
  )
  const [menu, setMenu] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [cart, setCart] = useState({})
  const [step, setStep] = useState('menu') // menu | checkout
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    fulfillmentType: rawTableId ? 'DINE_IN' : 'PICKUP',
    customerName: '',
    customerPhone: '',
    deliveryAddress: '',
    paymentMethod: 'CASH',
    notes: ''
  })

  // Step 1: resolve token if ?t= is present
  useEffect(() => {
    if (!tokenParam) return
    resolveToken(tokenParam)
      .then(({ res, data }) => {
        if (!res.ok) { setError('Invalid or expired QR code.'); setLoading(false); return }
        const resolved = { tenantId: data.tenantId, companyId: data.companyId, tableId: data.tableId }
        setCtx(resolved)
        if (resolved.tableId) {
          setForm(f => ({ ...f, fulfillmentType: 'DINE_IN' }))
        }
      })
      .catch(() => { setError('Failed to resolve QR code.'); setLoading(false) })
  }, [tokenParam])

  // Step 2: load menu once context is available
  useEffect(() => {
    if (!ctx) return
    if (!ctx.tenantId || !ctx.companyId) { setError('Missing tenant or company context.'); setLoading(false); return }
    fetchMenu(ctx.tenantId, ctx.companyId)
      .then(({ data }) => {
        setMenu(Array.isArray(data) ? data : [])
        setLoading(false)
      })
      .catch(() => { setError('Failed to load menu'); setLoading(false) })
  }, [ctx])

  const itemCount = Object.values(cart).reduce((s, q) => s + q, 0)
  const totalAmount = menu.reduce((s, m) => s + (cart[m.id] || 0) * Number(m.sellingPrice || 0), 0)

  const setQty = (id, delta) => setCart(prev => {
    const next = (prev[id] || 0) + delta
    if (next <= 0) { const { [id]: _, ...rest } = prev; return rest }
    return { ...prev, [id]: next }
  })

  const grouped = menu.reduce((g, m) => {
    const cat = m.category || 'Uncategorized'
    if (!g[cat]) g[cat] = []
    g[cat].push(m)
    return g
  }, {})

  const handleSubmit = async () => {
    if (!Object.keys(cart).length) { setError('Cart is empty'); return }
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
      notes: form.notes || null,
      items
    }
    try {
      const { res, data } = await createOrder(ctx.tenantId, ctx.companyId, body)
      if (!res.ok) { setError(data?.message || 'Failed to place order'); setSubmitting(false); return }
      navigate(`/shop/order/${data.orderCode}?tenantId=${ctx.tenantId}&companyId=${ctx.companyId}`)
    } catch (e) {
      setError('Network error'); setSubmitting(false)
    }
  }

  if (loading) return <Box sx={{ p: 4, textAlign: 'center' }}><CircularProgress /></Box>
  if (!ctx?.tenantId || !ctx?.companyId) return <Alert severity="error">{error || 'Invalid QR code — missing context.'}</Alert>

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', pb: 10, px: 2 }}>
      <Typography variant="h5" fontWeight={700} sx={{ py: 2, textAlign: 'center' }}>Menu</Typography>
      {ctx.tableId && <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 1 }}>Table scan — dine-in order</Typography>}
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}

      {step === 'menu' ? (
        <>
          {Object.entries(grouped).map(([cat, items]) => (
            <Box key={cat} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1, color: '#1565c0' }}>{cat}</Typography>
              <Stack spacing={1}>
                {items.map(m => (
                  <Card key={m.id} variant="outlined">
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      {m.imageUrl && <CardMedia component="img" image={m.imageUrl} sx={{ width: 72, height: 72, objectFit: 'cover', flexShrink: 0 }} />}
                      <CardContent sx={{ flex: 1, py: 1, '&:last-child': { pb: 1 } }}>
                        <Typography variant="body1" fontWeight={600}>{m.modelName}</Typography>
                        <Typography variant="body2" color="primary">{fmt(m.sellingPrice)}</Typography>
                      </CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pr: 1 }}>
                        {cart[m.id] > 0 && <>
                          <IconButton size="small" onClick={() => setQty(m.id, -1)}><RemoveIcon fontSize="small" /></IconButton>
                          <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>{cart[m.id]}</Typography>
                        </>}
                        <IconButton size="small" color="primary" onClick={() => setQty(m.id, 1)}><AddIcon fontSize="small" /></IconButton>
                      </Box>
                    </Box>
                  </Card>
                ))}
              </Stack>
            </Box>
          ))}
        </>
      ) : (
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Typography variant="h6">Checkout</Typography>
          <FormControl fullWidth size="small">
            <InputLabel>Fulfillment</InputLabel>
            <Select value={form.fulfillmentType} label="Fulfillment" onChange={e => setForm(p => ({ ...p, fulfillmentType: e.target.value }))}>
              {FULFILLMENT.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Your name" size="small" value={form.customerName} onChange={e => setForm(p => ({ ...p, customerName: e.target.value }))} fullWidth />
          <TextField label="Phone" size="small" value={form.customerPhone} onChange={e => setForm(p => ({ ...p, customerPhone: e.target.value }))} fullWidth />
          {form.fulfillmentType === 'DELIVERY' && (
            <TextField label="Delivery address" size="small" value={form.deliveryAddress} onChange={e => setForm(p => ({ ...p, deliveryAddress: e.target.value }))} fullWidth multiline rows={2} />
          )}
          <FormControl fullWidth size="small">
            <InputLabel>Payment</InputLabel>
            <Select value={form.paymentMethod} label="Payment" onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))}>
              {PAYMENT.map(pm => <MenuItem key={pm} value={pm}>{pm === 'CASH' ? 'Cash' : 'Bank QR'}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField label="Notes (optional)" size="small" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} fullWidth multiline rows={2} />
          <Divider />
          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography fontWeight={600}>Total</Typography>
            <Typography fontWeight={600} color="primary">{fmt(totalAmount)}</Typography>
          </Box>
          <Button variant="contained" size="large" fullWidth disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Placing...' : 'Place Order'}
          </Button>
          <Button onClick={() => setStep('menu')}>Back to menu</Button>
        </Stack>
      )}

      {/* Sticky cart bar */}
      {step === 'menu' && itemCount > 0 && (
        <Box sx={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, p: 2, background: '#fff', borderTop: '1px solid #e0e0e0', zIndex: 100 }}>
          <Button
            variant="contained"
            fullWidth
            size="large"
            startIcon={<Badge badgeContent={itemCount} color="error"><ShoppingCartIcon /></Badge>}
            onClick={() => setStep('checkout')}
          >
            View Cart — {fmt(totalAmount)}
          </Button>
        </Box>
      )}
    </Box>
  )
}
