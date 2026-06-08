import React, { useEffect, useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardMedia from '@mui/material/CardMedia'
import CardActions from '@mui/material/CardActions'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Stack from '@mui/material/Stack'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu'
import SearchIcon from '@mui/icons-material/Search'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import { fetchModels, updateModel } from '../../api/modelApi'
import { fetchMenuOptions, createMenuOption, deleteMenuOption } from '../../api/shopApi'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

function ModelCard({ model, onEdit, onToggle, saving }) {
  const onMenu = Boolean(model.sellingPrice) && model.isActive !== false
  const hasImage = Boolean(model.imageUrl)

  return (
    <Card variant="outlined" sx={{
      display: 'flex', flexDirection: 'column', height: '100%',
      border: onMenu ? '1.5px solid #1976d2' : '1px solid #e0e0e0',
      borderRadius: 2,
      opacity: saving ? 0.6 : 1,
      transition: 'border-color 0.2s, opacity 0.2s',
    }}>
      {/* Image */}
      <Box sx={{ position: 'relative', height: 130, background: '#f5f5f5', overflow: 'hidden', flexShrink: 0 }}>
        {hasImage ? (
          <CardMedia component="img" image={model.imageUrl} alt={model.modelName}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#bdbdbd' }}>
            <RestaurantMenuIcon sx={{ fontSize: 40 }} />
          </Box>
        )}
        {onMenu && (
          <Chip label="On Menu" size="small" color="primary"
            sx={{ position: 'absolute', top: 6, right: 6, fontWeight: 700, fontSize: 10 }} />
        )}
      </Box>

      <CardContent sx={{ flex: 1, pb: 0, pt: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700} noWrap title={model.modelName}>
          {model.modelName}
        </Typography>
        {model.category && (
          <Chip label={model.category} size="small" variant="outlined"
            sx={{ mt: 0.5, fontSize: 10, height: 20, borderRadius: 1 }} />
        )}
        <Box sx={{ mt: 1 }}>
          {model.sellingPrice ? (
            <Typography variant="body2" color="primary" fontWeight={600}>{fmt(model.sellingPrice)}</Typography>
          ) : (
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', fontSize: 12 }}>No price set</Typography>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ pt: 0.5, pb: 1, px: 1.5, justifyContent: 'space-between', alignItems: 'center' }}>
        <Tooltip title="Edit menu settings">
          <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(model)}>Edit</Button>
        </Tooltip>
        <Tooltip title={onMenu ? 'Remove from menu' : (model.sellingPrice ? 'Add to menu' : 'Set a price first')}>
          <span>
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={onMenu}
                  disabled={saving || (!onMenu && !model.sellingPrice)}
                  onChange={() => onToggle(model)}
                  color="primary"
                />
              }
              label={<Typography variant="caption" color={onMenu ? 'primary' : 'text.secondary'}>{onMenu ? 'ON' : 'OFF'}</Typography>}
              sx={{ mr: 0, ml: 0 }}
            />
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  )
}

const EMPTY_FORM = { sellingPrice: '', category: '', imageUrl: '' }
const EMPTY_OPT  = { groupName: '', choices: '', required: false, multiSelect: false, defaultValue: '' }

function parseChoices(str) {
  if (!str) return []
  try { return JSON.parse(str) } catch { return str.split(',').map(s => s.trim()).filter(Boolean) }
}

function EditDialog({ open, model, onClose, onSave }) {
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [options, setOptions]     = useState([])
  const [optLoading, setOptLoading] = useState(false)
  const [showAddOpt, setShowAddOpt] = useState(false)
  const [newOpt, setNewOpt]       = useState(EMPTY_OPT)
  const [optSaving, setOptSaving] = useState(false)

  useEffect(() => {
    if (!open || !model) return
    setForm({ sellingPrice: model.sellingPrice ?? '', category: model.category ?? '', imageUrl: model.imageUrl ?? '' })
    setError(''); setOptions([]); setShowAddOpt(false); setNewOpt(EMPTY_OPT)
    setOptLoading(true)
    fetchMenuOptions(model.id)
      .then(({ data }) => setOptions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setOptLoading(false))
  }, [open, model?.id])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setOpt = (field) => (e) => setNewOpt(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await onSave(model.id, {
        ...model,
        sellingPrice: form.sellingPrice !== '' ? Number(form.sellingPrice) : null,
        category: form.category || null,
        imageUrl: form.imageUrl || null,
      })
      onClose()
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAddOption = async () => {
    if (!newOpt.groupName.trim() || !newOpt.choices.trim()) return
    setOptSaving(true)
    try {
      const body = {
        modelId: model.id,
        groupName: newOpt.groupName.trim(),
        choices: JSON.stringify(newOpt.choices.split(',').map(s => s.trim()).filter(Boolean)),
        required: newOpt.required,
        multiSelect: newOpt.multiSelect,
        defaultValue: newOpt.defaultValue.trim() || null,
        displayOrder: options.length,
      }
      const { data } = await createMenuOption(body)
      setOptions(prev => [...prev, data])
      setNewOpt(EMPTY_OPT); setShowAddOpt(false)
    } catch (e) {
      setError(e.message || 'Failed to add option group')
    } finally {
      setOptSaving(false)
    }
  }

  const handleDeleteOption = async (optId) => {
    try {
      await deleteMenuOption(optId)
      setOptions(prev => prev.filter(o => o.id !== optId))
    } catch (e) {
      setError(e.message || 'Failed to delete option group')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography fontWeight={700}>{model?.modelName}</Typography>
        <Typography variant="caption" color="text.secondary">Menu settings</Typography>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <TextField label="Selling Price" type="number" size="small" fullWidth
            value={form.sellingPrice} onChange={set('sellingPrice')}
            InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
            helperText="Leave empty to hide from menu" />
          <TextField label="Category" size="small" fullWidth
            value={form.category} onChange={set('category')} placeholder="e.g. Coffee, Tea, Food" />
          <TextField label="Image URL" size="small" fullWidth
            value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://..." />
          {form.imageUrl && (
            <Box sx={{ borderRadius: 1, overflow: 'hidden', height: 120, background: '#f5f5f5' }}>
              <img src={form.imageUrl} alt="preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none' }} />
            </Box>
          )}

          <Divider>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>Option Groups</Typography>
          </Divider>

          {/* Options list */}
          {optLoading ? (
            <Box sx={{ textAlign: 'center' }}><CircularProgress size={20} /></Box>
          ) : options.length === 0 && !showAddOpt ? (
            <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 0.5, fontStyle: 'italic' }}>
              No options configured
            </Typography>
          ) : (
            <Stack spacing={0.75}>
              {options.map(opt => {
                const choices = parseChoices(opt.choices)
                return (
                  <Box key={opt.id} sx={{
                    display: 'flex', alignItems: 'center', bgcolor: '#f9f9f9',
                    borderRadius: 1.5, px: 1.5, py: 0.75, border: '1px solid #eeeeee',
                  }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={700}>{opt.groupName}</Typography>
                        {opt.required && <Chip label="required" size="small" color="error" sx={{ fontSize: 9, height: 16 }} />}
                        {opt.multiSelect && <Chip label="multi" size="small" variant="outlined" sx={{ fontSize: 9, height: 16 }} />}
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {choices.join(' · ')}
                        {opt.defaultValue ? ` (default: ${opt.defaultValue})` : ''}
                      </Typography>
                    </Box>
                    <IconButton size="small" color="error" onClick={() => handleDeleteOption(opt.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )
              })}
            </Stack>
          )}

          {showAddOpt ? (
            <Box sx={{ bgcolor: '#f0f7ff', border: '1.5px solid #90caf9', borderRadius: 2, p: 1.5 }}>
              <Stack spacing={1.25}>
                <TextField label="Group name" size="small" fullWidth
                  value={newOpt.groupName} onChange={setOpt('groupName')}
                  placeholder="e.g. Sugar, Ice, Toppings" autoFocus />
                <TextField label="Choices (comma-separated)" size="small" fullWidth
                  value={newOpt.choices} onChange={setOpt('choices')}
                  placeholder="e.g. 30%, 50%, 70%, 100%" />
                <TextField label="Default value (optional)" size="small" fullWidth
                  value={newOpt.defaultValue} onChange={setOpt('defaultValue')} />
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={newOpt.required} onChange={setOpt('required')} />}
                    label={<Typography variant="caption">Required</Typography>} />
                  <FormControlLabel
                    control={<Checkbox size="small" checked={newOpt.multiSelect} onChange={setOpt('multiSelect')} />}
                    label={<Typography variant="caption">Multi-select</Typography>} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => { setShowAddOpt(false); setNewOpt(EMPTY_OPT) }}>Cancel</Button>
                  <Button size="small" variant="contained" onClick={handleAddOption}
                    disabled={optSaving || !newOpt.groupName.trim() || !newOpt.choices.trim()}>
                    {optSaving ? <CircularProgress size={14} /> : 'Add'}
                  </Button>
                </Box>
              </Stack>
            </Box>
          ) : (
            <Button size="small" startIcon={<AddIcon />} onClick={() => setShowAddOpt(true)} variant="outlined"
              sx={{ alignSelf: 'flex-start' }}>
              Add Option Group
            </Button>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function ShopMenuManagePage() {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [savingId, setSavingId] = useState(null)
  const [editModel, setEditModel] = useState(null)
  const [filter, setFilter] = useState('all')      // all | on | off
  const [catFilter, setCatFilter] = useState('')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    fetchModels()
      .then(list => { setModels(list); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  const categories = useMemo(() => {
    const set = new Set(models.map(m => m.category).filter(Boolean))
    return [...set].sort()
  }, [models])

  const visible = useMemo(() => {
    return models.filter(m => {
      const onMenu = Boolean(m.sellingPrice) && m.isActive !== false
      if (filter === 'on' && !onMenu) return false
      if (filter === 'off' && onMenu) return false
      if (catFilter && m.category !== catFilter) return false
      if (search && !m.modelName.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [models, filter, catFilter, search])

  const handleToggle = async (model) => {
    const onMenu = Boolean(model.sellingPrice) && model.isActive !== false
    setSavingId(model.id)
    try {
      const updated = await updateModel(model.id, { ...model, isActive: !onMenu })
      setModels(prev => prev.map(m => m.id === model.id ? { ...m, ...updated } : m))
    } catch (e) {
      setError(e.message)
    } finally {
      setSavingId(null)
    }
  }

  const handleSave = async (id, payload) => {
    const updated = await updateModel(id, payload)
    setModels(prev => prev.map(m => m.id === id ? { ...m, ...updated } : m))
  }

  const onCount = models.filter(m => Boolean(m.sellingPrice) && m.isActive !== false).length
  const offCount = models.length - onCount

  return (
    <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <RestaurantMenuIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>Menu Setup</Typography>
        <Chip label={`${onCount} on menu`} size="small" color="primary" variant="outlined" sx={{ ml: 1 }} />
        <Chip label={`${offCount} off`} size="small" variant="outlined" />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Filter bar */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mb: 2, alignItems: 'center' }}>
        <TextField
          size="small"
          placeholder="Search items..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 200 }}
        />
        <ToggleButtonGroup value={filter} exclusive onChange={(_, v) => v && setFilter(v)} size="small">
          <ToggleButton value="all">All ({models.length})</ToggleButton>
          <ToggleButton value="on">On Menu ({onCount})</ToggleButton>
          <ToggleButton value="off">Off Menu ({offCount})</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Category chips */}
      {categories.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2 }}>
          <Chip label="All categories" size="small"
            variant={catFilter === '' ? 'filled' : 'outlined'} color={catFilter === '' ? 'primary' : 'default'}
            onClick={() => setCatFilter('')} />
          {categories.map(cat => (
            <Chip key={cat} label={cat} size="small"
              variant={catFilter === cat ? 'filled' : 'outlined'} color={catFilter === cat ? 'primary' : 'default'}
              onClick={() => setCatFilter(c => c === cat ? '' : cat)} />
          ))}
        </Box>
      )}

      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Box sx={{ textAlign: 'center', py: 6 }}><CircularProgress /></Box>
      ) : visible.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
          <RestaurantMenuIcon sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
          <Typography>No items match the current filter.</Typography>
        </Box>
      ) : (
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: 2,
        }}>
          {visible.map(m => (
            <ModelCard
              key={m.id}
              model={m}
              onEdit={setEditModel}
              onToggle={handleToggle}
              saving={savingId === m.id}
            />
          ))}
        </Box>
      )}

      <EditDialog
        open={Boolean(editModel)}
        model={editModel}
        onClose={() => setEditModel(null)}
        onSave={handleSave}
      />
    </Box>
  )
}
