import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper,
  Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import RefreshIcon from '@mui/icons-material/Refresh'
import SaveIcon from '@mui/icons-material/Save'
import {
  fetchPortalArticles, fetchPortalProducts, fetchPortalTenants,
  savePortalArticle, savePortalProduct
} from '../../api/portalContentApi'

const emptyArticle = {
  title: '', articleLink: '', category: 'blog', subCategory: 'none', language: 'vi',
  keywords: '', thumbnailUrl: '', description: '', content: '', template: 'blog-single.html',
  visible: true, approved: false, locked: false,
}
const emptyProduct = {
  name: '', code: '', catalog: 'none', subCatalog: 'none', brand: 'none', status: 'available',
  shortDescription: '', longDescription: '', imageUrl: '', imageDescriptionUrl: '', videoUrl: '',
  price: 0, discount: 0, currency: 'VND', language: 'vi', path: '', group: 'none',
  visible: true, approved: false, locked: false, newProduct: false,
}

const date = value => value ? new Date(value).toLocaleString('vi-VN') : '—'

function Flags({ value, onChange, product = false }) {
  const set = key => event => onChange({ ...value, [key]: event.target.checked })
  return <Stack direction="row" useFlexGap flexWrap="wrap">
    <FormControlLabel control={<Checkbox checked={Boolean(value.visible)} onChange={set('visible')} />} label="Visible" />
    <FormControlLabel control={<Checkbox checked={Boolean(value.approved)} onChange={set('approved')} />} label="Approved" />
    <FormControlLabel control={<Checkbox checked={Boolean(value.locked)} onChange={set('locked')} />} label="Locked" />
    {product && <FormControlLabel control={<Checkbox checked={Boolean(value.newProduct)} onChange={set('newProduct')} />} label="New product" />}
  </Stack>
}

function ArticleEditor({ open, value, onChange, onClose, onSave, saving }) {
  const set = key => event => onChange({ ...value, [key]: event.target.value })
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>{value.id ? `Edit article #${value.id}` : 'New article'}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth required label="Title" value={value.title || ''} onChange={set('title')} />
        <TextField fullWidth required label="Article link" value={value.articleLink || ''} onChange={set('articleLink')} placeholder="/tin-tuc/bai-viet" />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth label="Category" value={value.category || ''} onChange={set('category')} />
        <TextField fullWidth label="Subcategory" value={value.subCategory || ''} onChange={set('subCategory')} />
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

function ProductEditor({ open, value, onChange, onClose, onSave, saving }) {
  const set = key => event => onChange({ ...value, [key]: event.target.value })
  const number = key => event => onChange({ ...value, [key]: Number(event.target.value) || 0 })
  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="lg">
    <DialogTitle>{value.id ? `Edit product #${value.id}` : 'New product'}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth required label="Product name" value={value.name || ''} onChange={set('name')} />
        <TextField fullWidth required label="Product code" value={value.code || ''} onChange={set('code')} />
        <TextField fullWidth required label="Path" value={value.path || ''} onChange={set('path')} placeholder="/san-pham/mi-gia-truyen" />
      </Stack>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <TextField fullWidth label="Catalog" value={value.catalog || ''} onChange={set('catalog')} />
        <TextField fullWidth label="Subcatalog" value={value.subCatalog || ''} onChange={set('subCatalog')} />
        <TextField fullWidth label="Brand" value={value.brand || ''} onChange={set('brand')} />
        <TextField fullWidth label="Group" value={value.group || ''} onChange={set('group')} />
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
  const edit = row => setDraft({ ...row })
  const create = () => setDraft({ ...(tab === 0 ? emptyArticle : emptyProduct) })
  const save = async () => {
    if (!tenant || !draft) return
    setSaving(true); setError(''); setNotice('')
    try {
      if (tab === 0) await savePortalArticle(tenant, draft)
      else await savePortalProduct(tenant, draft)
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
    <ArticleEditor open={tab === 0 && Boolean(draft)} value={draft || emptyArticle} onChange={setDraft} onClose={() => setDraft(null)} onSave={save} saving={saving} />
    <ProductEditor open={tab === 1 && Boolean(draft)} value={draft || emptyProduct} onChange={setDraft} onClose={() => setDraft(null)} onSave={save} saving={saving} />
  </Box>
}
