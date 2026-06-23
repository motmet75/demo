import React, { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Tooltip from '@mui/material/Tooltip'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import SearchIcon from '@mui/icons-material/Search'
import StarIcon from '@mui/icons-material/Star'
import PersonIcon from '@mui/icons-material/Person'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { fetchCustomers, createCustomer, updateCustomer, deleteCustomer, addCustomerPoints, recalculateCustomerPoints } from '../../api/shopApi'

const EMPTY = { name: '', phone: '', email: '', notes: '', customerCode: '' }

const genCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

function printCustomerQr(c) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(c.customerCode)}`
  const w = window.open('', '_blank', 'width=420,height=520')
  w.document.write(`<!DOCTYPE html><html><head><title>Customer QR — ${c.name}</title>
    <style>body{font-family:sans-serif;text-align:center;padding:24px;margin:0}
    img{display:block;margin:0 auto 12px;border:1px solid #e0e0e0;border-radius:8px}
    code{font-size:22px;letter-spacing:4px;font-weight:800;display:block;margin:8px 0;font-family:monospace}
    p{margin:4px 0;color:#555;font-size:14px}@media print{button{display:none}}</style>
    </head><body>
    <img src="${qrUrl}" width="260" height="260" />
    <code>${c.customerCode}</code>
    <p><strong>${c.name}</strong></p>
    ${c.phone ? `<p>${c.phone}</p>` : ''}
    <script>document.querySelector('img').onload=()=>window.print()<\/script>
    </body></html>`)
  w.document.close()
}

function CustomerEditDialog({ open, customer, onClose, onSaved }) {
  const [form, setForm]     = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    if (open) setForm(customer
      ? { name: customer.name || '', phone: customer.phone || '', email: customer.email || '', notes: customer.notes || '', customerCode: customer.customerCode || '' }
      : { ...EMPTY, customerCode: genCode() })
    setError('')
  }, [open, customer])

  const save = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const fn = customer ? updateCustomer(customer.id, form) : createCustomer(form)
      const { res, data } = await fn
      if (!res.ok) { setError(data?.error || 'Save failed'); setSaving(false); return }
      onSaved(data)
    } catch (e) { setError(e.message || 'Network error') }
    setSaving(false)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={800}>{customer ? 'Edit Customer' : 'New Customer'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {error && <Alert severity="error">{error}</Alert>}
        <TextField label="Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} size="small" fullWidth />
        <TextField label="Phone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} size="small" fullWidth />
        <TextField label="Email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} size="small" fullWidth />
        <TextField label="Notes" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} size="small" fullWidth multiline rows={2} />
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField label="Customer Code" size="small" sx={{ flex: 1 }}
            value={form.customerCode}
            onChange={e => setForm(p => ({ ...p, customerCode: e.target.value.replace(/[^A-Z0-9a-z]/g, '').toUpperCase().slice(0, 8) }))}
            inputProps={{ style: { fontFamily: 'monospace', fontWeight: 700, letterSpacing: 3, fontSize: 15 } }}
            helperText="Unique code for QR tracking & point scanning"
          />
          <Tooltip title="Regenerate code">
            <IconButton size="small" onClick={() => setForm(p => ({ ...p, customerCode: genCode() }))} sx={{ mt: 0.5, color: '#64748b' }}>
              <AutorenewIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function AddPointsDialog({ open, customer, onClose, onUpdated }) {
  const [pts, setPts]       = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => { if (open) { setPts(''); setError('') } }, [open])

  const save = async () => {
    const n = parseInt(pts, 10)
    if (isNaN(n) || n === 0) { setError('Enter a non-zero number'); return }
    setSaving(true); setError('')
    try {
      const { res, data } = await addCustomerPoints(customer.id, n)
      if (!res.ok) { setError(data?.error || 'Failed'); setSaving(false); return }
      onUpdated(data)
    } catch (e) { setError(e.message || 'Network error') }
    setSaving(false)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle fontWeight={800}>Add / Deduct Points — {customer?.name}</DialogTitle>
      <DialogContent sx={{ pt: '8px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Current: <strong>{customer?.points ?? 0} pts</strong>. Enter positive to add, negative to deduct.
        </Typography>
        <TextField
          label="Points (+/-)" type="number" value={pts}
          onChange={e => setPts(e.target.value)}
          size="small" fullWidth autoFocus
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {saving ? <CircularProgress size={18} /> : 'Update Points'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function ShopCustomerPage() {
  const [customers, setCustomers] = useState([])
  const [q, setQ]                 = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [editTarget, setEditTarget] = useState(null)   // null = closed, {} = new, customer = edit
  const [editOpen, setEditOpen]   = useState(false)
  const [ptsTarget, setPtsTarget] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [deleting, setDeleting]   = useState(false)

  const load = async (search = q) => {
    setLoading(true); setError('')
    try {
      const { data } = await fetchCustomers(search || undefined)
      setCustomers(data || [])
    } catch { setError('Failed to load customers') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSearch = (e) => { e.preventDefault(); load(q) }

  const handleSaved = (c) => {
    setCustomers(prev => {
      const idx = prev.findIndex(x => x.id === c.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = c; return n }
      return [c, ...prev]
    })
    setEditOpen(false)
  }

  const handlePointsUpdated = (c) => {
    setCustomers(prev => prev.map(x => x.id === c.id ? c : x))
    setPtsTarget(null)
  }

  const handleDelete = async () => {
    if (!delTarget) return
    setDeleting(true)
    try {
      await deleteCustomer(delTarget.id)
      setCustomers(prev => prev.filter(x => x.id !== delTarget.id))
      setDelTarget(null)
    } catch { setError('Delete failed') }
    setDeleting(false)
  }

  return (
    <Box sx={{ p: 2, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <PersonIcon color="primary" />
        <Typography variant="h6" fontWeight={800}>Customers</Typography>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setEditTarget({}); setEditOpen(true) }}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}>
          New Customer
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSearch} sx={{ display: 'flex', gap: 1, mb: 2 }}>
        <TextField
          size="small" fullWidth placeholder="Search by name or phone…"
          value={q} onChange={e => setQ(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <Button type="submit" variant="outlined" sx={{ textTransform: 'none', flexShrink: 0 }}>Search</Button>
      </Box>

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
      ) : customers.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>No customers found</Typography>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {customers.map(c => (
            <Box key={c.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5, p: 1.5,
              border: '1px solid #e0e0e0', borderRadius: 2, bgcolor: '#fafafa',
            }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography fontWeight={700} sx={{ fontSize: 15 }} noWrap>{c.name}</Typography>
                  {c.customerCode && (
                    <Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 12, color: '#0288d1', letterSpacing: 2, bgcolor: '#e1f5fe', px: 0.75, py: 0.1, borderRadius: 1 }}>
                      {c.customerCode}
                    </Typography>
                  )}
                </Box>
                {(c.phone || c.email) && (
                  <Typography variant="caption" color="text.secondary">
                    {[c.phone, c.email].filter(Boolean).join(' · ')}
                  </Typography>
                )}
                {c.notes && <Typography variant="caption" color="text.secondary" display="block" noWrap>{c.notes}</Typography>}
              </Box>
              {c.customerCode && (
                <Tooltip title="Print QR code">
                  <IconButton size="small" onClick={() => printCustomerQr(c)} sx={{ color: '#0288d1' }}>
                    <QrCode2Icon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title="Recalculate points from all linked orders">
                <Chip icon={<StarIcon sx={{ fontSize: '14px !important' }} />}
                  label={`${c.points ?? 0} pts`}
                  size="small" color="warning" variant="outlined"
                  sx={{ fontWeight: 700, cursor: 'pointer' }}
                  onClick={() => setPtsTarget(c)} />
              </Tooltip>
              <Tooltip title="Recalculate total points from all bills linked to this customer">
                <IconButton size="small" sx={{ p: 0.25, color: '#f59e0b' }}
                  onClick={async () => {
                    try {
                      const { data } = await recalculateCustomerPoints(c.id)
                      setCustomers(prev => prev.map(x => x.id === c.id ? data : x))
                    } catch { /* silent */ }
                  }}>
                  <StarIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => { setEditTarget(c); setEditOpen(true) }}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete">
                <IconButton size="small" color="error" onClick={() => setDelTarget(c)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          ))}
        </Box>
      )}

      <CustomerEditDialog open={editOpen} customer={editTarget && Object.keys(editTarget).length ? editTarget : null}
        onClose={() => setEditOpen(false)} onSaved={handleSaved} />

      {ptsTarget && (
        <AddPointsDialog open onClose={() => setPtsTarget(null)}
          customer={ptsTarget} onUpdated={handlePointsUpdated} />
      )}

      <Dialog open={!!delTarget} onClose={() => setDelTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Delete Customer?</DialogTitle>
        <DialogContent>
          <Typography>Delete <strong>{delTarget?.name}</strong>? This cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <Button onClick={() => setDelTarget(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={deleting}
            sx={{ textTransform: 'none', fontWeight: 700 }}>
            {deleting ? <CircularProgress size={18} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
