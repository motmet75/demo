import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, FormControlLabel, Switch, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TableSortLabel, TextField, Tooltip, Typography
} from '@mui/material'
import FilterAltOffIcon from '@mui/icons-material/FilterAltOff'
import AddIcon from '@mui/icons-material/Add'
import GroupAddIcon from '@mui/icons-material/GroupAdd'
import RefreshIcon from '@mui/icons-material/Refresh'
import ScheduleSendIcon from '@mui/icons-material/ScheduleSend'
import {
  addPortalFacebookGroups, cancelPortalGroupPost, fetchPortalGroupPostMembers, fetchPortalGroupPostOptions, fetchPortalGroupPosts,
  fetchPortalProducts, previewPortalGroupPosts, savePortalGroupPosts
} from '../../api/portalContentApi'
import { usePhone } from '../../components/usePhone'
import GridFilterPick from './GridFilterPick'
import { WHEN_FILTERS, countedOptions, fold, matchesWords, nextSort, sortRows, vietnamNowPlus } from './gridFilterUtils'

// Ported from legacy Portal ProductGroupPostForm: post products into many
// Facebook groups (marketing-group members), one row per group, staggered.
// Saved rows are picked up by the Chrome add-on (legacy /api/ext/queue).

const LINK = '{{link}}'
const STATUS_COLOR = { pending: 'info', running: 'warning', retrying: 'warning', fired: 'success', done: 'success', failed: 'error', cancelled: 'default' }
const SEQUENCE_HELP = '0 name first · 1 hashtag line · 2 #brand · 3 #catalog · 4 #sub-catalog · 5 page contact line · 6 tracked link · 7 product code'
const showTime = value => value ? value.replace('T', ' ').slice(0, 16) : '—'
const withSeconds = value => value && value.length === 16 ? `${value}:00` : value
const LINKS_EXAMPLE = 'Nội thất HCM | https://www.facebook.com/groups/noithathcm\nhttps://www.facebook.com/groups/1234567890'
const looksLikeGroupLink = line => /facebook\.com\/groups\/|fb\.com\/groups\/|^\s*groups\/|(^|\s)\d{6,}(\s|$)/i.test(line)

// Store Facebook groups by pasting their links. Each group becomes a member of a
// marketing group, exactly as in legacy Portal, so campaigns can pick it.
function AddFacebookGroupsDialog({ open, tenant, groups, defaultGroup, onClose, onSaved }) {
  const phone = usePhone()
  const [links, setLinks] = useState('')
  const [group, setGroup] = useState(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [openedFor, setOpenedFor] = useState(false)
  if (open !== openedFor) {               // reset when the dialog opens (derived state, no effect)
    setOpenedFor(open)
    if (open) { setLinks(''); setError(''); setResult(null); setGroup(defaultGroup || null) }
  }

  const lines = links.split('\n').map(l => l.trim()).filter(Boolean)
  const recognised = lines.filter(looksLikeGroupLink).length
  const groupId = group && typeof group === 'object' ? group.id : ''
  const newGroupName = typeof group === 'string' ? group.trim() : ''

  const save = async () => {
    setWorking(true); setError('')
    try {
      const r = await addPortalFacebookGroups(tenant, { links, marketingGroupId: groupId, newGroupName })
      setResult(r)
      const stored = (r?.created?.length || 0) + (r?.linked?.length || 0)
      if (stored > 0) onSaved(r)
      // keep only the lines that need fixing
      setLinks((r?.invalid || []).map(i => i.line).join('\n'))
    } catch (e) { setError(e.message || 'Cannot store Facebook groups') }
    finally { setWorking(false) }
  }

  return <Dialog open={open} onClose={working ? undefined : onClose} fullWidth maxWidth="sm" fullScreen={phone}>
    <DialogTitle>Add Facebook groups by link</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {result && <Alert severity={result.invalid?.length ? 'warning' : 'success'}>
          {result.created?.length || 0} new · {result.linked?.length || 0} already stored, added to “{result.marketingGroupName}”
          {result.already?.length ? ` · ${result.already.length} already in this group` : ''}
          {result.invalid?.length ? <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {result.invalid.map(i => <li key={i.line}><strong>{i.line}</strong>: {i.reason}</li>)}
          </Box> : null}
        </Alert>}
        <TextField label="Facebook group links" value={links} onChange={e => setLinks(e.target.value)} multiline minRows={5}
          maxRows={14} autoFocus placeholder={LINKS_EXAMPLE}
          helperText={lines.length
            ? `${recognised} of ${lines.length} line${lines.length === 1 ? '' : 's'} look like group links`
            : 'One group per line. A name before or after the link is optional.'} />
        <Autocomplete freeSolo options={groups} value={group} onChange={(_, v) => setGroup(v)}
          onInputChange={(_, v, reason) => { if (reason === 'input') setGroup(v) }}
          getOptionLabel={g => typeof g === 'string' ? g : `${g.name} (${g.members})`}
          isOptionEqualToValue={(a, b) => typeof a === 'object' && typeof b === 'object' && a.id === b.id}
          renderInput={params => <TextField {...params} label="Save into marketing group"
            helperText={newGroupName ? `A new marketing group “${newGroupName}” will be created` : 'Choose one, or type a name to create it'} />} />
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={working}>{result ? 'Done' : 'Cancel'}</Button>
      <Button variant="contained" startIcon={<GroupAddIcon />} onClick={save}
        disabled={working || !tenant || !lines.length || (!groupId && !newGroupName)}>
        {working ? 'Saving…' : `Save ${lines.length || ''} group${lines.length === 1 ? '' : 's'}`}
      </Button>
    </DialogActions>
  </Dialog>
}

const membershipsOf = m => (m.groups || '').split(', ').map(g => g.trim()).filter(Boolean)

// Facebook groups to post into: filter, sort and tick in a table. "Select all" ticks the
// rows that match the current filter, so you can narrow first and then select.
function FacebookGroupPicker({ members, chosen, onChange, loading, onAdd }) {
  const [text, setText] = useState('')
  const [marketing, setMarketing] = useState('')
  const [onlyChosen, setOnlyChosen] = useState(false)
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const picked = useMemo(() => new Set(chosen.map(m => m.username)), [chosen])

  const marketingItems = useMemo(() => {
    const seen = new Map()
    members.forEach(m => membershipsOf(m).forEach(g => seen.set(g, (seen.get(g) || 0) + 1)))
    return [...seen.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, 'vi'))
  }, [members])
  const columns = useMemo(() => [
    { key: 'name', label: 'Tên nhóm', get: m => fold(m.name || m.username) },
    { key: 'link', label: 'Link / ID', get: m => fold(m.username) },
    { key: 'marketing', label: 'Nhóm marketing', get: m => fold(m.groups) },
  ], [])
  const visible = useMemo(() => {
    const filtered = members.filter(m =>
      (!marketing || membershipsOf(m).includes(marketing)) && (!onlyChosen || picked.has(m.username)) &&
      matchesWords(text, [m.name, m.username, m.groups].join(' ')))
    return sortRows(filtered, (columns.find(c => c.key === sort.key) || columns[0]).get, sort.dir)
  }, [members, marketing, onlyChosen, picked, text, sort, columns])

  const filtering = !!(text || marketing || onlyChosen)
  const visibleChosen = visible.filter(m => picked.has(m.username)).length
  const toggle = m => onChange(picked.has(m.username) ? chosen.filter(c => c.username !== m.username) : [...chosen, m])
  const selectVisible = on => {
    const names = new Set(visible.map(m => m.username))
    onChange(on ? [...chosen.filter(c => !names.has(c.username)), ...visible] : chosen.filter(c => !names.has(c.username)))
  }

  return <Box>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap alignItems={{ md: 'center' }}>
      <TextField size="small" sx={{ minWidth: 220, flex: 1 }} label="Lọc nhóm Facebook" value={text}
        onChange={e => setText(e.target.value)} placeholder="Tên nhóm, link, nhóm marketing…" />
      {marketingItems.length > 1 && <GridFilterPick label="Nhóm marketing" value={marketing} items={marketingItems} onChange={setMarketing} minWidth={200} />}
      <FormControlLabel control={<Switch size="small" checked={onlyChosen} onChange={e => setOnlyChosen(e.target.checked)} />} label="Chỉ nhóm đã chọn" />
      {filtering && <Button size="small" color="inherit" startIcon={<FilterAltOffIcon />}
        onClick={() => { setText(''); setMarketing(''); setOnlyChosen(false) }}>Xoá lọc</Button>}
    </Stack>
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
      <Typography variant="body2" color="text.secondary">
        Đã chọn {chosen.length} / {members.length} nhóm Facebook{filtering ? ` · đang hiện ${visible.length}` : ''}
      </Typography>
      <Button size="small" onClick={() => selectVisible(true)} disabled={!visible.length || visibleChosen === visible.length}>
        Chọn {filtering ? `${visible.length} nhóm đang hiện` : `tất cả ${members.length}`}
      </Button>
      <Button size="small" color="inherit" onClick={() => selectVisible(false)} disabled={!visibleChosen}>
        Bỏ chọn {filtering ? 'nhóm đang hiện' : 'tất cả'}
      </Button>
      <Button size="small" startIcon={<GroupAddIcon />} onClick={onAdd}>Add groups by link</Button>
    </Stack>
    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}><Table stickyHeader size="small">
      <TableHead><TableRow>
        <TableCell padding="checkbox"><Checkbox size="small" checked={!!visible.length && visibleChosen === visible.length}
          indeterminate={visibleChosen > 0 && visibleChosen < visible.length} onChange={e => selectVisible(e.target.checked)} /></TableCell>
        {columns.map(c => <TableCell key={c.key} sortDirection={sort.key === c.key ? sort.dir : false}>
          <TableSortLabel active={sort.key === c.key} direction={sort.key === c.key ? sort.dir : 'asc'}
            onClick={() => setSort(cur => nextSort(cur, c.key, []))}>{c.label}</TableSortLabel>
        </TableCell>)}
      </TableRow></TableHead>
      <TableBody>
        {visible.map(m => <TableRow key={m.username} hover onClick={() => toggle(m)} selected={picked.has(m.username)} sx={{ cursor: 'pointer' }}>
          <TableCell padding="checkbox"><Checkbox size="small" checked={picked.has(m.username)}
            onClick={e => e.stopPropagation()} onChange={() => toggle(m)} /></TableCell>
          <TableCell sx={{ fontWeight: 600 }}>{m.name || '—'}</TableCell>
          <TableCell sx={{ wordBreak: 'break-all' }}>{m.username}</TableCell>
          <TableCell>{m.groups}</TableCell>
        </TableRow>)}
        {!visible.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
          {loading ? <CircularProgress size={20} /> : members.length ? 'Không có nhóm nào khớp bộ lọc.' : 'Chưa có nhóm Facebook. Bấm “Add groups by link”.'}
        </TableCell></TableRow>}
      </TableBody>
    </Table></TableContainer>
  </Box>
}

function GroupPostDialog({ open, tenant, onClose, onSaved }) {
  const phone = usePhone()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [groups, setGroups] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [members, setMembers] = useState([])
  const [membersLoading, setMembersLoading] = useState(false)
  const [chosenProducts, setChosenProducts] = useState([])
  const [chosenGroups, setChosenGroups] = useState([])
  const [chosenMembers, setChosenMembers] = useState([])
  const [campaign, setCampaign] = useState('')
  const [sequence, setSequence] = useState('51267')
  const [start, setStart] = useState(vietnamNowPlus(60))
  const [interval, setIntervalMinutes] = useState(10)
  const [rows, setRows] = useState([])
  const [working, setWorking] = useState(false)
  const [addingGroups, setAddingGroups] = useState(false)

  const groupsSaved = async r => {
    try {
      const options = await fetchPortalGroupPostOptions(tenant)
      const next = options?.groups || []
      setGroups(next)
      const saved = next.find(g => g.id === r.marketingGroupId)
      if (saved) setChosenGroups(current => [...current.filter(g => g.id !== saved.id), saved])
      setRows([])
    } catch (e) { setError(e.message || 'Cannot reload marketing groups') }
  }

  useEffect(() => {
    if (!open || !tenant) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setLoading(true); setError(''); setRows([]); setChosenProducts([]); setChosenGroups([]); setChosenMembers([])
      setStart(vietnamNowPlus(60))
      Promise.all([fetchPortalProducts(tenant, ''), fetchPortalGroupPostOptions(tenant)])
        .then(([productRows, options]) => {
          if (cancelled) return
          setProducts(Array.isArray(productRows) ? productRows : [])
          setGroups(options?.groups || [])
          setCampaigns(options?.campaigns || [])
          setCampaign(options?.campaigns?.[0]?.code || '')
        })
        .catch(e => !cancelled && setError(e.message || 'Cannot load campaign options'))
        .finally(() => !cancelled && setLoading(false))
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, tenant])

  // Facebook groups available = members of the chosen marketing groups (all when none chosen).
  useEffect(() => {
    if (!open || !tenant) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setMembersLoading(true)
      fetchPortalGroupPostMembers(tenant, chosenGroups.map(g => g.id))
        .then(list => {
          if (cancelled) return
          const next = Array.isArray(list) ? list : []
          setMembers(next)
          // Choosing marketing groups selects all their Facebook groups (the usual intent);
          // with no marketing group chosen, start from an empty selection.
          setChosenMembers(chosenGroups.length ? next : [])
        })
        .catch(e => !cancelled && setError(e.message || 'Cannot load Facebook groups'))
        .finally(() => !cancelled && setMembersLoading(false))
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, tenant, chosenGroups])

  const generate = async () => {
    setWorking(true); setError('')
    try {
      const preview = await previewPortalGroupPosts(tenant, {
        productIds: chosenProducts.map(p => p.id), usernames: chosenMembers.map(m => m.username), sequence,
        startAt: withSeconds(start), intervalMinutes: Number(interval), timezone: 'Asia/Ho_Chi_Minh',
      })
      setRows((preview || []).map(r => ({ ...r, scheduledAt: showTime(r.scheduledAt).replace(' ', 'T') })))
    } catch (e) { setError(e.message || 'Cannot generate rows') }
    finally { setWorking(false) }
  }

  const updateRow = (index, patch) => setRows(current => current.map((r, i) => i === index ? { ...r, ...patch } : r))
  const removeRow = index => setRows(current => current.filter((_, i) => i !== index))

  const summary = useMemo(() => {
    const counts = {}
    rows.forEach(r => { counts[r.productCode] = (counts[r.productCode] || 0) + 1 })
    return Object.entries(counts).map(([code, n]) => `${code}: ${n}`).join(' · ')
  }, [rows])

  const save = async () => {
    setWorking(true); setError('')
    try {
      const result = await savePortalGroupPosts(tenant, {
        campaignCode: campaign, timezone: 'Asia/Ho_Chi_Minh',
        rows: rows.map(r => ({ username: r.username, productId: r.productId, scheduledAt: withSeconds(r.scheduledAt), message: r.message })),
      })
      onSaved(result?.saved || 0)
    } catch (e) { setError(e.message || 'Cannot save group posts') }
    finally { setWorking(false) }
  }

  const canGenerate = chosenProducts.length > 0 && chosenMembers.length > 0 && /^[0-7]*$/.test(sequence)
  const rowProblems = rows.filter(r => !r.scheduledAt || !r.message.trim()).length

  return <Dialog open={open} onClose={working ? undefined : onClose} fullWidth maxWidth="lg" fullScreen={phone}>
    <DialogTitle>New Facebook group post campaign</DialogTitle>
    <DialogContent>
      {loading ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box> : <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error">{error}</Alert>}

        <Typography variant="subtitle2">1 · What to post</Typography>
        <Autocomplete multiple options={products} value={chosenProducts} onChange={(_, v) => { setChosenProducts(v); setRows([]) }}
          getOptionLabel={o => `${o.name} · ${o.code}`} isOptionEqualToValue={(a, b) => a.id === b.id}
          renderInput={params => <TextField {...params} label="Products" placeholder="Search by name or code"
            helperText="Groups are split evenly across these products, in this order." />} />

        <Typography variant="subtitle2">2 · Where to post</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <Autocomplete multiple fullWidth options={groups} value={chosenGroups} onChange={(_, v) => { setChosenGroups(v); setRows([]) }}
            getOptionLabel={g => `${g.name} (${g.members})`} isOptionEqualToValue={(a, b) => a.id === b.id}
            renderInput={params => <TextField {...params} label="Marketing groups" placeholder="Choose to fill Facebook groups" />} />
          <TextField select fullWidth label="Campaign (for click tracking)" value={campaign} onChange={e => setCampaign(e.target.value)}>
            <MenuItem value="">No campaign</MenuItem>
            {campaigns.map(c => <MenuItem key={c.code} value={c.code}>{c.name} · {c.code}</MenuItem>)}
          </TextField>
        </Stack>
        <FacebookGroupPicker members={members} chosen={chosenMembers} loading={membersLoading}
          onChange={v => { setChosenMembers(v); setRows([]) }} onAdd={() => setAddingGroups(true)} />
        <AddFacebookGroupsDialog open={addingGroups} tenant={tenant} groups={groups} defaultGroup={chosenGroups[0]}
          onClose={() => setAddingGroups(false)} onSaved={groupsSaved} />

        <Typography variant="subtitle2">3 · When and how</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField fullWidth type="datetime-local" label="First post (Vietnam time)" value={start}
            onChange={e => setStart(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField fullWidth type="number" label="Minutes between posts" value={interval}
            onChange={e => setIntervalMinutes(e.target.value)} inputProps={{ min: 0, max: 1440 }} />
          <TextField fullWidth label="Message sequence" value={sequence} error={!/^[0-7]*$/.test(sequence)}
            onChange={e => setSequence(e.target.value.replace(/[^0-7]/g, ''))} helperText={SEQUENCE_HELP} />
        </Stack>
        <Box><Button variant="outlined" onClick={generate} disabled={!canGenerate || working}>
          {rows.length ? 'Regenerate rows' : 'Generate rows'}
        </Button></Box>

        {rows.length > 0 && <>
          <Alert severity="info">
            {rows.length} posts · {summary}. Review and edit each post below. <strong>{LINK}</strong> becomes the product link with a
            per-group tracking code when you save.
          </Alert>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '50vh' }}><Table stickyHeader size="small">
            <TableHead><TableRow>
              <TableCell>Facebook group</TableCell><TableCell width={200}>Product</TableCell>
              <TableCell width={190}>Time</TableCell><TableCell>Message</TableCell><TableCell width={40} />
            </TableRow></TableHead>
            <TableBody>{rows.map((r, i) => <TableRow key={r.username} sx={{ verticalAlign: 'top' }}>
              <TableCell sx={{ wordBreak: 'break-all', minWidth: 140 }}><strong>{r.name || '—'}</strong><br />
                <Typography variant="caption" color="text.secondary">{r.username}</Typography></TableCell>
              <TableCell><TextField select size="small" fullWidth value={r.productId}
                onChange={e => {
                  const p = chosenProducts.find(x => x.id === Number(e.target.value))
                  if (p) updateRow(i, { productId: p.id, productCode: p.code, productName: p.name })
                }}
                helperText="Regenerate to rebuild the message">
                {chosenProducts.map(p => <MenuItem key={p.id} value={p.id}>{p.name} · {p.code}</MenuItem>)}
              </TextField></TableCell>
              <TableCell><TextField size="small" type="datetime-local" value={r.scheduledAt}
                onChange={e => updateRow(i, { scheduledAt: e.target.value })} /></TableCell>
              <TableCell sx={{ minWidth: 260 }}><TextField size="small" fullWidth multiline minRows={2} maxRows={8}
                value={r.message} onChange={e => updateRow(i, { message: e.target.value })} error={!r.message.trim()} /></TableCell>
              <TableCell><Tooltip title="Remove this group"><Button size="small" color="error" onClick={() => removeRow(i)}>✕</Button></Tooltip></TableCell>
            </TableRow>)}</TableBody>
          </Table></TableContainer>
        </>}
      </Stack>}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={working}>Cancel</Button>
      <Button variant="contained" startIcon={<ScheduleSendIcon />} onClick={save}
        disabled={working || loading || !rows.length || rowProblems > 0}>
        {working ? 'Saving…' : `Queue ${rows.length || ''} group post${rows.length === 1 ? '' : 's'}`}
      </Button>
    </DialogActions>
  </Dialog>
}

export default function PortalGroupPostPanel({ tenant, onNotice, onError }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [filter, setFilter] = useState('')
  const [adding, setAdding] = useState(false)
  const [marketingGroups, setMarketingGroups] = useState([])

  const openAdd = async () => {
    setAdding(true)
    try { setMarketingGroups((await fetchPortalGroupPostOptions(tenant))?.groups || []) }
    catch (e) { onError(e.message || 'Cannot load marketing groups') }
  }

  const load = useCallback(async () => {
    if (!tenant) { setRows([]); return }
    setLoading(true)
    try { setRows(await fetchPortalGroupPosts(tenant) || []) }
    catch (e) { onError(e.message || 'Cannot load group posts'); setRows([]) }
    finally { setLoading(false) }
  }, [tenant, onError])

  useEffect(() => {
    const timer = window.setTimeout(load, 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const cancel = async row => {
    if (!window.confirm(`Cancel group post #${row.id} to ${row.groupUrl}?`)) return
    setBusyId(row.id)
    try { await cancelPortalGroupPost(tenant, row.id); onNotice(`Group post #${row.id} cancelled.`); await load() }
    catch (e) { onError(e.message || 'Cannot cancel group post') }
    finally { setBusyId(null) }
  }

  const [product, setProduct] = useState('')
  const [status, setStatus] = useState('')
  const [createdBy, setCreatedBy] = useState('')
  const [when, setWhen] = useState('')
  const [sort, setSort] = useState({ key: 'time', dir: 'desc' })

  const columns = useMemo(() => [
    { key: 'id', label: 'ID', width: 70, get: r => r.id },
    { key: 'time', label: 'Post time', get: r => r.scheduledAt || '' },
    { key: 'group', label: 'Facebook group', get: r => (r.groupUrl || '').toLowerCase() },
    { key: 'product', label: 'Product', get: r => (r.productCode || '').toLowerCase() },
    { key: 'status', label: 'Status', get: r => r.status || '' },
    { key: 'by', label: 'By', get: r => (r.createdBy || '').toLowerCase() },
  ], [])
  const productItems = useMemo(() => countedOptions(rows, r => r.productCode), [rows])
  const statusItems = useMemo(() => countedOptions(rows, r => r.status), [rows])
  const byItems = useMemo(() => countedOptions(rows, r => r.createdBy), [rows])

  const visible = useMemo(() => {
    const now = vietnamNowPlus(0)
    const whenTest = WHEN_FILTERS.find(w => w.value === when)?.test
    const filtered = rows.filter(r =>
      (!product || r.productCode === product) && (!status || r.status === status) &&
      (!createdBy || r.createdBy === createdBy) &&
      (!whenTest || (r.scheduledAt && whenTest(r.scheduledAt.slice(0, 16), now))) &&
      matchesWords(filter, [r.id, r.groupUrl, r.productCode, r.status, r.createdBy, r.message, r.lastError].join(' ')))
    const column = columns.find(c => c.key === sort.key) || columns[1]
    return sortRows(filtered, column.get, sort.dir)
  }, [rows, filter, product, status, createdBy, when, sort, columns])
  const filtering = !!(filter || product || status || createdBy || when)
  const clear = () => { setFilter(''); setProduct(''); setStatus(''); setCreatedBy(''); setWhen('') }
  const sortBy = key => setSort(cur => nextSort(cur, key, ['id', 'time']))

  return <Box>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
      <Box sx={{ flex: 1 }} />
      <Button startIcon={<RefreshIcon />} onClick={load} disabled={!tenant || loading}>Load</Button>
      <Button startIcon={<GroupAddIcon />} onClick={openAdd} disabled={!tenant}>Add Facebook groups</Button>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpen(true)} disabled={!tenant}>New group post campaign</Button>
    </Stack>
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap alignItems={{ md: 'center' }}>
      <TextField size="small" sx={{ minWidth: 240, flex: 1 }} label="Lọc nhanh" value={filter} onChange={e => setFilter(e.target.value)}
        placeholder="Nhóm, mã sản phẩm, nội dung, lỗi…" />
      <TextField select size="small" sx={{ minWidth: 160 }} label="Thời gian đăng" value={when} onChange={e => setWhen(e.target.value)}>
        {WHEN_FILTERS.map(w => <MenuItem key={w.value} value={w.value}>{w.label}</MenuItem>)}
      </TextField>
      <GridFilterPick label="Sản phẩm" value={product} items={productItems} onChange={setProduct} minWidth={180} />
      <GridFilterPick label="Trạng thái" value={status} items={statusItems} onChange={setStatus} minWidth={160} />
      <GridFilterPick label="Người tạo" value={createdBy} items={byItems} onChange={setCreatedBy} minWidth={180} />
      {filtering && <Button size="small" color="inherit" startIcon={<FilterAltOffIcon />} onClick={clear}>Xoá lọc</Button>}
    </Stack>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
      {filtering ? `${visible.length} / ${rows.length}` : rows.length} bài đăng nhóm{rows.length >= 300 ? ' (300 bài gần nhất)' : ''} ·
      Posted into Facebook groups by the Chrome add-on (it pulls pending posts from the Portal queue). Times are Vietnam time.
    </Typography>
    {loading ? <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box> :
      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: '65vh' }}><Table stickyHeader size="small">
        <TableHead><TableRow>
          {columns.map(c => <TableCell key={c.key} width={c.width} sortDirection={sort.key === c.key ? sort.dir : false}>
            <TableSortLabel active={sort.key === c.key} direction={sort.key === c.key ? sort.dir : 'asc'} onClick={() => sortBy(c.key)}>
              {c.label}
            </TableSortLabel>
          </TableCell>)}
          <TableCell width={90} />
        </TableRow></TableHead>
        <TableBody>{visible.map(row => <TableRow key={row.id} hover>
          <TableCell>{row.id}</TableCell>
          <TableCell sx={{ whiteSpace: 'nowrap' }}>{showTime(row.scheduledAt)}</TableCell>
          <TableCell sx={{ wordBreak: 'break-all' }}><Tooltip title={<span style={{ whiteSpace: 'pre-wrap' }}>{row.message}</span>}><span>{row.groupUrl}</span></Tooltip></TableCell>
          <TableCell>{row.productCode}</TableCell>
          <TableCell><Tooltip title={row.lastError || ''}><Chip size="small" label={row.status} color={STATUS_COLOR[row.status] || 'default'} /></Tooltip></TableCell>
          <TableCell>{row.createdBy}</TableCell>
          <TableCell>{row.status === 'pending' &&
            <Button size="small" color="error" onClick={() => cancel(row)} disabled={busyId === row.id}>Cancel</Button>}</TableCell>
        </TableRow>)}
        {!visible.length && <TableRow><TableCell colSpan={columns.length + 1} align="center" sx={{ py: 4, color: 'text.secondary' }}>
          {rows.length ? 'Không có bài đăng nào khớp bộ lọc.' : 'Chưa có bài đăng nhóm.'}
        </TableCell></TableRow>}
        </TableBody>
      </Table></TableContainer>}
    <AddFacebookGroupsDialog open={adding} tenant={tenant} groups={marketingGroups} onClose={() => setAdding(false)}
      onSaved={r => onNotice(`${(r.created?.length || 0) + (r.linked?.length || 0)} Facebook group(s) saved in “${r.marketingGroupName}”.`)} />
    <GroupPostDialog open={open} tenant={tenant} onClose={() => setOpen(false)}
      onSaved={saved => { setOpen(false); onNotice(`${saved} group post(s) queued in ${tenant}.`); load() }} />
  </Box>
}
