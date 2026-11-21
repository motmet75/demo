import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Checkbox, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper,
  Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'
import {
  fetchPortalArticles, fetchPortalProducts, fetchPortalTenants,
  savePortalArticle, savePortalProduct
} from '../../api/portalContentApi'

const emptyArticle = {
  title: '', articleLink: '', category: 'blog', subCategory: '', language: 'vi',
  keywords: '', thumbnailUrl: '', description: '', content: '', template: 'blog-single.html',
  visible: true, approved: false, locked: false,
}
const emptyProduct = {
  name: '', code: '', catalog: '', subCatalog: '', brand: '', status: 'available',
  shortDescription: '', longDescription: '', imageUrl: '', imageDescriptionUrl: '', videoUrl: '',
  price: 0, discount: 0, currency: 'VND', language: 'vi', path: '', group: '',
  visible: true, approved: false, locked: false, newProduct: false,
}

const date = value => value ? new Date(value).toLocaleString('vi-VN') : '—'

// Distinct non-empty, non-placeholder values already used in this tenant's
// rows, so category/catalog/brand become pick-from-existing (freeSolo keeps
// typing a new one possible) instead of free text prone to typos/duplicates.
const PLACEHOLDER_VALUES = new Set(['', 'none'])
function distinctValues(rows, field) {
  const seen = new Set()
  for (const row of rows) {
    const value = String(row?.[field] ?? '').trim()
    if (!PLACEHOLDER_VALUES.has(value)) seen.add(value)
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

function PickField({ label, value, options, onChange, fullWidth = true }) {
  return <Autocomplete
    freeSolo fullWidth={fullWidth} options={options} value={value || ''}
    onChange={(_, next) => onChange(next || '')}
    onInputChange={(_, next, reason) => { if (reason === 'input') onChange(next) }}
    renderInput={params => <TextField {...params} label={label} />}
  />
}

// `group` is stored as one comma-separated string column (no real multi-group
// table, see PortalContentService). Splitting into individual tags here is
// purely a UI convenience -- the join/split must stay symmetric.
const splitTags = value => String(value || '').split(',').map(part => part.trim()).filter(Boolean)
const joinTags = tags => tags.map(tag => String(tag || '').trim()).filter(Boolean).join(', ')
function distinctTagValues(rows, field) {
  const seen = new Set()
  for (const row of rows) {
    for (const tag of splitTags(row?.[field])) {
      if (!PLACEHOLDER_VALUES.has(tag)) seen.add(tag)
    }
  }
  return Array.from(seen).sort((a, b) => a.localeCompare(b))
}

function MultiPickField({ label, value, options, onChange, fullWidth = true }) {
  return <Autocomplete
    multiple freeSolo fullWidth={fullWidth} options={options} value={splitTags(value)}
    onChange={(_, next) => onChange(joinTags(next))}
    renderInput={params => <TextField {...params} label={label} />}
  />
}

function joinParts(parts) {
  return parts.map(p => String(p || '').trim()).filter(p => p && p !== 'none').join(' - ')
}

// ASCII slug, Vietnamese-aware: NFD strips combining accents, but 'đ'/'Đ'
// don't decompose that way so they're replaced explicitly first.
function slugify(text) {
  return String(text || '').trim().toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Smallest "-2", "-3"... suffix not already present in any of the given sets,
// so a generated code/link never collides with what's already on this page.
function uniqueSlug(base, existingSets) {
  let candidate = base || 'item'
  let n = 1
  while (existingSets.some(set => set.has(candidate))) {
    n += 1
    candidate = `${base}-${n}`
  }
  return candidate
}

function lastPathSegment(path) {
  return String(path || '').split('/').filter(Boolean).pop() || ''
}

// Remember the taxonomy picked last time (per tenant, per tab) so a new
// article/product starts from what staff usually pick instead of blank --
// identifying fields (title/name/code/link/content) are never remembered.
const LAST_DEFAULTS_FIELDS = {
  article: ['category', 'subCategory', 'language', 'template'],
  product: ['catalog', 'subCatalog', 'brand', 'group', 'language', 'currency', 'status'],
}
function lastDefaultsKey(kind, tenant) {
  return `bom.portalContent.lastDefaults.${kind}.${tenant || ''}`
}
function loadLastDefaults(kind, tenant) {
  try {
    const raw = localStorage.getItem(lastDefaultsKey(kind, tenant))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function saveLastDefaults(kind, tenant, draft) {
  try {
    const picked = {}
    LAST_DEFAULTS_FIELDS[kind].forEach(field => { if (draft[field] !== undefined) picked[field] = draft[field] })
    localStorage.setItem(lastDefaultsKey(kind, tenant), JSON.stringify(picked))
  } catch { /* storage unavailable */ }
}

function Flags({ value, onChange, product = false }) {
  const set = key => event => onChange({ ...value, [key]: event.target.checked })
  return <Stack direction="row" useFlexGap flexWrap="wrap">
    <FormControlLabel control={<Checkbox checked={Boolean(value.visible)} onChange={set('visible')} />} label="Visible" />
    <FormControlLabel control={<Checkbox checked={Boolean(value.approved)} onChange={set('approved')} />} label="Approved" />
    <FormControlLabel control={<Checkbox checked={Boolean(value.locked)} onChange={set('locked')} />} label="Locked" />
    {product && <FormControlLabel control={<Checkbox checked={Boolean(value.newProduct)} onChange={set('newProduct')} />} label="New product" />}
  </Stack>
}

function ArticleEditor({ open, value, onChange, onClose, onSave, saving, rows }) {
  const set = key => event => onChange({ ...value, [key]: event.target.value })
  const setField = key => next => onChange({ ...value, [key]: next })
  const categoryOptions = useMemo(() => distinctValues(rows, 'category'), [rows])
  const subCategoryOptions = useMemo(() => distinctValues(rows, 'subCategory'), [rows])
  const existingLinkSlugs = useMemo(() =>
    new Set(rows.filter(r => r.id !== value.id).map(r => lastPathSegment(r.articleLink))), [rows, value.id])
  const autoFillTitle = () => onChange({ ...value, title: joinParts([value.category, value.subCategory]) || value.title })
  const autoFillLink = () => {
    const slug = uniqueSlug(slugify(value.title) || 'bai-viet', [existingLinkSlugs])
    onChange({ ...value, articleLink: '/tin-tuc/' + slug })
  }
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>{value.id ? `Edit article #${value.id}` : 'New article'}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth required label="Title" value={value.title || ''} onChange={set('title')} />
        <Button startIcon={<AutoFixHighIcon />} onClick={autoFillTitle}
          disabled={!value.category && !value.subCategory} sx={{ whiteSpace: 'nowrap' }}>
          Auto-fill title
        </Button>
        <TextField fullWidth required label="Article link" value={value.articleLink || ''} onChange={set('articleLink')} placeholder="/tin-tuc/bai-viet" />
        <Button startIcon={<AutoFixHighIcon />} onClick={autoFillLink} disabled={!value.title} sx={{ whiteSpace: 'nowrap' }}>
          Auto-fill link
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <PickField label="Category" value={value.category} options={categoryOptions} onChange={setField('category')} />
        <PickField label="Subcategory" value={value.subCategory} options={subCategoryOptions} onChange={setField('subCategory')} />
        <TextField fullWidth label="Language" value={value.language || ''} onChange={set('language')} />
        <TextField fullWidth label="Template" value={value.template || ''} onChange={set('template')} />
      </Stack>
      <TextField fullWidth label="Keywords" value={value.keywords || ''} onChange={set('keywords')} />
      <TextField fullWidth label="Thumbnail URL" value={value.thumbnailUrl || ''} onChange={set('thumbnailUrl')} />
      <TextField fullWidth multiline minRows={2} label="Description" value={value.description || ''} onChange={set('description')} />
      <TextField fullWidth multiline minRows={10} label="HTML content" value={value.content || ''} onChange={set('content')} />
      <Flags value={value} onChange={onChange} />
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="contained" startIcon={<SaveIcon />} onClick={onSave} disabled={saving || !value.title?.trim() || !value.articleLink?.trim()}>{saving ? 'Saving…' : 'Save article'}</Button></DialogActions>
  </Dialog>
}

function ProductEditor({ open, value, onChange, onClose, onSave, saving, rows }) {
  const set = key => event => onChange({ ...value, [key]: event.target.value })
  const setField = key => next => onChange({ ...value, [key]: next })
  const number = key => event => onChange({ ...value, [key]: Number(event.target.value) || 0 })
  const catalogOptions = useMemo(() => distinctValues(rows, 'catalog'), [rows])
  const subCatalogOptions = useMemo(() => distinctValues(rows, 'subCatalog'), [rows])
  const brandOptions = useMemo(() => distinctValues(rows, 'brand'), [rows])
  const groupOptions = useMemo(() => distinctTagValues(rows, 'group'), [rows])
  const existingCodeSlugs = useMemo(() =>
    new Set(rows.filter(r => r.id !== value.id).map(r => slugify(r.code))), [rows, value.id])
  const existingPathSlugs = useMemo(() =>
    new Set(rows.filter(r => r.id !== value.id).map(r => lastPathSegment(r.path))), [rows, value.id])
  const autoFillName = () => onChange({ ...value, name: joinParts([value.brand, value.catalog, value.subCatalog]) || value.name })
  const autoFillCodeAndLink = () => {
    const slug = uniqueSlug(slugify(value.name) || 'san-pham', [existingCodeSlugs, existingPathSlugs])
    onChange({ ...value, code: slug.toUpperCase(), path: '/san-pham/' + slug })
  }
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>{value.id ? `Edit product #${value.id}` : 'New product'}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth required label="Product name" value={value.name || ''} onChange={set('name')} />
        <Button startIcon={<AutoFixHighIcon />} onClick={autoFillName}
          disabled={!value.brand && !value.catalog && !value.subCatalog} sx={{ whiteSpace: 'nowrap' }}>
          Auto-fill name
        </Button>
        <TextField fullWidth required label="Product code" value={value.code || ''} onChange={set('code')} />
        <TextField fullWidth required label="Path" value={value.path || ''} onChange={set('path')} placeholder="/san-pham/mi-gia-truyen" />
        <Button startIcon={<AutoFixHighIcon />} onClick={autoFillCodeAndLink} disabled={!value.name} sx={{ whiteSpace: 'nowrap' }}>
          Auto-fill code &amp; link
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <PickField label="Catalog" value={value.catalog} options={catalogOptions} onChange={setField('catalog')} />
        <PickField label="Subcatalog" value={value.subCatalog} options={subCatalogOptions} onChange={setField('subCatalog')} />
        <PickField label="Brand" value={value.brand} options={brandOptions} onChange={setField('brand')} />
        <MultiPickField label="Group" value={value.group} options={groupOptions} onChange={setField('group')} />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth type="number" label="Price" value={value.price ?? 0} onChange={number('price')} />
        <TextField fullWidth type="number" label="Discount %" value={value.discount ?? 0} onChange={number('discount')} inputProps={{ min: 0, max: 100 }} />
        <TextField fullWidth label="Currency" value={value.currency || ''} onChange={set('currency')} />
        <TextField fullWidth label="Language" value={value.language || ''} onChange={set('language')} />
        <TextField fullWidth label="Status" value={value.status || ''} onChange={set('status')} />
      </Stack>
      <TextField fullWidth label="Image URL" value={value.imageUrl || ''} onChange={set('imageUrl')} />
      <TextField fullWidth label="Description image URL" value={value.imageDescriptionUrl || ''} onChange={set('imageDescriptionUrl')} />
      <TextField fullWidth label="Video URL" value={value.videoUrl || ''} onChange={set('videoUrl')} />
      <TextField fullWidth multiline minRows={2} label="Short description" value={value.shortDescription || ''} onChange={set('shortDescription')} />
      <TextField fullWidth multiline minRows={8} label="Long description / HTML" value={value.longDescription || ''} onChange={set('longDescription')} />
      <Flags value={value} onChange={onChange} product />
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="contained" startIcon={<SaveIcon />} onClick={onSave} disabled={saving || !value.name?.trim() || !value.code?.trim() || !value.path?.trim()}>{saving ? 'Saving…' : 'Save product'}</Button></DialogActions>
  </Dialog>
}

export default function PortalContentPage() {
  const [tenants, setTenants] = useState([])
  const [tenant, setTenant] = useState('')
  const [tab, setTab] = useState(0)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState(null)

  const loadTenants = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await fetchPortalTenants()
      setTenants(Array.isArray(result) ? result : [])
      const selected = result?.includes('migiatruyen.vn') ? 'migiatruyen.vn' : result?.[0] || ''
      setTenant(selected)
      setRows(selected ? await fetchPortalArticles(selected, '') : [])
    } catch (e) { setError(e.message || 'Cannot load Portal tenants') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(loadTenants, 0)
    return () => window.clearTimeout(timer)
  }, [loadTenants])

  const loadRows = useCallback(async (selectedTenant = tenant, selectedTab = tab, query = search) => {
    if (!selectedTenant) { setRows([]); return }
    setLoading(true); setError(''); setNotice('')
    try {
      const result = selectedTab === 0
        ? await fetchPortalArticles(selectedTenant, query)
        : await fetchPortalProducts(selectedTenant, query)
      setRows(Array.isArray(result) ? result : [])
    } catch (e) { setError(e.message || 'Cannot load Portal content'); setRows([]) }
    finally { setLoading(false) }
  }, [tenant, tab, search])

  const switchTenant = event => {
    const value = event.target.value
    setTenant(value); setSearch(''); setRows([]); setDraft(null)
    loadRows(value, tab, '')
  }
  const switchTab = (_, value) => {
    setTab(value); setSearch(''); setRows([]); setDraft(null)
    loadRows(tenant, value, '')
  }
  const TAXONOMY_FIELDS = ['category', 'subCategory', 'catalog', 'subCatalog', 'brand', 'group']
  const edit = row => {
    const normalized = { ...row }
    TAXONOMY_FIELDS.forEach(field => { if (normalized[field] === 'none') normalized[field] = '' })
    setDraft(normalized)
  }
  const create = () => {
    const kind = tab === 0 ? 'article' : 'product'
    setDraft({ ...(tab === 0 ? emptyArticle : emptyProduct), ...loadLastDefaults(kind, tenant) })
  }
  const save = async () => {
    if (!tenant || !draft) return
    setSaving(true); setError(''); setNotice('')
    try {
      const kind = tab === 0 ? 'article' : 'product'
      if (tab === 0) await savePortalArticle(tenant, draft)
      else await savePortalProduct(tenant, draft)
      saveLastDefaults(kind, tenant, draft)
      setDraft(null); setNotice(`${tab === 0 ? 'Article' : 'Product'} saved in ${tenant}.`)
      await loadRows(tenant, tab, search)
    } catch (e) { setError(e.message || 'Cannot save Portal content') }
    finally { setSaving(false) }
  }

  const title = tab === 0 ? 'Articles' : 'Products'
  const visibleRows = useMemo(() => rows, [rows])

  return <Box sx={{ p: { xs: 1, md: 3 } }}>
    <Typography variant="h4" fontWeight={800}>Website Content</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Manage Portal articletb and producttb in the selected website database.</Typography>
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
    {!loading && tenants.length === 0 && <Alert severity="info" sx={{ mb: 2 }}>No website tenant is assigned to this admin. Ask a Super Admin to set the tenant&apos;s Portal Website Tenant value.</Alert>}
    <Alert severity="warning" sx={{ mb: 2 }}>This page writes directly to the selected Portal tenant database. Confirm the domain before saving.</Alert>

    <Card><CardContent>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
        <TextField select label="Website tenant" value={tenant} onChange={switchTenant} sx={{ minWidth: 280 }} disabled={loading && !tenants.length}>
          {tenants.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
        </TextField>
        <TextField label={`Search ${title.toLowerCase()}`} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => event.key === 'Enter' && loadRows()} sx={{ flex: 1 }} />
        <Button startIcon={<RefreshIcon />} onClick={() => loadRows()} disabled={!tenant || loading}>Load</Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={create} disabled={!tenant}>New {tab === 0 ? 'article' : 'product'}</Button>
      </Stack>
      <Tabs value={tab} onChange={switchTab} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Articles" /><Tab label="Products" />
      </Tabs>
      {tenant && <Typography variant="body2" sx={{ mb: 1 }}>Database: <strong>{tenant}</strong> · {visibleRows.length} {title.toLowerCase()}</Typography>}
      {loading ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box> :
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '65vh' }}><Table stickyHeader size="small">
          <TableHead><TableRow>
            <TableCell width={70}>ID</TableCell><TableCell>{tab === 0 ? 'Title' : 'Product'}</TableCell>
            <TableCell>{tab === 0 ? 'Link' : 'Code'}</TableCell><TableCell>{tab === 0 ? 'Category' : 'Catalog'}</TableCell>
            {tab === 1 && <TableCell align="right">Price</TableCell>}<TableCell>Status</TableCell><TableCell>Modified</TableCell><TableCell width={80} />
          </TableRow></TableHead>
          <TableBody>{visibleRows.map(row => <TableRow key={row.id} hover>
            <TableCell>{row.id}</TableCell><TableCell sx={{ fontWeight: 700 }}>{tab === 0 ? row.title : row.name}</TableCell>
            <TableCell>{tab === 0 ? row.articleLink : row.code}</TableCell><TableCell>{tab === 0 ? row.category : row.catalog}</TableCell>
            {tab === 1 && <TableCell align="right">{Number(row.price || 0).toLocaleString('vi-VN')} {row.currency}</TableCell>}
            <TableCell>{row.approved ? 'Approved' : 'Draft'}{row.visible ? '' : ' · Hidden'}{row.locked ? ' · Locked' : ''}</TableCell>
            <TableCell>{date(row.modifiedTime)}</TableCell><TableCell><Button size="small" startIcon={<EditIcon />} onClick={() => edit(row)}>Edit</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
    </CardContent></Card>
    <ArticleEditor open={tab === 0 && Boolean(draft)} value={draft || emptyArticle} onChange={setDraft} onClose={() => setDraft(null)} onSave={save} saving={saving} rows={tab === 0 ? rows : []} />
    <ProductEditor open={tab === 1 && Boolean(draft)} value={draft || emptyProduct} onChange={setDraft} onClose={() => setDraft(null)} onSave={save} saving={saving} rows={tab === 1 ? rows : []} />
  </Box>
}
