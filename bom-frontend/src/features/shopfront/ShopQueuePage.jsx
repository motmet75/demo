import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Stack from '@mui/material/Stack'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import QrCode2Icon from '@mui/icons-material/QrCode2'
import TableRestaurantIcon from '@mui/icons-material/TableRestaurant'
import PersonIcon from '@mui/icons-material/Person'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import { fetchPublicTables, resolveToken } from '../../api/shopApi'

function fmtExpiry(value) {
  if (!value) return ''
  try { return new Date(value).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) } catch { return '' }
}

export default function ShopQueuePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('t') || ''

  const [ctx, setCtx] = useState(null)
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    async function load() {
      if (!token) {
        if (alive) { setError('QR code is missing.'); setLoading(false) }
        return
      }
      setLoading(true); setError('')
      try {
        const tokenRes = await resolveToken(token)
        if (!alive) return
        if (!tokenRes.res.ok) {
          setError('This QR code is expired or no longer valid.')
          setLoading(false)
          return
        }
        const data = tokenRes.data || {}
        if (data.tokenType && data.tokenType !== 'QUEUE_QR') {
          navigate(`/shop/menu?t=${encodeURIComponent(token)}`, { replace: true })
          return
        }
        setCtx(data)
        const tableRes = await fetchPublicTables(data.tenantId, data.companyId)
        if (!alive) return
        if (!tableRes.res.ok) {
          setError(tableRes.data?.error || 'Cannot load tables. Please ask staff for help.')
          setLoading(false)
          return
        }
        const activeTables = Array.isArray(tableRes.data) ? tableRes.data : []
        setTables(activeTables)
        if (activeTables.length === 1) setTableId(activeTables[0].id)
      } catch (e) {
        if (alive) setError(e.message || 'Cannot read this QR code.')
      } finally {
        if (alive) setLoading(false)
      }
    }
    load()
    return () => { alive = false }
  }, [token, navigate])

  const expiryText = useMemo(() => fmtExpiry(ctx?.expiresAt), [ctx?.expiresAt])
  const canContinue = tableId && customerName.trim().length > 0

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!canContinue) return
    const qs = new URLSearchParams({
      t: token,
      tableId,
      customerName: customerName.trim(),
    })
    navigate(`/shop/menu?${qs.toString()}`)
  }

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', bgcolor: '#f6f7f9' }}>
        <CircularProgress sx={{ color: '#ff5722' }} />
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f6f7f9', px: 2, py: 3 }}>
      <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 440, mx: 'auto' }}>
        <Box sx={{ bgcolor: '#fff', border: '1px solid #e5e7eb', borderRadius: 2, overflow: 'hidden', boxShadow: '0 8px 24px rgba(15,23,42,0.08)' }}>
          <Box sx={{ px: 2.5, py: 2.25, bgcolor: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <QrCode2Icon sx={{ color: '#ff5722' }} />
              <Typography fontWeight={900} sx={{ fontSize: 20, color: '#1f2937' }}>Queue QR</Typography>
              {expiryText && <Chip size="small" label={`Valid until ${expiryText}`} sx={{ ml: 'auto', bgcolor: '#fff', fontWeight: 700 }} />}
            </Stack>
            <Typography sx={{ color: '#431407', fontSize: 15, lineHeight: 1.5, fontWeight: 700 }}>
              Please find a table and sit down. Input your table and your name, then order. We will come to you.
            </Typography>
          </Box>

          <Stack spacing={2} sx={{ p: 2.5 }}>
            {error && <Alert severity="error">{error}</Alert>}

            {!error && tables.length === 0 && (
              <Alert severity="warning">No active tables are available. Please ask staff for help.</Alert>
            )}

            <TextField
              select
              fullWidth
              required
              size="small"
              label="Table"
              value={tableId}
              onChange={e => setTableId(e.target.value)}
              disabled={tables.length === 0}
              InputProps={{ startAdornment: <TableRestaurantIcon sx={{ mr: 1, color: '#9ca3af' }} /> }}
            >
              {tables.map(table => (
                <MenuItem key={table.id} value={table.id}>{table.tableName}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              required
              size="small"
              label="Your name"
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              InputProps={{ startAdornment: <PersonIcon sx={{ mr: 1, color: '#9ca3af' }} /> }}
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={!canContinue || Boolean(error)}
              endIcon={<ArrowForwardIcon />}
              sx={{ bgcolor: '#ff5722', '&:hover': { bgcolor: '#e64a19' }, borderRadius: 20, fontWeight: 900, textTransform: 'none' }}
            >
              Start order
            </Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}