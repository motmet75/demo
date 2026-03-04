import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableBody from '@mui/material/TableBody'
import PropTypes from 'prop-types'
import { fetchOrderById, finishOrder } from '../../api/orderApi'

/**
 * FinishOrderModal – lets user input real consumption quantities per material,
 * then calls PATCH /api/orders/{id}/finish.
 *
 * Props: open, orderId, onClose, onFinished(order)
 */
export default function FinishOrderModal({ open, orderId, onClose, onFinished }) {
  const [order, setOrder]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  // map of materialId → realQty string
  const [realQtys, setRealQtys] = useState({})

  useEffect(() => {
    if (!open || !orderId) return
    setLoading(true)
    setError('')
    fetchOrderById(orderId)
      .then(d => {
        setOrder(d)
        // pre-fill with empty strings (will default to effective_planned_qty on server if blank)
        setRealQtys({})
      })
      .catch(e => setError(e.message || 'Failed to load order'))
      .finally(() => setLoading(false))
  }, [open, orderId])

  const handleQtyChange = (materialId) => (e) => {
    setRealQtys(prev => ({ ...prev, [materialId]: e.target.value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError('')
    try {
      const realConsumptions = Object.entries(realQtys)
        .filter(([, v]) => v !== '' && !isNaN(parseFloat(v)))
        .map(([materialId, v]) => ({ materialId, realQty: parseFloat(v) }))
      const result = await finishOrder(orderId, { realConsumptions, updatedBy: 'user' })
      onFinished && onFinished(result)
      onClose()
    } catch (err) {
      setError(err.message || 'Finish failed')
    } finally {
      setSaving(false)
    }
  }

  // Pull distinct materials from lines (MATERIAL lines) + we show a note for MODEL lines
  const materialLines = (order?.lines || []).filter(l => l.lineType === 'MATERIAL')

  return (
    <Dialog open={!!open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Finish Order – Record Actual Consumption</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          {loading && <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress /></Box>}
          {error   && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

          {!loading && order && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Leave a field blank to use the effective planned quantity.
                For MODEL lines, real consumption is resolved from the BOM explosion records on the server.
              </Alert>

              {materialLines.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>MATERIAL Lines – enter real consumed qty</Typography>
                  <Table size="small" sx={{ mb: 2 }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Material ID</TableCell>
                        <TableCell>Unit</TableCell>
                        <TableCell align="right">Ordered Qty</TableCell>
                        <TableCell>Real Qty</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {materialLines.map(l => (
                        <TableRow key={l.id}>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: 12 }}>{l.materialId}</TableCell>
                          <TableCell>{l.unit}</TableCell>
                          <TableCell align="right">{l.quantityOrdered}</TableCell>
                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              placeholder={String(l.quantityOrdered)}
                              value={realQtys[l.materialId] ?? ''}
                              onChange={handleQtyChange(l.materialId)}
                              disabled={saving}
                              inputProps={{ min: 0, step: 'any' }}
                              sx={{ width: 120 }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}

              {materialLines.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  This order has no direct MATERIAL lines. Real consumption for MODEL lines is resolved from BOM explosion logs — server will default to effective planned quantity.
                </Typography>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" variant="contained" color="success" disabled={saving || loading}>
            {saving ? <CircularProgress size={18} sx={{ mr: 1 }} /> : null}
            Confirm Finish
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}

FinishOrderModal.propTypes = {
  open: PropTypes.bool.isRequired,
  orderId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onFinished: PropTypes.func
}
