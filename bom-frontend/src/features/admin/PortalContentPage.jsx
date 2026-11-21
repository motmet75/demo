import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  Alert, Autocomplete, Avatar, Box, Button, Card, CardContent, Checkbox, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper,
  Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography
} from '@mui/material'
import HtmlEditor from '../../components/HtmlEditor'
import PortalMediaSchedulePanel from './PortalMediaSchedulePanel'
import AddIcon from '@mui/icons-material/Add'
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'
import {
  fetchPortalArticles, fetchPortalBrands, fetchPortalCatalogs, fetchPortalGroups, fetchPortalProducts, fetchPortalTenants,
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
  price: 0, discount: 0, currency: 'VND', language: 'vi', path: '', groupCodes: [],
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

// Group is a real many-to-many membership (ProductGroupItemTb, keyed by
// productCode -- see PortalContentService.groupCodesByProduct). Unlike
// catalog/brand (single pick), a product can be in several groups at once.
function MultiCodeNamePickField({ label, value, options, onChange, fullWidth = true }) {
  const codes = Array.isArray(value) ? value : []
  const selected = codes.map(code => options.find(o => o.code === code) || { code, name: `${code} (mã chưa rõ)` })
  return <Autocomplete
    multiple fullWidth={fullWidth} options={options}
    getOptionLabel={o => o?.name || ''}
    isOptionEqualToValue={(o, v) => o.code === v.code}
    value={selected}
    onChange={(_, next) => onChange(next.map(o => o.code))}
    renderInput={params => <TextField {...params} label={label} />}
  />
}

// Real reference entities (productBrandTB/productCatalogTB -- see
// PortalContentService) have a stable code and a display name; the product
// row stores the code. Strict pick-only (no freeSolo: you can't invent a
// brand/catalog here, that belongs in the proper admin screens), but a
// legacy/orphaned code not in the list is still shown rather than blanked.
function nameFor(list, code) {
  return list.find(o => o.code === code)?.name || code || ''
}
function CodeNamePickField({ label, value, options, onChange, fullWidth = true }) {
  const known = options.find(o => o.code === value)
  const allOptions = known || !value ? options : [...options, { code: value, name: `${value} (mã chưa rõ)` }]
  return <Autocomplete
    fullWidth={fullWidth} options={allOptions}
    getOptionLabel={o => o?.name || ''}
    isOptionEqualToValue={(o, v) => o.code === v.code}
    value={allOptions.find(o => o.code === value) || null}
    onChange={(_, next) => onChange(next?.code || '')}
    renderInput={params => <TextField {...params} label={label} />}
  />
}

// Fast visual pick: the 3 most relevant options as thumbnails (brand/catalog
// image when set, else a letter avatar), the currently selected one
// highlighted -- including whatever "remember last option" restored.
function QuickPickThumbnails({ options, value, onChange }) {
  const selected = options.find(o => o.code === value)
  const quick = selected && !options.slice(0, 3).some(o => o.code === value)
    ? [selected, ...options.filter(o => o.code !== value).slice(0, 2)]
    : options.slice(0, 3)
  if (!quick.length) return null
  return <Stack direction="row" spacing={1}>
    {quick.map(option => {
      const isSelected = option.code === value
      return <Tooltip key={option.code} title={option.name}>
        <Avatar
          onClick={() => onChange(isSelected ? '' : option.code)}
          src={option.imageUrl || undefined}
          sx={{
            cursor: 'pointer', width: 36, height: 36,
            border: isSelected ? '3px solid' : '1px solid',
            borderColor: isSelected ? 'primary.main' : 'divider',
          }}
        >
          {!option.imageUrl && option.name?.charAt(0)?.toUpperCase()}
        </Avatar>
      </Tooltip>
    })}
  </Stack>
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

// Matches legacy Portal's own generateUniqueProductCode: try the bare slug
// first, then "-1", "-2"... (ProductService.java) -- not "-2" first.
function uniqueSlug(base, existingSets) {
  let candidate = base || 'item'
  let n = 0
  while (existingSets.some(set => set.has(candidate))) {
    n += 1
    candidate = `${base}-${n}`
  }
  return candidate
}

function lastPathSegment(path) {
  return String(path || '').split('/').filter(Boolean).pop() || ''
}

function stripHtmlSuffix(path) {
  return String(path || '').replace(/\.html$/i, '')
}

// Remember the taxonomy picked last time (per tenant, per tab) so a new
// article/product starts from what staff usually pick instead of blank --
// identifying fields (title/name/code/link/content) are never remembered.
const LAST_DEFAULTS_FIELDS = {
  article: ['category', 'subCategory', 'language', 'template'],
  product: ['catalog', 'subCatalog', 'brand', 'groupCodes', 'language', 'currency', 'status'],
}
function lastDefaultsKey(kind, tenant) {
  return `bom_portalContent_lastDefaults_${kind}_${tenant || ''}`.replace(/[^A-Za-z0-9._-]/g, '_')
}
function readCookie(name) {
  const match = document.cookie.split('; ').find(part => part.startsWith(name + '='))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null
}
function writeCookie(name, value) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${365 * 86400}; SameSite=Lax`
}
function loadLastDefaults(kind, tenant) {
  try {
    const raw = readCookie(lastDefaultsKey(kind, tenant))
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}
function saveLastDefaults(kind, tenant, draft) {
  try {
    const picked = {}
    LAST_DEFAULTS_FIELDS[kind].forEach(field => { if (draft[field] !== undefined) picked[field] = draft[field] })
    writeCookie(lastDefaultsKey(kind, tenant), JSON.stringify(picked))
  } catch { /* cookies unavailable */ }
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
      <HtmlEditor label="HTML content" value={value.content} onChange={setField('content')} minHeight={260} />
      <Flags value={value} onChange={onChange} />
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="contained" startIcon={<SaveIcon />} onClick={onSave} disabled={saving || !value.title?.trim() || !value.articleLink?.trim()}>{saving ? 'Saving…' : 'Save article'}</Button></DialogActions>
  </Dialog>
}

function ProductEditor({ open, value, onChange, onClose, onSave, saving, rows, brands, catalogs, groups }) {
  const set = key => event => onChange({ ...value, [key]: event.target.value })
  const setField = key => next => onChange({ ...value, [key]: next })
  const number = key => event => onChange({ ...value, [key]: Number(event.target.value) || 0 })
  const subCatalogOptions = useMemo(() => distinctValues(rows, 'subCatalog'), [rows])
  const existingCodeSlugs = useMemo(() =>
    new Set(rows.filter(r => r.id !== value.id).map(r => slugify(r.code))), [rows, value.id])
  const existingPathSlugs = useMemo(() =>
    new Set(rows.filter(r => r.id !== value.id).map(r => stripHtmlSuffix(lastPathSegment(r.path)))), [rows, value.id])
  const autoFillName = () => onChange({
    ...value,
    name: joinParts([nameFor(brands, value.brand), nameFor(catalogs, value.catalog), value.subCatalog]) || value.name,
  })
  // Matches legacy Portal's own lazy-create flow exactly (AdminLazyCreateProductController):
  // productCode = slugify(productName); productLink = productCode + ".html".
  const autoFillCodeAndLink = () => {
    const code = uniqueSlug(slugify(value.name) || 'san-pham', [existingCodeSlugs, existingPathSlugs])
    onChange({ ...value, code, path: code + '.html' })
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
        <TextField fullWidth required label="Path" value={value.path || ''} onChange={set('path')} placeholder="mi-gia-truyen.html" />
        <Button startIcon={<AutoFixHighIcon />} onClick={autoFillCodeAndLink} disabled={!value.name} sx={{ whiteSpace: 'nowrap' }}>
          Auto-fill code &amp; link
        </Button>
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
        <CodeNamePickField label="Catalog" value={value.catalog} options={catalogs} onChange={setField('catalog')} />
        <QuickPickThumbnails options={catalogs} value={value.catalog} onChange={setField('catalog')} />
        <CodeNamePickField label="Brand" value={value.brand} options={brands} onChange={setField('brand')} />
        <QuickPickThumbnails options={brands} value={value.brand} onChange={setField('brand')} />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <PickField label="Subcatalog" value={value.subCatalog} options={subCatalogOptions} onChange={setField('subCatalog')} />
        <MultiCodeNamePickField label="Group" value={value.groupCodes} options={groups} onChange={setField('groupCodes')} />
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
      <HtmlEditor label="Long description / HTML" value={value.longDescription} onChange={setField('longDescription')} minHeight={200} />
      <Flags value={value} onChange={onChange} product />
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={saving}>Cancel</Button><Button variant="contained" startIcon={<SaveIcon />} onClick={onSave} disabled={saving || !value.name?.trim() || !value.code?.trim() || !value.path?.trim()}>{saving ? 'Saving…' : 'Save product'}</Button></DialogActions>
  </Dialog>
}

// Nav items (WEBSITE_GROUP in App.jsx) link to ?tab=products/media/articles.
// React Router doesn't remount on a query-string-only navigation, so a plain
// useState initializer would only catch the tab on first load -- clicking a
// nav link while already on this page needs the effect below too.
function tabFromQuery(search) {
  const value = new URLSearchParams(search).get('tab')
  return value === 'products' ? 1 : value === 'media' ? 2 : 0
}

export default function PortalContentPage() {
  const location = useLocation()
  const [tenants, setTenants] = useState([])
  const [tenant, setTenant] = useState('')
  const [tab, setTab] = useState(() => tabFromQuery(window.location.search))
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [brands, setBrands] = useState([])
  const [catalogs, setCatalogs] = useState([])
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [draft, setDraft] = useState(null)

  const loadBrandsAndCatalogs = useCallback(async (selectedTenant) => {
    if (!selectedTenant) { setBrands([]); setCatalogs([]); setGroups([]); return }
    try {
      const [brandList, catalogList, groupList] = await Promise.all([
        fetchPortalBrands(selectedTenant), fetchPortalCatalogs(selectedTenant), fetchPortalGroups(selectedTenant),
      ])
      setBrands(Array.isArray(brandList) ? brandList : [])
      setCatalogs(Array.isArray(catalogList) ? catalogList : [])
      setGroups(Array.isArray(groupList) ? groupList : [])
    } catch { setBrands([]); setCatalogs([]); setGroups([]) }
  }, [])

  const loadTenants = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const result = await fetchPortalTenants()
      setTenants(Array.isArray(result) ? result : [])
      const selected = result?.includes('migiatruyen.vn') ? 'migiatruyen.vn' : result?.[0] || ''
      setTenant(selected)
      setRows(selected ? await fetchPortalArticles(selected, '') : [])
      await loadBrandsAndCatalogs(selected)
    } catch (e) { setError(e.message || 'Cannot load Portal tenants') }
    finally { setLoading(false) }
  }, [loadBrandsAndCatalogs])

  useEffect(() => {
    const timer = window.setTimeout(loadTenants, 0)
    return () => window.clearTimeout(timer)
  }, [loadTenants])

  const loadRows = useCallback(async (selectedTenant = tenant, selectedTab = tab, query = search) => {
    if (!selectedTenant || selectedTab === 2) { setRows([]); return }
    setLoading(true); setError(''); setNotice('')
    try {
      const result = selectedTab === 0
        ? await fetchPortalArticles(selectedTenant, query)
        : await fetchPortalProducts(selectedTenant, query)
      setRows(Array.isArray(result) ? result : [])
    } catch (e) { setError(e.message || 'Cannot load Portal content'); setRows([]) }
    finally { setLoading(false) }
  }, [tenant, tab, search])

  // Only reacts to a nav-link click changing the URL while already on this
  // page (e.g. the sidebar's "Lịch đăng mạng xã hội" -> ?tab=media) --
  // switchTab/switchTenant below already load data for in-page clicks, and
  // the very first mount is already handled by loadTenants.
  const mountedRef = React.useRef(false)
  useEffect(() => {
    const next = tabFromQuery(location.search)
    if (!mountedRef.current) { mountedRef.current = true; return }
    setTab(current => {
      if (current === next) return current
      if (tenant) loadRows(tenant, next, '')
      return next
    })
  }, [location.search])

  const switchTenant = event => {
    const value = event.target.value
    setTenant(value); setSearch(''); setRows([]); setDraft(null)
    loadRows(value, tab, '')
    loadBrandsAndCatalogs(value)
  }
  const switchTab = (_, value) => {
    setTab(value); setSearch(''); setRows([]); setDraft(null)
    loadRows(tenant, value, '')
  }
  const TAXONOMY_FIELDS = ['category', 'subCategory', 'catalog', 'subCatalog', 'brand']
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

  const title = tab === 0 ? 'Articles' : tab === 1 ? 'Products' : 'Media schedule'
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
        {tab !== 2 && <TextField label={`Search ${title.toLowerCase()}`} value={search} onChange={event => setSearch(event.target.value)} onKeyDown={event => event.key === 'Enter' && loadRows()} sx={{ flex: 1 }} />}
        {tab !== 2 && <Button startIcon={<RefreshIcon />} onClick={() => loadRows()} disabled={!tenant || loading}>Load</Button>}
        {tab !== 2 && <Button variant="contained" startIcon={<AddIcon />} onClick={create} disabled={!tenant}>New {tab === 0 ? 'article' : 'product'}</Button>}
      </Stack>
      <Tabs value={tab} onChange={switchTab} sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tab label="Articles" /><Tab label="Products" /><Tab label="Media schedule" />
      </Tabs>
      {tab === 2 ? <PortalMediaSchedulePanel tenant={tenant} onNotice={setNotice} onError={setError} /> : <>
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
            <TableCell>{tab === 0 ? row.articleLink : row.code}</TableCell><TableCell>{tab === 0 ? row.category : nameFor(catalogs, row.catalog)}</TableCell>
            {tab === 1 && <TableCell align="right">{Number(row.price || 0).toLocaleString('vi-VN')} {row.currency}</TableCell>}
            <TableCell>{row.approved ? 'Approved' : 'Draft'}{row.visible ? '' : ' · Hidden'}{row.locked ? ' · Locked' : ''}</TableCell>
            <TableCell>{date(row.modifiedTime)}</TableCell><TableCell><Button size="small" startIcon={<EditIcon />} onClick={() => edit(row)}>Edit</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
      </>}
    </CardContent></Card>
    <ArticleEditor open={tab === 0 && Boolean(draft)} value={draft || emptyArticle} onChange={setDraft} onClose={() => setDraft(null)} onSave={save} saving={saving} rows={tab === 0 ? rows : []} />
    <ProductEditor open={tab === 1 && Boolean(draft)} value={draft || emptyProduct} onChange={setDraft} onClose={() => setDraft(null)} onSave={save} saving={saving} rows={tab === 1 ? rows : []} brands={brands} catalogs={catalogs} groups={groups} />
  </Box>
}
