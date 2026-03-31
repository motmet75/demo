import React, { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'
import PropTypes from 'prop-types'
import { fetchOrderById } from '../../api/orderApi'
import { apiFetchJson } from '../../api/client'
import { fetchMaterials } from '../../api/materialApi'

const STATUS_COLOR = {
  DRAFT: 'default', CONFIRMED: 'primary', IN_PRODUCTION: 'warning',
  PARTIALLY_COMPLETED: 'warning', COMPLETED: 'success',
  DELIVERED: 'success', CANCELLED: 'error', CANCEL_PENDING: 'error'
}

function LabelValue({ label, value }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 160 }}>{label}:</Typography>
      <Typography variant="body2">{value ?? '—'}</Typography>
    </Box>
  )
}

/**
 * Read-only order detail dialog.
 * Props: open, orderId, onClose
 */
export default function OrderDetailModal({ open, orderId, onClose }) {
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')
  const [modelMap, setModelMap] = useState({})   // id → { modelCode, modelName }
  const [materialMap, setMaterialMap] = useState({}) // id → { materialCode, materialName }

  useEffect(() => {
    if (!open || !orderId) return
    setLoading(true)
    setError('')
    fetchOrderById(orderId)
      .then(d => setOrder(d))
      .catch(e => setError(e.message || 'Failed to load order'))
      .finally(() => setLoading(false))
  }, [open, orderId])

  // Load lookup maps for model/material names
  useEffect(() => {
    if (!open) return
    apiFetchJson('/bom/models').then(({ data }) => {
      const list = Array.isArray(data) ? data : (data && Array.isArray(data.content) ? data.content : [])
      const map = {}
      list.forEach(m => { map[m.id] = m })
      setModelMap(map)
    }).catch(() => {})
    fetchMaterials().then(list => {
      const map = {}
      list.forEach(m => { map[m.id] = m })
      setMaterialMap(map)
    }).catch(() => {})
  }, [open])

  return (
    <Dialog open={!!open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>Order Detail</DialogTitle>
      <DialogContent dividers>
        {loading && <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>}
        {error   && <Alert severity="error">{error}</Alert>}
        {!loading && !error && order && (
          <>
            {/* ── Header info ──────────────────────────────────── */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Typography variant="h6">{order.orderNumber}</Typography>
              <Chip label={order.status} color={STATUS_COLOR[order.status] || 'default'} size="small" />
              <Chip label={order.orderType} variant="outlined" size="small" />
            </Box>

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
              <LabelValue label="Order Number"       value={order.orderNumber} />
              <LabelValue label="Type"               value={order.orderType} />
              <LabelValue label="Status"             value={order.status} />
              <LabelValue label="Customer ID"        value={order.customerId} />
              <LabelValue label="Planned Start"      value={order.plannedStartDate} />
              <LabelValue label="Planned End"        value={order.plannedEndDate} />
              <LabelValue label="Actual Start"       value={order.actualStartDate} />
              <LabelValue label="Actual End"         value={order.actualEndDate} />
              <LabelValue label="Total Planned Qty"  value={order.totalPlannedQty} />
              <LabelValue label="Total Actual Qty"   value={order.totalActualQty} />
              <LabelValue label="Created By"         value={order.createdBy} />
              <LabelValue label="Created At"         value={order.createdAt} />
              <LabelValue label="Notes"              value={order.notes} />
            </Box>

            <Divider sx={{ my: 2 }} />

            {/* ── Lines ────────────────────────────────────────── */}
            <Typography variant="subtitle2" gutterBottom>Order Lines ({order.lines?.length ?? 0})</Typography>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ '& th': { fontWeight: 600 } }}>
                  <TableCell>#</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Model / Material</TableCell>
                  <TableCell align="right">Ordered</TableCell>
                  <TableCell align="right">Produced</TableCell>
                  <TableCell align="right">Delivered</TableCell>
                  <TableCell align="right">Cancelled</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Notes</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(order.lines || []).map(l => {
                  const model    = l.modelId    ? modelMap[l.modelId]       : null
                  const material = l.materialId ? materialMap[l.materialId] : null
                  const nameLabel = l.lineType === 'MODEL'
                    ? (model    ? `${model.modelCode} – ${model.modelName}`        : <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{l.modelId}</span>)
                    : (material ? `${material.materialCode} – ${material.materialName}` : <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{l.materialId}</span>)
                  return (
                    <TableRow key={l.id}>
                      <TableCell>{l.lineNumber}</TableCell>
                      <TableCell><Chip label={l.lineType} size="small" variant="outlined" /></TableCell>
                      <TableCell>{nameLabel}</TableCell>
                      <TableCell align="right">{l.quantityOrdered}</TableCell>
                      <TableCell align="right">{l.quantityProduced}</TableCell>
                      <TableCell align="right">{l.quantityDelivered}</TableCell>
                      <TableCell align="right">{l.quantityCancelled}</TableCell>
                      <TableCell>{l.unit}</TableCell>
                      <TableCell>
                        <Chip label={l.lineStatus} size="small" color={l.lineStatus === 'COMPLETED' ? 'success' : l.lineStatus === 'CANCELLED' ? 'error' : 'default'} />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>{l.notes || '—'}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

OrderDetailModal.propTypes = {
  open: PropTypes.bool.isRequired,
  orderId: PropTypes.string,
  onClose: PropTypes.func.isRequired
}
