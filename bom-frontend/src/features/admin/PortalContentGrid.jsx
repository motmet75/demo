import React, { useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Button, Chip, InputAdornment, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TableSortLabel, TextField, Typography
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import SearchIcon from '@mui/icons-material/Search'

// Client-side filter + sort over the rows the server returned (latest 500 per search).
// Text matching ignores case and Vietnamese accents, so "ca phe" finds "Cà phê".
const SERVER_LIMIT = 500
const fold = value => String(value ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim()
const date = value => value ? new Date(value).toLocaleString('vi-VN') : '—'
const nameFor = (list, code) => list.find(o => o.code === code)?.name || code || ''
const blank = value => !String(value ?? '').trim() || String(value).trim().toLowerCase() === 'none'

const STATUSES = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'approved', label: 'Đã duyệt', test: r => r.approved },
  { value: 'draft', label: 'Nháp (chưa duyệt)', test: r => !r.approved },
  { value: 'visible', label: 'Đang hiển thị', test: r => r.visible },
  { value: 'hidden', label: 'Đang ẩn', test: r => !r.visible },
  { value: 'locked', label: 'Đã khoá', test: r => r.locked },
]
const statusText = r => `${r.approved ? 'Approved' : 'Draft'}${r.visible ? '' : ' · Hidden'}${r.locked ? ' · Locked' : ''}`
const statusRank = r => (r.approved ? 0 : 2) + (r.visible ? 0 : 1) + (r.locked ? 4 : 0)

function options(rows, get) {
  const seen = new Map()
  rows.forEach(r => { const v = get(r); if (!blank(v)) seen.set(v, (seen.get(v) || 0) + 1) })
  return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0], 'vi')).map(([value, count]) => ({ value, count }))
}

function Pick({ label, value, onChange, items, labelFor = v => v }) {
  const selected = items.find(i => i.value === value) || null
  return <Autocomplete size="small" sx={{ minWidth: 200 }} options={items} value={selected}
    getOptionLabel={i => `${labelFor(i.value)} (${i.count})`} isOptionEqualToValue={(a, b) => a.value === b.value}
    onChange={(_, next) => onChange(next?.value || '')}
    renderInput={params => <TextField {...params} label={label} />} />
}

export default function PortalContentGrid({ kind, rows, catalogs = [], brands = [], groups = [], onEdit }) {
  const products = kind === 'product'
  const [text, setText] = useState('')
  const [category, setCategory] = useState('')
  const [subCategory, setSubCategory] = useState('')
  const [brand, setBrand] = useState('')
  const [group, setGroup] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState({ key: 'modified', dir: 'desc' })

  const columns = useMemo(() => [
    { key: 'id', label: 'ID', width: 70, get: r => r.id },
    { key: 'title', label: products ? 'Product' : 'Title', get: r => fold(products ? r.name : r.title) },
    { key: 'link', label: products ? 'Code' : 'Link', get: r => fold(products ? r.code : r.articleLink) },
    { key: 'category', label: products ? 'Catalog' : 'Category', get: r => fold(products ? nameFor(catalogs, r.catalog) : r.category) },
    ...(products ? [
      { key: 'brand', label: 'Brand', get: r => fold(nameFor(brands, r.brand)) },
      { key: 'price', label: 'Price', align: 'right', get: r => Number(r.price || 0) },
    ] : []),
    { key: 'status', label: 'Status', get: statusRank },
    { key: 'modified', label: 'Modified', get: r => r.modifiedTime ? new Date(r.modifiedTime).getTime() : 0 },
  ], [products, catalogs, brands])

  const categoryField = products ? 'catalog' : 'category'
  const subField = products ? 'subCatalog' : 'subCategory'
  const categoryItems = useMemo(() => options(rows, r => r[categoryField]), [rows, categoryField])
  const subItems = useMemo(() => options(rows.filter(r => !category || r[categoryField] === category), r => r[subField]),
    [rows, category, categoryField, subField])
  const brandItems = useMemo(() => products ? options(rows, r => r.brand) : [], [rows, products])
  const groupItems = useMemo(() => {
    if (!products) return []
    const seen = new Map()
    rows.forEach(r => (r.groupCodes || []).forEach(g => seen.set(g, (seen.get(g) || 0) + 1)))
    return [...seen.entries()].map(([value, count]) => ({ value, count }))
      .sort((a, b) => nameFor(groups, a.value).localeCompare(nameFor(groups, b.value), 'vi'))
  }, [rows, products, groups])

  const visible = useMemo(() => {
    const words = fold(text).split(/\s+/).filter(Boolean)
    const statusTest = STATUSES.find(s => s.value === status)?.test
    const haystack = r => fold(products
      ? [r.id, r.name, r.code, r.path, nameFor(catalogs, r.catalog), r.catalog, r.subCatalog, nameFor(brands, r.brand), r.brand, r.shortDescription].join(' ')
      : [r.id, r.title, r.articleLink, r.category, r.subCategory, r.keywords, r.description, r.username].join(' '))
    const filtered = rows.filter(r =>
      (!category || r[categoryField] === category) &&
      (!subCategory || r[subField] === subCategory) &&
      (!brand || r.brand === brand) &&
      (!group || (r.groupCodes || []).includes(group)) &&
      (!statusTest || statusTest(r)) &&
      (!words.length || (h => words.every(w => h.includes(w)))(haystack(r))))
    const column = columns.find(c => c.key === sort.key) || columns[0]
    const sign = sort.dir === 'asc' ? 1 : -1
    return filtered.map((r, i) => ({ r, i, v: column.get(r) }))
      .sort((a, b) => (a.v < b.v ? -1 : a.v > b.v ? 1 : 0) * sign || a.i - b.i)
      .map(x => x.r)
  }, [rows, text, category, subCategory, brand, group, status, sort, columns, products, catalogs, brands, categoryField, subField])

  const filtering = !!(text || category || subCategory || brand || group || status)
  const clear = () => { setText(''); setCategory(''); setSubCategory(''); setBrand(''); setGroup(''); setStatus('') }
  const sortBy = key => setSort(cur => cur.key === key
    ? { key, dir: cur.dir === 'asc' ? 'desc' : 'asc' }
    : { key, dir: key === 'modified' || key === 'price' || key === 'id' ? 'desc' : 'asc' })

  return <>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap alignItems={{ md: 'center' }}>
      <TextField size="small" sx={{ minWidth: 240, flex: 1 }} label="Lọc nhanh trong danh sách" value={text}
        onChange={e => setText(e.target.value)} placeholder={products ? 'Tên, mã, danh mục, thương hiệu…' : 'Tiêu đề, link, danh mục, từ khoá…'}
        InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }} />
      <Pick label={products ? 'Danh mục' : 'Chuyên mục'} value={category} items={categoryItems}
        labelFor={v => products ? nameFor(catalogs, v) : v} onChange={v => { setCategory(v); setSubCategory('') }} />
      {subItems.length > 0 && <Pick label={products ? 'Danh mục con' : 'Chuyên mục con'} value={subCategory} items={subItems} onChange={setSubCategory} />}
      {products && <Pick label="Thương hiệu" value={brand} items={brandItems} labelFor={v => nameFor(brands, v)} onChange={setBrand} />}
      {products && groupItems.length > 0 && <Pick label="Nhóm" value={group} items={groupItems} labelFor={v => nameFor(groups, v)} onChange={setGroup} />}
      <TextField select size="small" sx={{ minWidth: 180 }} label="Trạng thái" value={status} onChange={e => setStatus(e.target.value)}>
        {STATUSES.map(s => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
      </TextField>
      {filtering && <Button size="small" color="inherit" startIcon={<FilterAltOffIcon />} onClick={clear}>Xoá lọc</Button>}
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
      <Typography variant="body2" color="text.secondary">
        {filtering ? `${visible.length} / ${rows.length}` : rows.length} {products ? 'sản phẩm' : 'bài viết'}
      </Typography>
      {sort.key !== 'modified' && <Chip size="small" label={`Sắp xếp: ${columns.find(c => c.key === sort.key)?.label} ${sort.dir === 'asc' ? '↑' : '↓'}`}
        onDelete={() => setSort({ key: 'modified', dir: 'desc' })} />}
    </Stack>
    {rows.length >= SERVER_LIMIT && <Alert severity="info" sx={{ mb: 1 }}>
      Chỉ tải {SERVER_LIMIT} {products ? 'sản phẩm' : 'bài viết'} sửa gần nhất. Gõ vào ô Search phía trên rồi bấm Load để tìm trong toàn bộ dữ liệu.
    </Alert>}
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '65vh' }}><Table stickyHeader size="small">
      <TableHead><TableRow>
        {columns.map(c => <TableCell key={c.key} width={c.width} align={c.align} sortDirection={sort.key === c.key ? sort.dir : false}>
          <TableSortLabel active={sort.key === c.key} direction={sort.key === c.key ? sort.dir : 'asc'} onClick={() => sortBy(c.key)}>
            {c.label}
          </TableSortLabel>
        </TableCell>)}
        <TableCell width={80} />
      </TableRow></TableHead>
      <TableBody>
        {visible.map(row => <TableRow key={row.id} hover onDoubleClick={() => onEdit(row)} sx={{ cursor: 'pointer' }}>
          <TableCell>{row.id}</TableCell>
          <TableCell sx={{ fontWeight: 700 }}>{products ? row.name : row.title}</TableCell>
          <TableCell>{products ? row.code : row.articleLink}</TableCell>
          <TableCell>{products ? nameFor(catalogs, row.catalog) : row.category}
            {!blank(row[subField]) && <Typography component="span" variant="caption" color="text.secondary"> · {row[subField]}</Typography>}</TableCell>
          {products && <TableCell>{nameFor(brands, row.brand)}</TableCell>}
          {products && <TableCell align="right">{Number(row.price || 0).toLocaleString('vi-VN')} {row.currency}</TableCell>}
          <TableCell>{statusText(row)}</TableCell>
          <TableCell>{date(row.modifiedTime)}</TableCell>
          <TableCell><Button size="small" startIcon={<EditIcon />} onClick={() => onEdit(row)}>Edit</Button></TableCell>
        </TableRow>)}
        {!visible.length && <TableRow><TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4, color: 'text.secondary' }}>
          {rows.length ? 'Không có mục nào khớp bộ lọc.' : 'Chưa có dữ liệu. Bấm Load để tải.'}
        </TableCell></TableRow>}
      </TableBody>
    </Table></TableContainer>
  </>
}
