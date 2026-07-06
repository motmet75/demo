import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import RefreshIcon from '@mui/icons-material/Refresh'
import PrintIcon from '@mui/icons-material/Print'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { fetchPrintHistory } from '../../api/shopApi'

const PRINT_TYPE_LABEL = {
  QR_ORDER_SLIP: 'QR order slip',
  ORDER_RECEIPT: 'Order receipt',
  ORDER_QR_TAG: 'Tracking QR tag',
  CUP_LABELS: 'Cup labels',
  BILL_RECEIPT: 'Bill receipt',
  GENERAL: 'General print',
}

const SOURCE_TYPE_LABEL = {
  QR_SLIP: 'QR slip',
  ORDER: 'Order',
  BILL: 'Bill',
  GENERAL: 'General',
}

const fmtMoney = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : '-'
const fmtDate = (v) => v ? new Date(v).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }) : '-'
const slipNo = (n) => n != null ? `#${String(n).padStart(5, '0')}` : '-'

export default function ShopPrintingCenterPage() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [printType, setPrintType] = useState('')
  const [sourceType, setSourceType] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const { res, data } = await fetchPrintHistory({ printType: printType || null, sourceType: sourceType || null })
      if (!res.ok) { setError(data?.error || 'Failed to load print history'); setLoading(false); return }
      setRows(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Failed to load print history')
    }
    setLoading(false)
  }, [printType, sourceType])

  useEffect(() => { load() }, [load])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(row => [
      row.title, row.printType, row.sourceType, row.sourceCode, row.sourceNumber,
      row.sourceKey, row.printedBy, row.notes,
    ].some(value => String(value || '').toLowerCase().includes(q)))
  }, [rows, search])

  const stats = useMemo(() => {
    const copies = filteredRows.filter(row => Number(row.copyNumber || 1) > 1).length
    const billPrints = filteredRows.filter(row => row.sourceType === 'BILL' || row.printType === 'BILL_RECEIPT').length
    const orderPrints = filteredRows.filter(row => row.sourceType === 'ORDER').length
    const qrSlips = filteredRows.filter(row => row.printType === 'QR_ORDER_SLIP').length
    return { total: filteredRows.length, copies, billPrints, orderPrints, qrSlips }
  }, [filteredRows])

  const printTypes = useMemo(() => Object.keys(PRINT_TYPE_LABEL), [])
  const sourceTypes = useMemo(() => Object.keys(SOURCE_TYPE_LABEL), [])

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <PrintIcon color="primary" />
          <Box sx={{ minWidth: 220, flex: '1 1 260px' }}>
            <Typography fontWeight={900} sx={{ fontSize: 20, lineHeight: 1.1 }}>Printing Center</Typography>
            <Typography variant="caption" color="text.secondary">QR slips, bills, receipts, labels, and repeated copies</Typography>
          </Box>
          <TextField select size="small" label="Print type" value={printType} onChange={e => setPrintType(e.target.value)} sx={{ width: 180 }}>
            <MenuItem value="">All types</MenuItem>
            {printTypes.map(type => <MenuItem key={type} value={type}>{PRINT_TYPE_LABEL[type]}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Source" value={sourceType} onChange={e => setSourceType(e.target.value)} sx={{ width: 140 }}>
            <MenuItem value="">All sources</MenuItem>
            {sourceTypes.map(type => <MenuItem key={type} value={type}>{SOURCE_TYPE_LABEL[type]}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Search" value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 220 }} />
          <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={load} disabled={loading}>
            Refresh
          </Button>
        </Box>

        <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', rowGap: 1 }}>
          <Chip icon={<ReceiptLongIcon />} label={`${stats.total} printed`} color="primary" variant="outlined" />
          <Chip icon={<ContentCopyIcon />} label={`${stats.copies} copies`} color={stats.copies ? 'warning' : 'default'} variant="outlined" />
          <Chip label={`${stats.qrSlips} QR slips`} variant="outlined" />
          <Chip label={`${stats.orderPrints} order papers`} variant="outlined" />
          <Chip label={`${stats.billPrints} bill papers`} variant="outlined" />
        </Stack>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ m: 1.5, flexShrink: 0 }}>{error}</Alert>}

      <TableContainer component={Paper} elevation={0} sx={{ flex: 1, minHeight: 0, borderRadius: 0, borderTop: '1px solid #e2e8f0' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 900 }}>Slip</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Paper</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Source</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Copy</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Printed at</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Printed by</TableCell>
              <TableCell align="right" sx={{ fontWeight: 900 }}>Amount</TableCell>
              <TableCell sx={{ fontWeight: 900 }}>Notes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5 }}><CircularProgress /></TableCell></TableRow>
            )}
            {!loading && filteredRows.length === 0 && (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 5, color: 'text.secondary' }}>No printed paper found</TableCell></TableRow>
            )}
            {!loading && filteredRows.map(row => (
              <TableRow key={row.id} hover>
                <TableCell>
                  <Typography fontWeight={900}>{slipNo(row.slipNumber)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography fontWeight={700} sx={{ fontSize: 13 }}>{PRINT_TYPE_LABEL[row.printType] || row.printType}</Typography>
                  {row.title && <Typography variant="caption" color="text.secondary">{row.title}</Typography>}
                </TableCell>
                <TableCell>
                  <Chip label={SOURCE_TYPE_LABEL[row.sourceType] || row.sourceType} size="small" sx={{ height: 20, fontSize: 11, fontWeight: 700, mb: 0.25 }} />
                  <Typography variant="caption" display="block" color="text.secondary" sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {row.sourceNumber || row.sourceCode || row.sourceKey || '-'}
                  </Typography>
                </TableCell>
                <TableCell>
                  {Number(row.copyNumber || 1) > 1
                    ? <Chip label={`Copy #${row.copyNumber}`} size="small" color="warning" sx={{ fontWeight: 800 }} />
                    : <Chip label="Original" size="small" variant="outlined" sx={{ fontWeight: 700 }} />}
                </TableCell>
                <TableCell>{fmtDate(row.printedAt)}</TableCell>
                <TableCell>{row.printedBy || '-'}</TableCell>
                <TableCell align="right">{fmtMoney(row.amount)}</TableCell>
                <TableCell sx={{ maxWidth: 260 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                    {row.notes || '-'}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}