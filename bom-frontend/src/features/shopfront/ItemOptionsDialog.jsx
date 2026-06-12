import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import NoteAltIcon from '@mui/icons-material/NoteAlt'
import InputAdornment from '@mui/material/InputAdornment'
import RemoveIcon from '@mui/icons-material/Remove'
import AddIcon from '@mui/icons-material/Add'
import IconButton from '@mui/material/IconButton'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

function parseChoices(str) {
  if (!str) return []
  try { return JSON.parse(str) } catch { return str.split(',').map(s => s.trim()).filter(Boolean) }
}

export default function ItemOptionsDialog({ open, model, options = [], allowedSideOptions = [], initialCart, onConfirm, onClose }) {
  const [qty, setQty]       = useState(1)
  const [selected, setSelected] = useState({})
  const [note, setNote]     = useState('')
  const [sides, setSides]   = useState({})  // { [modelId]: qty }

  useEffect(() => {
    if (!open) return
    setSides({})
    if (initialCart) {
      setQty(initialCart.qty || 1)
      try { setSelected(initialCart.selectedOptions ? JSON.parse(initialCart.selectedOptions) : {}) } catch { setSelected({}) }
      setNote(initialCart.itemNotes || '')
    } else {
      setQty(1)
      const defaults = {}
      options.forEach(g => { if (g.defaultValue) defaults[g.groupName] = g.multiSelect ? [g.defaultValue] : g.defaultValue })
      setSelected(defaults)
      setNote('')
    }
  }, [open, model?.id]) // eslint-disable-line

  const handleSelect = (groupName, value, multiSelect) => {
    setSelected(prev => {
      if (multiSelect) {
        const current = Array.isArray(prev[groupName]) ? prev[groupName] : []
        return { ...prev, [groupName]: current.includes(value) ? current.filter(v => v !== value) : [...current, value] }
      }
      return { ...prev, [groupName]: prev[groupName] === value ? null : value }
    })
  }

  const isSelected = (groupName, value, multiSelect) => {
    if (multiSelect) return Array.isArray(selected[groupName]) && selected[groupName].includes(value)
    return selected[groupName] === value
  }

  const changeSideQty = (modelId, delta) =>
    setSides(prev => {
      const next = Math.max(0, (prev[modelId] || 0) + delta)
      if (next === 0) { const { [modelId]: _, ...rest } = prev; return rest }
      return { ...prev, [modelId]: next }
    })

  const canConfirm = options.filter(g => g.required).every(g => {
    const val = selected[g.groupName]
    return g.multiSelect ? Array.isArray(val) && val.length > 0 : val != null && val !== ''
  })

  const sidesTotal = Object.entries(sides).reduce((sum, [modelId, sQty]) => {
    const m = allowedSideOptions.find(x => x.id === modelId)
    return sum + (m ? Number(m.sellingPrice || 0) * sQty : 0)
  }, 0)

  const handleConfirm = () => {
    const opts = Object.fromEntries(
      Object.entries(selected).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
    )
    const sideItems = Object.entries(sides)
      .filter(([, sQty]) => sQty > 0)
      .map(([modelId, sQty]) => {
        const m = allowedSideOptions.find(x => x.id === modelId)
        return { modelId, modelName: m?.modelName || '', qty: sQty }
      })
    onConfirm({
      qty,
      selectedOptions: Object.keys(opts).length ? JSON.stringify(opts) : null,
      itemNotes: note || null,
      sideItems,
    })
  }

  if (!model) return null

  const basePrice = Number(model.sellingPrice || 0)
  const buttonTotal = qty * basePrice + sidesTotal

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={800} variant="h6">{model.modelName}</Typography>
        <Typography variant="body2" color="primary" fontWeight={600}>{fmt(model.sellingPrice)}</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>

        {/* ── Option groups (sugar, ice, add-on chips) ── */}
        {options.map((group, gi) => {
          const choices = parseChoices(group.choices)
          return (
            <Box key={group.id || gi} sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={700}>{group.groupName}</Typography>
                {group.required && <Chip label="required" size="small" color="error" sx={{ fontSize: 10, height: 18 }} />}
                {group.multiSelect && <Chip label="multi" size="small" variant="outlined" sx={{ fontSize: 10, height: 18 }} />}
              </Box>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {choices.map((choice, ci) => {
                  const label    = typeof choice === 'object' && choice !== null ? String(choice.label ?? '') : String(choice)
                  const price    = typeof choice === 'object' && choice !== null ? Number(choice.price || 0) : 0
                  const chipLabel = price > 0 ? `${label} +${fmt(price)}` : label
                  const sel      = isSelected(group.groupName, label, group.multiSelect)
                  return (
                    <Chip
                      key={label || ci}
                      label={chipLabel}
                      onClick={() => handleSelect(group.groupName, label, group.multiSelect)}
                      color={sel ? 'primary' : 'default'}
                      variant={sel ? 'filled' : 'outlined'}
                      sx={{ cursor: 'pointer', fontWeight: sel ? 700 : 400, fontSize: 13, height: 32 }}
                    />
                  )
                })}
              </Box>
            </Box>
          )
        })}

        {/* ── Linked side / topping items (from allowedSideIds, NOT chips) ── */}
        {allowedSideOptions.length > 0 && (
          <>
            {options.length > 0 && <Divider sx={{ mb: 1.5 }} />}
            <Typography fontWeight={700} sx={{ fontSize: 15, mb: 1, color: '#334155' }}>
              Topping / Side
            </Typography>
            {allowedSideOptions.map(side => {
              const sideQty = sides[side.id] || 0
              return (
                <Box key={side.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.25,
                  px: 1.25, py: 1,
                  bgcolor: sideQty > 0 ? '#f0f0ff' : '#f8faff',
                  borderRadius: 2,
                  border: sideQty > 0 ? '1.5px solid #6366f1' : '1px solid #e2e8f0',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}>
                  {/* Thumbnail */}
                  <Box sx={{
                    width: 52, height: 52, flexShrink: 0, borderRadius: 1.5,
                    bgcolor: '#e8eaf6', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {side.imageUrl ? (
                      <Box component="img" src={side.imageUrl} alt={side.modelName}
                        sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.target.style.display = 'none' }} />
                    ) : (
                      <Typography sx={{ fontSize: 26, lineHeight: 1 }}>🧋</Typography>
                    )}
                  </Box>

                  {/* Name + price */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={700} sx={{ fontSize: 14, color: '#1e293b' }} noWrap>
                      {side.modelName}
                    </Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 600, color: '#6366f1' }}>
                      +{fmt(side.sellingPrice)}
                    </Typography>
                  </Box>

                  {/* Stepper — tap + to add, stepper appears once qty > 0 */}
                  {sideQty === 0 ? (
                    <IconButton onClick={() => changeSideQty(side.id, 1)}
                      sx={{ bgcolor: '#6366f1', color: '#fff', borderRadius: 1.5, p: 0.75, '&:hover': { bgcolor: '#4f46e5' } }}>
                      <AddIcon sx={{ fontSize: 24 }} />
                    </IconButton>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                      <IconButton onClick={() => changeSideQty(side.id, -1)}
                        sx={{ p: 0.75, bgcolor: '#f1f5f9', borderRadius: 1 }}>
                        <RemoveIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                      <Typography fontWeight={800} sx={{ minWidth: 26, textAlign: 'center', fontSize: 17, color: '#4f46e5' }}>
                        {sideQty}
                      </Typography>
                      <IconButton onClick={() => changeSideQty(side.id, 1)}
                        sx={{ p: 0.75, bgcolor: '#6366f1', color: '#fff', borderRadius: 1, '&:hover': { bgcolor: '#4f46e5' } }}>
                        <AddIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              )
            })}
          </>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* Per-item note */}
        <TextField
          label="Item note (optional)"
          size="small" fullWidth multiline rows={2}
          placeholder="e.g. No sugar, extra spicy..."
          value={note}
          onChange={e => setNote(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }}
        />

        {/* Qty stepper */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mt: 2 }}>
          <IconButton onClick={() => setQty(q => Math.max(1, q - 1))}
            sx={{ bgcolor: '#f0f0f0', '&:hover': { bgcolor: '#e0e0e0' } }}>
            <RemoveIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={800} sx={{ minWidth: 32, textAlign: 'center' }}>{qty}</Typography>
          <IconButton onClick={() => setQty(q => q + 1)}
            sx={{ bgcolor: '#1976d2', color: '#fff', '&:hover': { bgcolor: '#1565c0' } }}>
            <AddIcon />
          </IconButton>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained" fullWidth onClick={handleConfirm} disabled={!canConfirm}
          sx={{ borderRadius: 2, fontWeight: 700, textTransform: 'none' }}
        >
          Add {qty} · {fmt(buttonTotal)}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
