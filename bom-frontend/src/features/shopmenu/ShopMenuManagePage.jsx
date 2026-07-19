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
import TranslateIcon from '@mui/icons-material/Translate'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Autocomplete from '@mui/material/Autocomplete'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { fetchModels, updateModel, createModel } from '../../api/modelApi'
import { fetchMenuOptions, createMenuOption, updateMenuOption, deleteMenuOption, translateMenuItem } from '../../api/shopApi'
import { MENU_TRANSLATION_LANGUAGES, compactTranslations, parseJsonObject, stringifyTranslations } from '../../i18n/menuLocalization'
import { getLanguageMeta } from '../../i18n/translations'

const fmt = (n) => n != null ? Number(n).toLocaleString('vi-VN') + ' đ' : ''

function ModelCard({ model, onEdit, onClone, onToggle, saving }) {
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
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Edit menu settings">
            <Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(model)}>Edit</Button>
          </Tooltip>
          <Tooltip title="Clone as special / coupon">
            <IconButton size="small" onClick={() => onClone(model)} sx={{ color: '#7c3aed' }}>
              <ContentCopyIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        </Box>
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

// ── Clone dialog ────────────────────────────────────────────────────────────

const CLONE_TYPES = [
  { value: 'special', label: 'Special Menu', suffix: ' (Special)', catPrefix: 'Special', color: '#7c3aed' },
  { value: 'coupon',  label: 'Coupon / Promo', suffix: ' (Coupon)',  catPrefix: 'Coupon',  color: '#db2777' },
  { value: 'custom',  label: 'Custom Copy',    suffix: ' (Copy)',    catPrefix: null,       color: '#0369a1' },
]

function CloneDialog({ open, source, onClose, onCreated }) {
  const [type,         setType]         = useState('special')
  const [name,         setName]         = useState('')
  const [price,        setPrice]        = useState('')
  const [copyOptions,  setCopyOptions]  = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')

  useEffect(() => {
    if (!open || !source) return
    setType('special')
    setName(source.modelName + CLONE_TYPES[0].suffix)
    setPrice(source.sellingPrice ?? '')
    setCopyOptions(true)
    setError('')
  }, [open, source?.id])

  const handleTypeChange = (val) => {
    const t = CLONE_TYPES.find(x => x.value === val) || CLONE_TYPES[0]
    setType(val)
    setName((source?.modelName || '') + t.suffix)
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const t = CLONE_TYPES.find(x => x.value === type)
      // generate a short unique code from source code
      const suffix = Date.now().toString(36).toUpperCase().slice(-4)
      const newCode = ((source.modelCode || 'ITEM') + '-' + type.slice(0,2).toUpperCase() + suffix).slice(0, 50)
      const newCategory = t.catPrefix
        ? t.catPrefix + (source.category ? ' · ' + source.category : '')
        : source.category || null

      const created = await createModel({
        modelCode: newCode,
        modelName: name.trim(),
        sellingPrice: price !== '' ? Number(price) : null,
        category: newCategory,
        imageUrl: source.imageUrl || null,
        allowedSideIds: source.allowedSideIds || null,
        isActive: true,
      })

      if (copyOptions) {
        try {
          const { data: opts } = await fetchMenuOptions(source.id)
          if (Array.isArray(opts)) {
            await Promise.all(opts.map(opt => createMenuOption({
              modelId: created.id,
              groupName: opt.groupName,
              choices: opt.choices,
              required: opt.required,
              multiSelect: opt.multiSelect,
              isFree: opt.isFree,
              defaultValue: opt.defaultValue,
              displayOrder: opt.displayOrder,
            })))
          }
        } catch { /* options copy failure is non-fatal */ }
      }

      onCreated(created)
      onClose()
    } catch (e) {
      setError(e.message || 'Clone failed')
    } finally {
      setSaving(false)
    }
  }

  if (!source) return null
  const selectedType = CLONE_TYPES.find(x => x.value === type)

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ContentCopyIcon sx={{ color: selectedType?.color, fontSize: 20 }} />
          <Typography fontWeight={700}>Clone: {source.modelName}</Typography>
        </Box>
        <Typography variant="caption" color="text.secondary">Creates an independent copy you can customise</Typography>
      </DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Stack spacing={2} sx={{ mt: 0.5 }}>

          {/* Type selector */}
          <Box>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.75, display: 'block' }}>
              Clone type
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {CLONE_TYPES.map(t => (
                <Chip
                  key={t.value}
                  label={t.label}
                  onClick={() => handleTypeChange(t.value)}
                  variant={type === t.value ? 'filled' : 'outlined'}
                  sx={{
                    fontWeight: 700, cursor: 'pointer',
                    ...(type === t.value ? { bgcolor: t.color, color: '#fff', borderColor: t.color } : { borderColor: t.color, color: t.color }),
                  }}
                />
              ))}
            </Box>
          </Box>

          <TextField
            label="Name for the clone"
            size="small" fullWidth
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />

          <TextField
            label="Selling price"
            type="number" size="small" fullWidth
            value={price}
            onChange={e => setPrice(e.target.value)}
            InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
            helperText={source.sellingPrice ? `Original: ${fmt(source.sellingPrice)}` : 'Original has no price'}
          />

          <FormControlLabel
            control={<Checkbox checked={copyOptions} onChange={e => setCopyOptions(e.target.checked)} size="small" />}
            label={<Typography variant="body2">Also copy option groups (sugar level, ice, etc.)</Typography>}
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" onClick={handleSave} disabled={saving || !name.trim()}
          sx={{ bgcolor: selectedType?.color, '&:hover': { bgcolor: selectedType?.color, filter: 'brightness(0.9)' } }}
        >
          {saving ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : 'Clone'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Edit dialog ─────────────────────────────────────────────────────────────

const EMPTY_FORM   = { sellingPrice: '', category: '', imageUrl: '', allowedSideIds: [], modelNameTranslations: {}, categoryTranslations: {} }
const EMPTY_CHOICE = { label: '', price: '', modelId: null, labelTranslations: {} }
const EMPTY_OPT    = { groupName: '', groupNameTranslations: {}, choiceRows: [{ ...EMPTY_CHOICE }], required: false, multiSelect: false, isFree: false, defaultValue: '' }

function parseChoices(str) {
  if (!str) return []
  try {
    const parsed = JSON.parse(str)
    if (Array.isArray(parsed)) {
      return parsed.map(c => (typeof c === 'object' && c.label != null ? c : { label: String(c), price: 0 }))
    }
    return []
  } catch { return str.split(',').map(s => ({ label: s.trim(), price: 0 })).filter(c => c.label) }
}


function translationLabel(language) {
  const meta = getLanguageMeta(language)
  return `${meta.nativeLabel} (${language.toUpperCase()})`
}

const TRANSLATION_SOURCE_LANGUAGES = ['en', ...MENU_TRANSLATION_LANGUAGES]
const translationLanguageOptions = TRANSLATION_SOURCE_LANGUAGES.map(language => ({ language, label: translationLabel(language) }))
const translationTargetOptions = MENU_TRANSLATION_LANGUAGES.map(language => ({ language, label: translationLabel(language) }))

function TranslationFields({ label, values, onChange }) {
  const [open, setOpen] = useState(false)
  const normalizedValues = values || {}
  const configuredLanguages = MENU_TRANSLATION_LANGUAGES.filter(language => String(normalizedValues?.[language] || '').trim())
  const previewLanguages = configuredLanguages.slice(0, 3)
  const hiddenCount = Math.max(0, configuredLanguages.length - previewLanguages.length)

  return (
    <Box sx={{ border: '1px solid #e5e7eb', borderRadius: 1.5, p: 1, bgcolor: '#fafafa' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block' }}>
            {label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
            {previewLanguages.length ? previewLanguages.map(language => (
              <Chip
                key={language}
                label={translationLabel(language)}
                size="small"
                variant="outlined"
                sx={{ height: 20, fontSize: 10, maxWidth: 160 }}
              />
            )) : (
              <Typography variant="caption" color="text.disabled">No translations configured</Typography>
            )}
            {hiddenCount > 0 && <Chip label={`+${hiddenCount}`} size="small" sx={{ height: 20, fontSize: 10 }} />}
          </Box>
        </Box>
        <Button
          size="small"
          variant="outlined"
          startIcon={<TranslateIcon />}
          onClick={() => setOpen(true)}
          sx={{ textTransform: 'none', flexShrink: 0 }}
        >
          Translations{configuredLanguages.length ? ` (${configuredLanguages.length})` : ''}
        </Button>
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography fontWeight={800}>{label}</Typography>
          <Typography variant="caption" color="text.secondary">
            Fill only the languages this menu item needs. Empty values fall back to the original text.
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ mt: 1 }}>
            {MENU_TRANSLATION_LANGUAGES.map(language => (
              <TextField
                key={language}
                size="small"
                label={translationLabel(language)}
                value={normalizedValues?.[language] || ''}
                onChange={event => onChange(language, event.target.value)}
                fullWidth
              />
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Done</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
function fmtChoicePrice(price, isFree) {
  if (isFree || !price) return ''
  return ` +${Number(price).toLocaleString('vi-VN')}đ`
}

function fmtChoiceSummary(choice, isFree) {
  const price = fmtChoicePrice(choice.price, isFree)
  const bom   = choice.modelId ? ' 🔗' : ''
  return `${choice.label}${price}${bom}`
}

function EditDialog({ open, model, models, onClose, onSave, onTranslated }) {
  const [form, setForm]           = useState(EMPTY_FORM)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [options, setOptions]     = useState([])
  const [optLoading, setOptLoading] = useState(false)
  const [showAddOpt, setShowAddOpt] = useState(false)
  const [newOpt, setNewOpt]       = useState(EMPTY_OPT)
  const [optSaving, setOptSaving] = useState(false)
  const [translationSource, setTranslationSource] = useState('en')
  const [translationTargets, setTranslationTargets] = useState(MENU_TRANSLATION_LANGUAGES)
  const [translating, setTranslating] = useState(false)
  const [translationNotice, setTranslationNotice] = useState('')

  useEffect(() => {
    if (!open || !model) return
    let parsedSideIds = []
    try { parsedSideIds = model.allowedSideIds ? JSON.parse(model.allowedSideIds) : [] } catch { parsedSideIds = [] }
    setForm({
      sellingPrice: model.sellingPrice ?? '',
      category: model.category ?? '',
      imageUrl: model.imageUrl ?? '',
      allowedSideIds: parsedSideIds,
      modelNameTranslations: parseJsonObject(model.modelNameTranslations),
      categoryTranslations: parseJsonObject(model.categoryTranslations),
    })
    setError(''); setOptions([]); setShowAddOpt(false); setNewOpt(EMPTY_OPT)
    setTranslationSource('en'); setTranslationTargets(MENU_TRANSLATION_LANGUAGES); setTranslationNotice('')
    setOptLoading(true)
    fetchMenuOptions(model.id)
      .then(({ data }) => setOptions(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setOptLoading(false))
  }, [open, model?.id])

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))
  const setTranslation = (field) => (language, value) => setForm(f => ({
    ...f,
    [field]: { ...(f[field] || {}), [language]: value },
  }))
  const setOpt = (field) => (e) => setNewOpt(f => ({ ...f, [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setNewOptTranslation = (language, value) => setNewOpt(f => ({
    ...f,
    groupNameTranslations: { ...(f.groupNameTranslations || {}), [language]: value },
  }))

  const selectedSourceOption = translationLanguageOptions.find(option => option.language === translationSource) || translationLanguageOptions[0]
  const availableTargetOptions = translationTargetOptions.filter(option => option.language !== translationSource)
  const selectedTargetOptions = availableTargetOptions.filter(option => translationTargets.includes(option.language))

  const handleQuickTranslate = async () => {
    const targets = translationTargets.filter(language => language !== translationSource)
    if (!targets.length) { setError('Select at least one target language'); return }
    setTranslating(true); setError(''); setTranslationNotice('')
    try {
      const { res, data } = await translateMenuItem(model.id, { sourceLanguage: translationSource, targetLanguages: targets })
      if (!res.ok) throw new Error((typeof data === 'string' ? data : data?.message || data?.error) || 'Translation failed')
      if (data?.model) {
        setForm(f => ({
          ...f,
          modelNameTranslations: parseJsonObject(data.model.modelNameTranslations),
          categoryTranslations: parseJsonObject(data.model.categoryTranslations),
        }))
        onTranslated?.(data.model)
      }
      if (Array.isArray(data?.options)) setOptions(data.options)
      const completed = Array.isArray(data?.translatedLanguages) && data.translatedLanguages.length ? data.translatedLanguages : targets
      setTranslationNotice(`Translated to ${completed.map(translationLabel).join(', ')}`)
    } catch (e) {
      setError(e.message || 'Translation failed')
    } finally {
      setTranslating(false)
    }
  }

  const handleSave = async () => {
    setSaving(true); setError('')
    try {
      await onSave(model.id, {
        ...model,
        sellingPrice: form.sellingPrice !== '' ? Number(form.sellingPrice) : null,
        category: form.category || null,
        imageUrl: form.imageUrl || null,
        allowedSideIds: form.allowedSideIds.length ? JSON.stringify(form.allowedSideIds) : null,
        modelNameTranslations: stringifyTranslations(form.modelNameTranslations),
        categoryTranslations: stringifyTranslations(form.categoryTranslations),
      })
      onClose()
    } catch (e) {
      setError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const handleAddOption = async () => {
    const validRows = newOpt.choiceRows.filter(r => r.label.trim())
    if (!newOpt.groupName.trim() || !validRows.length) return
    setOptSaving(true)
    try {
      const body = {
        modelId: model.id,
        groupName: newOpt.groupName.trim(),
        groupNameTranslations: stringifyTranslations(newOpt.groupNameTranslations),
        choices: JSON.stringify(validRows.map(r => {
          const c = { label: r.label.trim(), price: Number(r.price) || 0 }
          if (r.modelId) c.modelId = r.modelId
          const labelTranslations = compactTranslations(r.labelTranslations)
          if (Object.keys(labelTranslations).length) c.labelTranslations = labelTranslations
          return c
        })),
        required: newOpt.required,
        multiSelect: newOpt.multiSelect,
        isFree: newOpt.isFree,
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

  const handleToggleIsFree = async (opt) => {
    const updated = { ...opt, isFree: !opt.isFree }
    try {
      await updateMenuOption(opt.id, updated)
      setOptions(prev => prev.map(o => o.id === opt.id ? updated : o))
    } catch (e) {
      setError(e.message || 'Failed to update option group')
    }
  }

  const updateOptionGroupTranslation = (optId, language, value) => {
    setOptions(prev => prev.map(opt => {
      if (opt.id !== optId) return opt
      const translations = { ...parseJsonObject(opt.groupNameTranslations), [language]: value }
      return { ...opt, groupNameTranslations: stringifyTranslations(translations) }
    }))
  }

  const updateOptionChoiceTranslation = (optId, choiceIndex, language, value) => {
    setOptions(prev => prev.map(opt => {
      if (opt.id !== optId) return opt
      const choices = parseChoices(opt.choices).map((choice, index) => {
        if (index !== choiceIndex) return choice
        const translations = { ...parseJsonObject(choice.labelTranslations), [language]: value }
        return { ...choice, labelTranslations: compactTranslations(translations) }
      })
      return { ...opt, choices: JSON.stringify(choices) }
    }))
  }

  const handleSaveOptionTranslations = async (opt) => {
    try {
      const normalizedChoices = parseChoices(opt.choices).map(choice => {
        const labelTranslations = compactTranslations(choice.labelTranslations)
        const next = { ...choice }
        if (Object.keys(labelTranslations).length) next.labelTranslations = labelTranslations
        else delete next.labelTranslations
        return next
      })
      const updated = {
        ...opt,
        groupNameTranslations: stringifyTranslations(parseJsonObject(opt.groupNameTranslations)),
        choices: JSON.stringify(normalizedChoices),
      }
      const { data } = await updateMenuOption(opt.id, updated)
      setOptions(prev => prev.map(o => o.id === opt.id ? data : o))
    } catch (e) {
      setError(e.message || 'Failed to save option translations')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
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
          <Box sx={{ border: '1px solid #dbeafe', borderRadius: 1.5, p: 1.25, bgcolor: '#f8fbff' }}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 1 }}>
              Quick translate menu item
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '180px 1fr auto' }, gap: 1, alignItems: 'start' }}>
              <Autocomplete
                size="small"
                disableClearable
                options={translationLanguageOptions}
                value={selectedSourceOption}
                getOptionLabel={option => option.label}
                isOptionEqualToValue={(a, b) => a.language === b.language}
                onChange={(_, option) => {
                  const next = option?.language || 'en'
                  setTranslationSource(next)
                  setTranslationTargets(prev => prev.filter(language => language !== next))
                }}
                renderInput={params => <TextField {...params} label="Source" size="small" />}
              />
              <Autocomplete
                multiple
                size="small"
                options={availableTargetOptions}
                value={selectedTargetOptions}
                getOptionLabel={option => option.label}
                isOptionEqualToValue={(a, b) => a.language === b.language}
                onChange={(_, value) => setTranslationTargets(value.map(option => option.language))}
                renderInput={params => <TextField {...params} label="Target languages" size="small" />}
              />
              <Button
                variant="contained"
                size="small"
                startIcon={translating ? <CircularProgress size={14} color="inherit" /> : <TranslateIcon />}
                onClick={handleQuickTranslate}
                disabled={translating || !translationTargets.some(language => language !== translationSource)}
                sx={{ textTransform: 'none', minHeight: 40 }}
              >
                Translate
              </Button>
            </Box>
            {translationNotice && <Alert severity="success" sx={{ mt: 1 }}>{translationNotice}</Alert>}
          </Box>
          <TranslationFields
            label="Customer item name translations"
            values={form.modelNameTranslations}
            onChange={setTranslation('modelNameTranslations')}
          />
          <TranslationFields
            label="Customer category translations"
            values={form.categoryTranslations}
            onChange={setTranslation('categoryTranslations')}
          />
          <TextField label="Image URL" size="small" fullWidth
            value={form.imageUrl} onChange={set('imageUrl')} placeholder="https://..." />
          {form.imageUrl && (
            <Box sx={{ borderRadius: 1, overflow: 'hidden', height: 120, background: '#f5f5f5' }}>
              <img src={form.imageUrl} alt="preview"
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { e.target.style.display = 'none' }} />
            </Box>
          )}

          <Autocomplete
            multiple
            options={(models || []).filter(x => x.id !== model?.id && x.sellingPrice != null)}
            getOptionLabel={x => x.modelName}
            value={(models || []).filter(x => (form.allowedSideIds || []).includes(x.id))}
            onChange={(_, v) => setForm(f => ({ ...f, allowedSideIds: v.map(x => x.id) }))}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={params => (
              <TextField {...params} label="Allowed side / topping items" size="small"
                helperText="Only these items will appear as side options when ordering. Leave empty to disable sides for this item." />
            )}
            noOptionsText="No menu items"
          />

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
                    display: 'flex', alignItems: 'flex-start', gap: 1, bgcolor: '#f9f9f9',
                    borderRadius: 1.5, px: 1.5, py: 0.75, border: '1px solid #eeeeee',
                  }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight={700}>{opt.groupName}</Typography>
                        {opt.required && <Chip label="required" size="small" color="error" sx={{ fontSize: 9, height: 16 }} />}
                        {opt.multiSelect && <Chip label="multi" size="small" variant="outlined" sx={{ fontSize: 9, height: 16 }} />}
                        <Tooltip title={opt.isFree ? 'All choices free — click to charge prices' : 'Click to mark all choices as free'}>
                          <Chip
                            label={opt.isFree ? 'Free' : 'Priced'}
                            size="small"
                            color={opt.isFree ? 'success' : 'default'}
                            variant={opt.isFree ? 'filled' : 'outlined'}
                            onClick={() => handleToggleIsFree(opt)}
                            sx={{ fontSize: 9, height: 16, cursor: 'pointer' }}
                          />
                        </Tooltip>
                      </Box>
                      <Typography variant="caption" color="text.secondary">
                        {choices.map(c => fmtChoiceSummary(c, opt.isFree)).join(' · ')}
                        {opt.defaultValue ? ` (default: ${opt.defaultValue})` : ''}
                      </Typography>
                      {choices.some(c => c.modelId) && (
                        <Typography variant="caption" sx={{ color: '#1976d2', fontSize: 10 }}>
                          🔗 = linked BOM model
                        </Typography>
                      )}
                      <Box sx={{ mt: 1, display: 'grid', gap: 1 }}>
                        <TranslationFields
                          label="Customer option group translations"
                          values={parseJsonObject(opt.groupNameTranslations)}
                          onChange={(language, value) => updateOptionGroupTranslation(opt.id, language, value)}
                        />
                        {choices.map((choice, choiceIndex) => (
                          <TranslationFields
                            key={`${opt.id}-${choice.label}-${choiceIndex}`}
                            label={`Choice translations: ${choice.label}`}
                            values={parseJsonObject(choice.labelTranslations)}
                            onChange={(language, value) => updateOptionChoiceTranslation(opt.id, choiceIndex, language, value)}
                          />
                        ))}
                        <Button size="small" variant="outlined" onClick={() => handleSaveOptionTranslations(opt)} sx={{ justifySelf: 'flex-start' }}>
                          Save option translations
                        </Button>
                      </Box>
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
                  placeholder="e.g. Toppings, Sugar, Ice" autoFocus />
                <TranslationFields
                  label="Customer option group translations"
                  values={newOpt.groupNameTranslations}
                  onChange={setNewOptTranslation}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>Choices</Typography>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: 10 }}>
                    — Link a BOM model to override inventory deduction per choice (e.g. Small/Medium/Large variants)
                  </Typography>
                </Box>
                {newOpt.choiceRows.map((row, idx) => {
                  const setRow = (patch) => setNewOpt(f => {
                    const rows = [...f.choiceRows]; rows[idx] = { ...rows[idx], ...patch }; return { ...f, choiceRows: rows }
                  })
                  const linkedModel = row.modelId ? (models || []).find(m => m.id === row.modelId) : null
                  return (
                    <Box key={idx} sx={{ border: '1px solid #e8e8e8', borderRadius: 1.5, p: 1, bgcolor: '#fafafa' }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.75 }}>
                        <TextField label="Choice label" size="small" sx={{ flex: 2 }}
                          value={row.label} onChange={e => setRow({ label: e.target.value })}
                          placeholder="e.g. Small / Medium / Large" />
                        <TextField label="Price add-on" size="small" type="number" sx={{ flex: 1 }}
                          value={row.price} onChange={e => setRow({ price: e.target.value })}
                          InputProps={{ endAdornment: <InputAdornment position="end">đ</InputAdornment> }}
                          placeholder="0" />
                        <IconButton size="small" color="error" disabled={newOpt.choiceRows.length <= 1}
                          onClick={() => setNewOpt(f => ({ ...f, choiceRows: f.choiceRows.filter((_, i) => i !== idx) }))}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <TranslationFields
                        label="Customer choice translations"
                        values={row.labelTranslations}
                        onChange={(language, value) => setRow({ labelTranslations: { ...(row.labelTranslations || {}), [language]: value } })}
                      />
                      <Autocomplete
                        size="small"
                        options={models || []}
                        getOptionLabel={m => `${m.modelName}${m.sellingPrice ? ' — ' + fmt(m.sellingPrice) : ''}`}
                        value={linkedModel || null}
                        onChange={(_, v) => setRow({ modelId: v ? v.id : null })}
                        isOptionEqualToValue={(a, b) => a.id === b.id}
                        renderInput={params => (
                          <TextField {...params} label="Link BOM model (optional)"
                            placeholder="Leave blank to use this item's own BOM"
                            size="small"
                            helperText={linkedModel ? `Uses BOM of "${linkedModel.modelName}"` : 'Uses this menu item\'s own BOM'}
                          />
                        )}
                        noOptionsText="No models"
                      />
                    </Box>
                  )
                })}
                <Button size="small" startIcon={<AddIcon />}
                  onClick={() => setNewOpt(f => ({ ...f, choiceRows: [...f.choiceRows, { ...EMPTY_CHOICE }] }))}>
                  Add choice
                </Button>

                <TextField label="Default value (optional)" size="small" fullWidth
                  value={newOpt.defaultValue} onChange={setOpt('defaultValue')} />
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <FormControlLabel
                    control={<Checkbox size="small" checked={newOpt.required} onChange={setOpt('required')} />}
                    label={<Typography variant="caption">Required</Typography>} />
                  <FormControlLabel
                    control={<Checkbox size="small" checked={newOpt.multiSelect} onChange={setOpt('multiSelect')} />}
                    label={<Typography variant="caption">Multi-select</Typography>} />
                  <FormControlLabel
                    control={<Checkbox size="small" checked={newOpt.isFree} onChange={setOpt('isFree')} />}
                    label={<Typography variant="caption">Always free (ignore prices)</Typography>} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button size="small" onClick={() => { setShowAddOpt(false); setNewOpt(EMPTY_OPT) }}>Cancel</Button>
                  <Button size="small" variant="contained" onClick={handleAddOption}
                    disabled={optSaving || !newOpt.groupName.trim() || !newOpt.choiceRows.some(r => r.label.trim())}>
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
  const [editModel,  setEditModel]  = useState(null)
  const [cloneSource, setCloneSource] = useState(null)
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

  const handleTranslated = (updated) => {
    if (!updated?.id) return
    setModels(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
  }

  const handleCloneCreated = (created) => {
    setModels(prev => [...prev, created])
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
              onClone={setCloneSource}
              onToggle={handleToggle}
              saving={savingId === m.id}
            />
          ))}
        </Box>
      )}

      <EditDialog
        open={Boolean(editModel)}
        model={editModel}
        models={models}
        onClose={() => setEditModel(null)}
        onSave={handleSave}
        onTranslated={handleTranslated}
      />

      <CloneDialog
        open={Boolean(cloneSource)}
        source={cloneSource}
        onClose={() => setCloneSource(null)}
        onCreated={handleCloneCreated}
      />
    </Box>
  )
}
