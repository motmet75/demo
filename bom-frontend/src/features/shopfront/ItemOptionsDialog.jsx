import React, { useState, useEffect } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
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

export default function ItemOptionsDialog({ open, model, options = [], initialCart, onConfirm, onClose }) {
  const [qty, setQty] = useState(1)
  const [selected, setSelected] = useState({})
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!open) return
    if (initialCart) {
      setQty(initialCart.qty || 1)
      setSelected(initialCart.selectedOptions || {})
      setNote(initialCart.itemNotes || '')
    } else {
      setQty(1)
      const defaults = {}
      options.forEach(g => { if (g.defaultValue) defaults[g.groupName] = g.multiSelect ? [g.defaultValue] : g.defaultValue })
      setSelected(defaults)
      setNote('')
    }
  }, [open, model?.id])

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

  const canConfirm = options.filter(g => g.required).every(g => {
    const val = selected[g.groupName]
    return g.multiSelect ? Array.isArray(val) && val.length > 0 : val != null && val !== ''
  })

  const handleConfirm = () => {
    const opts = Object.fromEntries(Object.entries(selected).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length)))
    onConfirm({ qty, selectedOptions: Object.keys(opts).length ? JSON.stringify(opts) : null, itemNotes: note || null })
  }

  if (!model) return null

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={800} variant="h6">{model.modelName}</Typography>
        <Typography variant="body2" color="primary" fontWeight={600}>{fmt(model.sellingPrice)}</Typography>
      </DialogTitle>
      <DialogContent sx={{ pt: 0 }}>

        {/* Option groups */}
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
                {choices.map(choice => {
                  const sel = isSelected(group.groupName, choice, group.multiSelect)
                  return (
                    <Chip
                      key={choice}
                      label={choice}
                      onClick={() => handleSelect(group.groupName, choice, group.multiSelect)}
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

        {options.length > 0 && <Divider sx={{ my: 1.5 }} />}

        {/* Per-item note */}
        <TextField
          label="Item note (optional)"
          size="small" fullWidth multiline rows={2}
          placeholder="e.g. No sugar, extra spicy..."
          value={note}
          onChange={e => setNote(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><NoteAltIcon fontSize="small" color="action" /></InputAdornment> }}
        />

        {/* Qty */}
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
          Add {qty} · {fmt(qty * Number(model.sellingPrice || 0))}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
