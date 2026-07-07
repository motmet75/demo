import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import FactCheckIcon from '@mui/icons-material/FactCheck'
import Inventory2Icon from '@mui/icons-material/Inventory2'
import RefreshIcon from '@mui/icons-material/Refresh'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveIcon from '@mui/icons-material/Save'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import {
  deductOrderMaterialAudit,
  fetchMaterialAuditOpen,
  fetchMaterialAuditReport,
  fetchMenuAvailability,
  recheckOrderMaterialAudit,
  updateMenuAvailabilityOverride,
} from '../../api/shopApi'

const todayInput = () => {
  const d = new Date()
  const offset = d.getTimezoneOffset()
  return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10)
}

const fmtQty = (value) => {
  if (value == null || value === '') return '-'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

const fmtOrder = (row) => row.orderNumber != null ? `#${row.orderNumber}` : (row.orderCode || '-')

const statusColor = (status) => {
  if (status === 'DEDUCTED') return 'success'
  if (status === 'RESERVED') return 'info'
  if (status === 'PARTIAL') return 'warning'
  if (status === 'WAITING_STOCK') return 'error'
  return 'default'
}

const apiData = async (call, fallbackMessage) => {
  const { res, data } = await call
  if (!res.ok) {
    throw new Error(data?.error || data?.message || fallbackMessage)
  }
  return data
}

function StatChip({ icon, label, value, color = 'default' }) {
  return (
    <Chip
      icon={icon}
      label={`${value} ${label}`}
      color={color}
      variant="outlined"
      sx={{ fontWeight: 800, bgcolor: '#fff' }}
    />
  )
}

export default function ShopMaterialPage() {
  const [availability, setAvailability] = useState([])
  const [openRows, setOpenRows] = useState([])
  const [reportRows, setReportRows] = useState([])
  const [overrideInputs, setOverrideInputs] = useState({})
  const [from, setFrom] = useState(todayInput())
  const [to, setTo] = useState(todayInput())
  const [loading, setLoading] = useState(false)
  const [savingModelId, setSavingModelId] = useState(null)
  const [busyOrderId, setBusyOrderId] = useState(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadAvailability = useCallback(async () => {
    const rows = await apiData(fetchMenuAvailability(), 'Failed to load menu availability')
    const list = Array.isArray(rows) ? rows : []
    setAvailability(list)
    setOverrideInputs(Object.fromEntries(list.map(row => [
      row.modelId,
      row.manualAvailableUnits != null ? String(row.manualAvailableUnits) : '',
    ])))
  }, [])

  const loadOpenAudit = useCallback(async () => {
    const rows = await apiData(fetchMaterialAuditOpen(), 'Failed to load open material audit')
    setOpenRows(Array.isArray(rows) ? rows : [])
  }, [])

  const loadReport = useCallback(async () => {
    const rows = await apiData(fetchMaterialAuditReport({ from, to }), 'Failed to load material report')
    setReportRows(Array.isArray(rows) ? rows : [])
  }, [from, to])

  const reloadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      await Promise.all([loadAvailability(), loadOpenAudit(), loadReport()])
    } catch (e) {
      setError(e.message || 'Failed to load shop material data')
    } finally {
      setLoading(false)
    }
  }, [loadAvailability, loadOpenAudit, loadReport])

  useEffect(() => { reloadAll() }, [reloadAll])

  const stats = useMemo(() => {
    const waitingMaterials = new Set(openRows.filter(row => Number(row.waitingQty || 0) > 0).map(row => row.materialId)).size
    const waitingQty = openRows.reduce((sum, row) => sum + Number(row.waitingQty || 0), 0)
    const blockedItems = availability.filter(row => Number(row.effectiveAvailableUnits || 0) <= 0 && row.hasBom).length
    const requiredQty = reportRows.reduce((sum, row) => sum + Number(row.requiredQty || 0), 0)
    const deductedQty = reportRows.reduce((sum, row) => sum + Number(row.deductedQty || 0), 0)
    return { waitingMaterials, waitingQty, blockedItems, requiredQty, deductedQty }
  }, [availability, openRows, reportRows])

  const saveOverride = async (row) => {
    setSavingModelId(row.modelId)
    setError('')
    setSuccess('')
    try {
      const raw = overrideInputs[row.modelId]
      const units = raw == null || String(raw).trim() === '' ? null : Number(raw)
      if (units != null && (Number.isNaN(units) || units < 0)) {
        throw new Error('Left units must be a positive number or blank')
      }
      await apiData(updateMenuAvailabilityOverride(row.modelId, units), 'Failed to save available units')
      await loadAvailability()
      setSuccess(`Availability saved for ${row.modelName}`)
    } catch (e) {
      setError(e.message || 'Failed to save available units')
    } finally {
      setSavingModelId(null)
    }
  }

  const orderAction = async (orderId, action) => {
    setBusyOrderId(orderId)
    setError('')
    setSuccess('')
    try {
      if (action === 'recheck') {
        await apiData(recheckOrderMaterialAudit(orderId), 'Failed to recheck order materials')
        setSuccess('Order material demand recalculated')
      } else {
        await apiData(deductOrderMaterialAudit(orderId), 'Failed to deduct order materials')
        setSuccess('Order material deduction attempted')
      }
      await Promise.all([loadAvailability(), loadOpenAudit(), loadReport()])
    } catch (e) {
      setError(e.message || 'Material action failed')
    } finally {
      setBusyOrderId(null)
    }
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#f8fafc' }}>
      <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#fff', flexShrink: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Inventory2Icon color="primary" />
          <Box sx={{ minWidth: 240, flex: '1 1 280px' }}>
            <Typography fontWeight={900} sx={{ fontSize: 20, lineHeight: 1.1 }}>Shop Materials</Typography>
            <Typography variant="caption" color="text.secondary">Processing inventory, waiting stock, and material usage</Typography>
          </Box>
          <TextField size="small" type="date" label="From" value={from} onChange={e => setFrom(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
          <TextField size="small" type="date" label="To" value={to} onChange={e => setTo(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 160 }} />
          <Button variant="outlined" startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />} onClick={reloadAll} disabled={loading}>
            Refresh
          </Button>
        </Box>
        <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexWrap: 'wrap', rowGap: 1 }}>
          <StatChip icon={<WarningAmberIcon />} label="materials waiting" value={stats.waitingMaterials} color={stats.waitingMaterials ? 'error' : 'default'} />
          <StatChip label="waiting qty" value={fmtQty(stats.waitingQty)} color={stats.waitingQty ? 'warning' : 'default'} />
          <StatChip label="menu items at 0" value={stats.blockedItems} color={stats.blockedItems ? 'error' : 'default'} />
          <StatChip icon={<FactCheckIcon />} label="required in report" value={fmtQty(stats.requiredQty)} color="primary" />
          <StatChip icon={<CheckCircleIcon />} label="deducted" value={fmtQty(stats.deductedQty)} color="success" />
        </Stack>
      </Box>

      {error && <Alert severity="error" onClose={() => setError('')} sx={{ m: 1.5, mb: 0, flexShrink: 0 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess('')} sx={{ m: 1.5, mb: 0, flexShrink: 0 }}>{success}</Alert>}

      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', p: 1.5 }}>
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', mb: 1.5 }}>
          <Box sx={{ px: 1.5, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
            <Box>
              <Typography fontWeight={900}>Processing Unit Availability</Typography>
              <Typography variant="caption" color="text.secondary">Calculated from real inventory minus open shop demand; manual left units override calculated units.</Typography>
            </Box>
            <Tooltip title="Refresh availability">
              <IconButton onClick={async () => { try { await loadAvailability() } catch (e) { setError(e.message || 'Failed to refresh availability') } }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider />
          <TableContainer sx={{ maxHeight: 420 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Menu item</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Calculated</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Left units</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Effective</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Limiting material</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && availability.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                )}
                {!loading && availability.length === 0 && (
                  <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No active menu items found</TableCell></TableRow>
                )}
                {availability.map(row => {
                  const limits = Array.isArray(row.materialLimits) ? row.materialLimits : []
                  const sortedLimits = [...limits].sort((a, b) => Number(a.possibleUnits || 0) - Number(b.possibleUnits || 0))
                  const effective = Number(row.effectiveAvailableUnits ?? row.calculatedAvailableUnits ?? 0)
                  return (
                    <TableRow key={row.modelId} hover>
                      <TableCell>
                        <Typography fontWeight={800}>{row.modelName}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.modelCode || row.modelId}</Typography>
                      </TableCell>
                      <TableCell align="right">{row.hasBom ? fmtQty(row.calculatedAvailableUnits) : <Chip label="No BOM" size="small" />}</TableCell>
                      <TableCell align="right" sx={{ width: 150 }}>
                        <TextField
                          size="small"
                          type="number"
                          value={overrideInputs[row.modelId] ?? ''}
                          onChange={e => setOverrideInputs(prev => ({ ...prev, [row.modelId]: e.target.value }))}
                          inputProps={{ min: 0, step: '0.001' }}
                          InputProps={{ endAdornment: <InputAdornment position="end">unit</InputAdornment> }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={fmtQty(row.effectiveAvailableUnits)}
                          color={effective <= 0 && row.hasBom ? 'error' : 'success'}
                          variant={effective <= 0 && row.hasBom ? 'filled' : 'outlined'}
                          sx={{ fontWeight: 900 }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 260 }}>
                        {sortedLimits.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">No material limit</Typography>
                        ) : (
                          <Stack spacing={0.4}>
                            {sortedLimits.slice(0, 3).map(limit => (
                              <Typography key={limit.materialId} variant="caption" sx={{ display: 'block' }}>
                                <strong>{limit.materialCode || limit.materialName}</strong>: {fmtQty(limit.availableQty)} available / {fmtQty(limit.requiredPerUnit)} per unit = {fmtQty(limit.possibleUnits)}
                              </Typography>
                            ))}
                          </Stack>
                        )}
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={savingModelId === row.modelId ? <CircularProgress size={14} /> : <SaveIcon />}
                            onClick={() => saveOverride(row)}
                            disabled={savingModelId === row.modelId}
                          >
                            Save
                          </Button>
                          <Tooltip title="Clear manual left units">
                            <IconButton size="small" onClick={() => setOverrideInputs(prev => ({ ...prev, [row.modelId]: '' }))}>
                              <RestartAltIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', mb: 1.5 }}>
          <Box sx={{ px: 1.5, py: 1.25 }}>
            <Typography fontWeight={900}>Waiting Stock Audit</Typography>
            <Typography variant="caption" color="text.secondary">Orders that were confirmed although material was short remain here until rechecked or deducted later.</Typography>
          </Box>
          <Divider />
          <TableContainer sx={{ maxHeight: 360 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Order</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Menu item</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Material</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Required</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Deducted</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Waiting</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>Remark</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && openRows.length === 0 && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                )}
                {!loading && openRows.length === 0 && (
                  <TableRow><TableCell colSpan={9} align="center" sx={{ py: 4, color: 'text.secondary' }}>No waiting material audit rows</TableCell></TableRow>
                )}
                {openRows.map(row => (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography fontWeight={900}>{fmtOrder(row)}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.orderCode}</Typography>
                    </TableCell>
                    <TableCell>{row.modelName || '-'}</TableCell>
                    <TableCell>
                      <Typography fontWeight={800}>{row.materialCode || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.materialName || '-'}</Typography>
                    </TableCell>
                    <TableCell align="right">{fmtQty(row.requiredQty)}</TableCell>
                    <TableCell align="right">{fmtQty(row.deductedQty)}</TableCell>
                    <TableCell align="right">
                      <Typography fontWeight={900} color={Number(row.waitingQty || 0) > 0 ? 'error.main' : 'success.main'}>
                        {fmtQty(row.waitingQty)}
                      </Typography>
                    </TableCell>
                    <TableCell><Chip label={row.status} color={statusColor(row.status)} size="small" sx={{ fontWeight: 800 }} /></TableCell>
                    <TableCell sx={{ maxWidth: 260 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{row.remark || row.source || '-'}</Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button size="small" variant="outlined" onClick={() => orderAction(row.orderId, 'recheck')} disabled={busyOrderId === row.orderId}>
                          Recheck
                        </Button>
                        <Button size="small" variant="contained" color="success" onClick={() => orderAction(row.orderId, 'deduct')} disabled={busyOrderId === row.orderId}>
                          Deduct
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0' }}>
          <Box sx={{ px: 1.5, py: 1.25 }}>
            <Typography fontWeight={900}>Material Usage Report</Typography>
            <Typography variant="caption" color="text.secondary">Required, deducted, and waiting quantities for the selected period.</Typography>
          </Box>
          <Divider />
          <TableContainer sx={{ maxHeight: 360 }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900 }}>Material</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Required</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Deducted</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Waiting</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 900 }}>Orders</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && reportRows.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><CircularProgress /></TableCell></TableRow>
                )}
                {!loading && reportRows.length === 0 && (
                  <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No material usage found for this period</TableCell></TableRow>
                )}
                {reportRows.map(row => (
                  <TableRow key={row.materialId} hover>
                    <TableCell>
                      <Typography fontWeight={800}>{row.materialCode || '-'}</Typography>
                      <Typography variant="caption" color="text.secondary">{row.materialName || '-'}</Typography>
                    </TableCell>
                    <TableCell align="right">{fmtQty(row.requiredQty)}</TableCell>
                    <TableCell align="right">{fmtQty(row.deductedQty)}</TableCell>
                    <TableCell align="right">{fmtQty(row.waitingQty)}</TableCell>
                    <TableCell align="right">{row.orderCount ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Box>
    </Box>
  )
}
