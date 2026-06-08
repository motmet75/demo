import React, { useEffect, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import IconButton from '@mui/material/IconButton'
import Stack from '@mui/material/Stack'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import { fetchModels } from '../../api/modelApi'
import { fetchMenuOptions, updateOrderItems } from '../../api/shopApi'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

function parseOpts(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

export default function EditOrderDialog({ open, order, onClose, onUpdated }) {
  const [models, setModels]           = useState([])
  const [loading, setLoading]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [items, setItems]             = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [optsByModel, setOptsByModel] = useState({})

  // Initialise items from order
  useEffect(() => {
    if (!open || !order) return
    setLoading(true)
    // Pre-populate items from existing order
    const initial = (order.items || []).map(item => ({
      modelId: item.modelId,
      modelName: item.modelName,
      sellingPrice: item.unitPrice,
      qty: Number(item.quantity),
      selectedOptions: parseOpts(item.selectedOptions),
      itemNotes: item.itemNotes || '',
    }))
    setItems(initial)
    // Fetch models list and options for each existing item
    Promise.all([
      fetchModels(),
      ...initial.map(i => fetchMenuOptions(i.modelId)
        .then(({ data }) => ({ modelId: i.modelId, opts: Array.isArray(data) ? data : [] }))
        .catch(() => ({ modelId: i.modelId, opts: [] }))
      )
    ]).then(([mList, ...optResults]) => {
      setModels((mList || []).filter(m => m.sellingPrice != null))
      const map = {}
      optResults.forEach(({ modelId, opts }) => { map[modelId] = opts })
      setOptsByModel(map)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [open, order])

  const addItem = () => {
    if (!selectedModel) return
    const mid = selectedModel.id
    setItems(prev => {
      const existing = prev.find(i => i.modelId === mid)
      if (existing) return prev.map(i => i.modelId === mid ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { modelId: mid, modelName: selectedModel.modelName, sellingPrice: selectedModel.sellingPrice, qty: 1, selectedOptions: {}, itemNotes: '' }]
    })
    if (!optsByModel[mid]) {
      fetchMenuOptions(mid)
        .then(({ data }) => setOptsByModel(p => ({ ...p, [mid]: Array.isArray(data) ? data : [] })))
        .catch(() => setOptsByModel(p => ({ ...p, [mid]: [] })))
    }
    setSelectedModel(null)
  }

  const changeQty = (modelId, delta) => {
    setItems(prev => prev.map(i => i.modelId === modelId ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0))
  }

  const toggleOption = (modelId, groupName, value, multiSelect) => {
    setItems(prev => prev.map(item => {
      if (item.modelId !== modelId) return item
      const cur = item.selectedOptions[groupName]
      let next
      if (multiSelect) {
        const arr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
        next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
        if (!next.length) next = undefined
      } else {
        next = cur === value ? undefined : value
      }
      const opts = { ...item.selectedOptions }
      if (next === undefined) delete opts[groupName]; else opts[groupName] = next
      return { ...item, selectedOptions: opts }
    }))
  }

  const setItemNotes = (modelId, note) => {
    setItems(prev => prev.map(i => i.modelId === modelId ? { ...i, itemNotes: note } : i))
  }

  const total = items.reduce((s, i) => s + i.qty * Number(i.sellingPrice || 0), 0)

  const handleSave = async () => {
    if (!items.length) { setError('At least one item required'); return }
    setSaving(true); setError('')
    const payload = items.map(i => ({
      modelId: i.modelId,
      quantity: i.qty,
      selectedOptions: Object.keys(i.selectedOptions || {}).length > 0 ? JSON.stringify(i.selectedOptions) : null,
      itemNotes: i.itemNotes || null,
    }))
    try {
      const { res, data } = await updateOrderItems(order.id, payload)
      if (!res.ok) { setError(data?.message || 'Failed to save'); setSaving(false); return }
      onUpdated?.(data)
    } catch (e) { setError(e.message || 'Network error') }
    setSaving(false)
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"
      PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={800} variant="h6">
          Edit Order #{order?.orderNumber ?? order?.orderCode}
        </Typography>
        <Typography variant="caption" color="text.secondary">Modify items — PENDING only</Typography>
      </DialogTitle>

      <DialogContent>
        {loading ? (
          <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress /></Box>
        ) : (
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

            {/* Item search */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Autocomplete
                size="small"
                options={models}
                getOptionLabel={m => `${m.modelName} — ${fmt(m.sellingPrice)}`}
                value={selectedModel}
                onChange={(_, v) => setSelectedModel(v)}
                renderInput={params => <TextField {...params} label="Add item…" />}
                sx={{ flex: 1 }}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                noOptionsText="No items with price"
              />
              <Button variant="contained" onClick={addItem} disabled={!selectedModel}
                startIcon={<AddIcon />} sx={{ textTransform: 'none', flexShrink: 0 }}>
                Add
              </Button>
            </Box>

            {items.length > 0 ? (
              <Stack spacing={0.75}>
                {items.map(item => {
                  const modelOpts = optsByModel[item.modelId] || []
                  return (
                    <Box key={item.modelId} sx={{ bgcolor: '#f9f9f9', borderRadius: 1.5, px: 1.25, pt: 0.75, pb: 0.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }} noWrap>
                          {item.modelName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">{fmt(item.sellingPrice)}</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                          <IconButton size="small" onClick={() => changeQty(item.modelId, -1)} sx={{ p: 0.25 }}>
                            <RemoveIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                          <Typography variant="body2" fontWeight={700} sx={{ minWidth: 20, textAlign: 'center' }}>
                            {item.qty}
                          </Typography>
                          <IconButton size="small" onClick={() => changeQty(item.modelId, 1)}
                            sx={{ p: 0.25, bgcolor: '#1976d2', color: '#fff', '&:hover': { bgcolor: '#1565c0' } }}>
                            <AddIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                        <Typography variant="body2" color="primary" fontWeight={700} sx={{ minWidth: 64, textAlign: 'right', fontSize: 13 }}>
                          {fmt(item.qty * Number(item.sellingPrice || 0))}
                        </Typography>
                        <IconButton size="small" color="error"
                          onClick={() => setItems(prev => prev.filter(i => i.modelId !== item.modelId))}
                          sx={{ p: 0.25 }}>
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Box>

                      {/* Options */}
                      {modelOpts.map(grp => {
                        const choices = (() => { try { return JSON.parse(grp.choices) } catch { return [] } })()
                        if (!choices.length) return null
                        const curVal = item.selectedOptions[grp.groupName]
                        const selArr = Array.isArray(curVal) ? curVal : (curVal ? [curVal] : [])
                        return (
                          <Box key={grp.id} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary"
                              sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                              {grp.groupName}
                              {grp.required && <span style={{ color: '#e53935' }}> *</span>}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                              {choices.map(choice => {
                                const active = selArr.includes(choice)
                                return (
                                  <Chip key={choice} label={choice} size="small"
                                    onClick={() => toggleOption(item.modelId, grp.groupName, choice, grp.multiSelect)}
                                    sx={{
                                      height: 22, fontSize: 11, cursor: 'pointer',
                                      bgcolor: active ? '#1976d2' : '#fff',
                                      color: active ? '#fff' : '#555',
                                      border: `1px solid ${active ? '#1976d2' : '#ddd'}`,
                                      fontWeight: active ? 700 : 400,
                                    }}
                                  />
                                )
                              })}
                            </Box>
                          </Box>
                        )
                      })}

                      <TextField size="small" variant="standard" fullWidth
                        placeholder="Item note…"
                        value={item.itemNotes || ''}
                        onChange={e => setItemNotes(item.modelId, e.target.value)}
                        InputProps={{ disableUnderline: false, sx: { fontSize: 12 } }}
                        sx={{ mt: 0.5, mb: 0.25 }}
                      />
                    </Box>
                  )
                })}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5, px: 1 }}>
                  <Typography fontWeight={800}>Total</Typography>
                  <Typography fontWeight={800} color="primary">{fmt(total)}</Typography>
                </Box>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 2 }}>
                No items — add at least one
              </Typography>
            )}
          </Stack>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}
          disabled={saving || !items.length}
          startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none', minWidth: 140 }}>
          {saving ? 'Saving…' : `Save · ${fmt(total)}`}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
