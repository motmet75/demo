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
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import AddIcon from '@mui/icons-material/Add'
import RemoveIcon from '@mui/icons-material/Remove'
import DeleteIcon from '@mui/icons-material/Delete'
import SaveIcon from '@mui/icons-material/Save'
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd'
import CloseIcon from '@mui/icons-material/Close'
import { fetchModels } from '../../api/modelApi'
import { fetchMenuOptions, updateOrderItems } from '../../api/shopApi'

const fmt       = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''
const fmtDots   = (digits) => digits ? Number(digits).toLocaleString('vi-VN') : ''
const stripDigs = (s) => s.replace(/[^0-9]/g, '')

function parseOpts(str) {
  if (!str) return {}
  try { return JSON.parse(str) } catch { return {} }
}

export default function EditOrderDialog({ open, order, onClose, onUpdated }) {
  const [models, setModels]               = useState([])
  const [loading, setLoading]             = useState(false)
  const [saving, setSaving]               = useState(false)
  const [error, setError]                 = useState('')
  const [items, setItems]                 = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [optsByModel, setOptsByModel]     = useState({})
  // per-item side-item add form: { [parentUid]: { model, priceDigits } }
  const [sideForm, setSideForm]           = useState({})

  useEffect(() => {
    if (!open || !order) return
    setLoading(true)
    const allItems = order.items || []
    const roots = allItems.filter(it => !it.parentItemId)
    const initial = roots.map(item => ({
      uid: crypto.randomUUID(),
      modelId: item.modelId,
      modelName: item.modelName,
      sellingPrice: item.unitPrice,
      customPriceDigits: String(Math.round(Number(item.unitPrice) || 0)),
      qty: Number(item.quantity),
      selectedOptions: parseOpts(item.selectedOptions),
      itemNotes: item.itemNotes || '',
      sideItems: allItems.filter(si => si.parentItemId === item.id).map(si => ({
        uid: crypto.randomUUID(),
        modelId: si.modelId, modelName: si.modelName,
        customPriceDigits: String(Math.round(Number(si.unitPrice) || 0)),
      })),
    }))
    setItems(initial)
    setSideForm({})
    Promise.all([
      fetchModels(),
      ...initial.map(i =>
        fetchMenuOptions(i.modelId)
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

  const ensureOpts = (mid) => {
    if (optsByModel[mid] !== undefined) return
    fetchMenuOptions(mid)
      .then(({ data }) => setOptsByModel(p => ({ ...p, [mid]: Array.isArray(data) ? data : [] })))
      .catch(() => setOptsByModel(p => ({ ...p, [mid]: [] })))
  }

  // ── Main item operations (all keyed by uid) ────────────────────────

  const addItem = () => {
    if (!selectedModel) return
    ensureOpts(selectedModel.id)
    setItems(prev => [...prev, {
      uid: crypto.randomUUID(),
      modelId: selectedModel.id, modelName: selectedModel.modelName,
      sellingPrice: selectedModel.sellingPrice,
      customPriceDigits: String(Math.round(Number(selectedModel.sellingPrice) || 0)),
      qty: 1, selectedOptions: {}, itemNotes: '', sideItems: [],
    }])
    setSelectedModel(null)
  }

  const changeQty = (uid, delta) => {
    setItems(prev =>
      prev.map(i => i.uid === uid ? { ...i, qty: i.qty + delta } : i).filter(i => i.qty > 0)
    )
  }

  const toggleOption = (uid, groupName, value, multiSelect) => {
    setItems(prev => prev.map(item => {
      if (item.uid !== uid) return item
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

  const setItemNotes = (uid, note) =>
    setItems(prev => prev.map(i => i.uid === uid ? { ...i, itemNotes: note } : i))

  const setItemPrice = (uid, digits) =>
    setItems(prev => prev.map(i => i.uid === uid ? { ...i, customPriceDigits: digits } : i))

  // ── Side item operations ───────────────────────────────────────────

  const setSF = (parentUid, field, value) =>
    setSideForm(prev => ({ ...prev, [parentUid]: { ...(prev[parentUid] || {}), [field]: value } }))

  const addSideItem = (parentUid) => {
    const sf = sideForm[parentUid] || {}
    if (!sf.model) return
    const price = sf.priceDigits ?? String(Math.round(Number(sf.model.sellingPrice) || 0))
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: [...i.sideItems, {
          uid: crypto.randomUUID(),
          modelId: sf.model.id, modelName: sf.model.modelName,
          customPriceDigits: price,
        }]
      }
    ))
    setSideForm(prev => ({ ...prev, [parentUid]: {} }))
  }

  const removeSideItem = (parentUid, sideUid) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : { ...i, sideItems: i.sideItems.filter(si => si.uid !== sideUid) }
    ))

  const setSideItemPrice = (parentUid, sideUid, digits) =>
    setItems(prev => prev.map(i =>
      i.uid !== parentUid ? i : {
        ...i, sideItems: i.sideItems.map(si =>
          si.uid === sideUid ? { ...si, customPriceDigits: digits } : si
        )
      }
    ))

  // ── Totals ─────────────────────────────────────────────────────────

  const calcOptAddOn = (item) => {
    const groups = optsByModel[item.modelId] || []
    return groups.reduce((sum, grp) => {
      if (grp.isFree) return sum
      let defs; try { defs = JSON.parse(grp.choices) } catch { return sum }
      const cur = item.selectedOptions[grp.groupName]
      const selArr = Array.isArray(cur) ? cur : (cur ? [cur] : [])
      return sum + defs
        .filter(c => typeof c === 'object' && selArr.includes(c.label))
        .reduce((s, c) => s + (Number(c.price) || 0), 0)
    }, 0)
  }

  const sidesTotal = (item) =>
    item.sideItems.reduce((s, si) => s + (Number(si.customPriceDigits) || 0), 0)

  const itemBasePrice = (item) => Number(item.customPriceDigits) || 0

  const total = items.reduce((s, i) =>
    s + i.qty * (itemBasePrice(i) + calcOptAddOn(i)) + sidesTotal(i), 0
  )

  // ── Submit ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!items.length) { setError('At least one item required'); return }
    setSaving(true); setError('')
    const payload = items.map(i => ({
      modelId: i.modelId, quantity: i.qty,
      selectedOptions: Object.keys(i.selectedOptions || {}).length > 0 ? JSON.stringify(i.selectedOptions) : null,
      itemNotes: i.itemNotes || null,
      unitPriceOverride: Number(i.customPriceDigits) || null,
      sideItems: i.sideItems.map(si => ({
        modelId: si.modelId, quantity: 1,
        selectedOptions: null, itemNotes: null,
        unitPriceOverride: Number(si.customPriceDigits) || null,
        sideItems: [],
      })),
    }))
    try {
      const { res, data } = await updateOrderItems(order.id, payload)
      if (!res.ok) { setError(data?.message || 'Failed to save'); setSaving(false); return }
      onUpdated?.(data)
    } catch (e) { setError(e.message || 'Network error') }
    setSaving(false)
  }

  // ── Render ─────────────────────────────────────────────────────────

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

            {/* Add item row */}
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
              <Stack spacing={1}>
                {items.map(item => {
                  const modelOpts = optsByModel[item.modelId] || []
                  const sf = sideForm[item.uid] || {}
                  const lineTotal = item.qty * (itemBasePrice(item) + calcOptAddOn(item)) + sidesTotal(item)
                  return (
                    <Box key={item.uid} sx={{ border: '1.5px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>

                      {/* ── Main item ───────────────────────────────────────── */}
                      <Box sx={{ bgcolor: '#f8faff', px: 1.5, pt: 1, pb: 0.75 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
                          <Typography variant="body2" fontWeight={700} sx={{ flex: 1, minWidth: 80 }} noWrap>
                            {item.modelName}
                          </Typography>
                          <TextField
                            size="small" type="text" inputMode="numeric" placeholder="0"
                            value={fmtDots(item.customPriceDigits || '')}
                            onChange={e => setItemPrice(item.uid, stripDigs(e.target.value))}
                            inputProps={{ maxLength: 12, style: { fontSize: 12, fontWeight: 700, textAlign: 'right', width: 68 } }}
                            InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                            sx={{ width: 106, '& .MuiInputBase-root': { height: 30 } }}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
                            <IconButton size="small" onClick={() => changeQty(item.uid, -1)} sx={{ p: 0.25 }}>
                              <RemoveIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                            <Typography variant="body2" fontWeight={700} sx={{ minWidth: 20, textAlign: 'center', fontSize: 13 }}>
                              {item.qty}
                            </Typography>
                            <IconButton size="small" onClick={() => changeQty(item.uid, 1)}
                              sx={{ p: 0.25, bgcolor: '#1976d2', color: '#fff', borderRadius: 0.75, '&:hover': { bgcolor: '#1565c0' } }}>
                              <AddIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                          </Box>
                          <Typography variant="body2" color="primary" fontWeight={800}
                            sx={{ minWidth: 70, textAlign: 'right', fontSize: 13 }}>
                            {fmt(lineTotal)}
                          </Typography>
                          <IconButton size="small" color="error"
                            onClick={() => setItems(prev => prev.filter(i => i.uid !== item.uid))}
                            sx={{ p: 0.25 }}>
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>

                        {/* Option chips */}
                        {modelOpts.map(grp => {
                          const rawChoices = (() => { try { return JSON.parse(grp.choices) } catch { return [] } })()
                          const choices = rawChoices.map(c => typeof c === 'object' ? c : { label: String(c), price: 0 })
                          if (!choices.length) return null
                          const curVal = item.selectedOptions[grp.groupName]
                          const selArr = Array.isArray(curVal) ? curVal : (curVal ? [curVal] : [])
                          return (
                            <Box key={grp.id} sx={{ mt: 0.5 }}>
                              <Typography variant="caption" color="text.secondary"
                                sx={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                {grp.groupName}
                                {grp.required && <span style={{ color: '#e53935' }}> *</span>}
                                {grp.isFree ? ' (free)' : ''}
                              </Typography>
                              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
                                {choices.map(choice => {
                                  const active = selArr.includes(choice.label)
                                  const priceTag = (!grp.isFree && choice.price > 0)
                                    ? ` +${Number(choice.price).toLocaleString('vi-VN')}đ` : ''
                                  return (
                                    <Chip key={choice.label} label={choice.label + priceTag} size="small"
                                      onClick={() => toggleOption(item.uid, grp.groupName, choice.label, grp.multiSelect)}
                                      sx={{
                                        height: 22, fontSize: 11, cursor: 'pointer',
                                        bgcolor: active ? '#1976d2' : '#fff', color: active ? '#fff' : '#555',
                                        border: `1px solid ${active ? '#1976d2' : '#ddd'}`, fontWeight: active ? 700 : 400,
                                      }} />
                                  )
                                })}
                              </Box>
                            </Box>
                          )
                        })}

                        <TextField size="small" variant="standard" fullWidth
                          placeholder="Item note…" value={item.itemNotes || ''}
                          onChange={e => setItemNotes(item.uid, e.target.value)}
                          InputProps={{ disableUnderline: false, sx: { fontSize: 12 } }}
                          sx={{ mt: 0.5 }}
                        />
                      </Box>

                      {/* ── Children (tree) ──────────────────────────────────── */}
                      <Box sx={{ bgcolor: '#f0f4ff', borderTop: '1px solid #e2e8f0' }}>
                        <Box sx={{ ml: 1.5, borderLeft: '2px solid #c7d2fe' }}>

                          {/* Side item rows */}
                          {item.sideItems.map(si => (
                            <Box key={si.uid} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, py: 0.5, pr: 0.75, borderBottom: '1px solid #e8eaf6' }}>
                              <Box sx={{ width: 14, height: 2, bgcolor: '#c7d2fe', flexShrink: 0 }} />
                              <Typography variant="caption" fontWeight={600} sx={{ flex: 1, fontSize: 12 }} noWrap>
                                {si.modelName}
                              </Typography>
                              <TextField
                                size="small" type="text" inputMode="numeric" placeholder="0"
                                value={fmtDots(si.customPriceDigits || '')}
                                onChange={e => setSideItemPrice(item.uid, si.uid, stripDigs(e.target.value))}
                                inputProps={{ maxLength: 12, style: { fontSize: 12, fontWeight: 700, textAlign: 'right', width: 58 } }}
                                InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                                sx={{ width: 96, '& .MuiInputBase-root': { height: 26 } }}
                              />
                              <Typography variant="caption" color="primary" fontWeight={700}
                                sx={{ minWidth: 54, textAlign: 'right', fontSize: 12 }}>
                                {fmt(Number(si.customPriceDigits) || 0)}
                              </Typography>
                              <IconButton size="small" onClick={() => removeSideItem(item.uid, si.uid)}
                                sx={{ p: 0.25, color: '#94a3b8', '&:hover': { color: '#dc2626' } }}>
                                <CloseIcon sx={{ fontSize: 13 }} />
                              </IconButton>
                            </Box>
                          ))}

                          {/* Add side item */}
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5, py: 0.6, pr: 0.75, flexWrap: 'wrap' }}>
                            <Box sx={{ width: 14, height: 2, bgcolor: '#a5b4fc', flexShrink: 0, mt: 2.25 }} />
                            <Autocomplete
                              size="small" options={models} getOptionLabel={m => m.modelName}
                              value={sf.model || null}
                              onChange={(_, v) => {
                                setSF(item.uid, 'model', v)
                                if (v) setSF(item.uid, 'priceDigits', String(Math.round(Number(v.sellingPrice) || 0)))
                              }}
                              renderInput={params => <TextField {...params} label="Add topping / side…" size="small" />}
                              sx={{ flex: 1, minWidth: 130 }}
                              isOptionEqualToValue={(a, b) => a.id === b.id}
                              noOptionsText="No items"
                            />
                            <TextField
                              size="small" type="text" inputMode="numeric" label="Price" placeholder="0"
                              value={fmtDots(sf.priceDigits || '')}
                              onChange={e => setSF(item.uid, 'priceDigits', stripDigs(e.target.value))}
                              inputProps={{ maxLength: 12 }}
                              InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                              sx={{ width: 98 }}
                            />
                            <Button size="small" variant="contained"
                              startIcon={<PlaylistAddIcon sx={{ fontSize: 14 }} />}
                              onClick={() => addSideItem(item.uid)} disabled={!sf.model}
                              sx={{ textTransform: 'none', fontSize: 11, height: 40, flexShrink: 0,
                                bgcolor: '#6366f1', '&:hover': { bgcolor: '#4f46e5' }, '&.Mui-disabled': { bgcolor: '#e0e0e0' } }}>
                              Add
                            </Button>
                          </Box>

                        </Box>
                      </Box>

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
