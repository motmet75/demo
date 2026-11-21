import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControlLabel, FormGroup, FormLabel, MenuItem, Stack, Switch, TextField, Typography
} from '@mui/material'
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternate'
import VideoFileIcon from '@mui/icons-material/VideoFile'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { createPortalLazyProduct, fetchPortalFacebookPages } from '../../api/portalContentApi'
import { usePhone } from '../../components/usePhone'

// Port of legacy Portal "lazy create" (portal-live schedule-product page,
// AdminLazyCreateProductController): one form creates the product and queues
// its social posts. Files are uploaded by Portal (Google Drive / Dailymotion)
// through the server-side bridge; the product code comes from Portal too.

const PLATFORMS = [
  { value: 'post_facebook_multi_image', label: 'Facebook · ảnh', image: true },
  { value: 'post_facebook_video', label: 'Facebook · video', video: true },
  { value: 'post_tiktok_image', label: 'TikTok · ảnh', image: true },
  { value: 'post_tiktok_video', label: 'TikTok · video', video: true },
  { value: 'post_youtube_video', label: 'YouTube · video', video: true },
]
const PRIVACY = [
  { value: 'PUBLIC_TO_EVERYONE', label: 'Công khai' },
  { value: 'MUTUAL_FOLLOW_FRIENDS', label: 'Bạn bè' },
  { value: 'FOLLOWER_OF_CREATOR', label: 'Người theo dõi' },
  { value: 'SELF_ONLY', label: 'Chỉ mình tôi' },
]
const SEQUENCE_HELP = 'Để trống nội dung = tự tạo theo dãy: 1 hashtag · 2 #thương hiệu · 3 #danh mục · 5 dòng liên hệ · 6 link · 7 mã. Có thể gõ {{TRACKED_URL}} và {{PRODUCT_CODE}}.'
const pad = n => String(n).padStart(2, '0')
const vietnamNowPlus = minutes => {
  const d = new Date(Date.now() + (7 * 60 + minutes) * 60000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}
const mb = bytes => `${(bytes / 1024 / 1024).toFixed(1)} MB`

function CodePick({ label, options, value, onChange, multiple = false }) {
  const selected = multiple ? options.filter(o => value.includes(o.code)) : options.find(o => o.code === value) || null
  return <Autocomplete multiple={multiple} fullWidth options={options} value={selected}
    getOptionLabel={o => o.name || o.code} isOptionEqualToValue={(a, b) => a.code === b.code}
    onChange={(_, next) => onChange(multiple ? next.map(o => o.code) : next?.code || '')}
    renderInput={params => <TextField {...params} label={label} />} />
}

function MessageField({ label, message, onMessage, sequence, onSequence }) {
  return <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
    <TextField fullWidth multiline minRows={2} label={label} value={message} onChange={e => onMessage(e.target.value)}
      placeholder="Để trống để tự tạo" />
    <TextField sx={{ width: { md: 160 } }} label="Dãy" value={sequence}
      onChange={e => onSequence(e.target.value.replace(/[^0-7]/g, ''))} />
  </Stack>
}

export default function PortalLazyCreateDialog({ open, tenant, brands, catalogs, groups, onClose, onCreated }) {
  const phone = usePhone()
  const [pages, setPages] = useState([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [f, setF] = useState(null)
  const [images, setImages] = useState([])
  const [thumbnail, setThumbnail] = useState(null)
  const [video, setVideo] = useState(null)

  useEffect(() => {
    if (!open || !tenant) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      setError(''); setImages([]); setThumbnail(null); setVideo(null)
      setF({
        name: '', price: '', catalog: '', brand: '', groupCodes: [], dailymotionVideoAddress: '',
        actions: ['post_facebook_multi_image'], immediate: false, scheduledAt: vietnamNowPlus(30), facebookPageId: '',
        facebookMessage: '', facebookSequence: '51267', tiktokMessage: '', tiktokSequence: '127',
        youtubeDescription: '', youtubeSequence: '5127', tiktokPrivacy: 'PUBLIC_TO_EVERYONE',
        tiktokAllowComment: true, tiktokAllowDuet: false, tiktokAllowStitch: false, tiktokAutoAddMusic: true,
        tiktokMusicConsent: true,
      })
      fetchPortalFacebookPages(tenant).then(list => {
        if (cancelled) return
        setPages(Array.isArray(list) ? list : [])
        setF(cur => cur && ({ ...cur, facebookPageId: list?.[0]?.pageId || '' }))
      }).catch(() => !cancelled && setPages([]))
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [open, tenant])

  const previews = useMemo(() => images.map(file => ({ file, url: URL.createObjectURL(file) })), [images])
  useEffect(() => () => previews.forEach(p => URL.revokeObjectURL(p.url)), [previews])

  if (!f) return null
  const set = key => value => setF(cur => ({ ...cur, [key]: value }))
  const toggle = value => e => set('actions')(e.target.checked ? [...f.actions, value] : f.actions.filter(a => a !== value))
  const chosen = PLATFORMS.filter(p => f.actions.includes(p.value))
  const wantsImages = chosen.some(p => p.image)
  const wantsVideo = chosen.some(p => p.video)
  const wantsFacebook = f.actions.some(a => a.startsWith('post_facebook'))
  const wantsTikTok = f.actions.some(a => a.startsWith('post_tiktok'))
  const wantsYouTube = f.actions.includes('post_youtube_video')

  const problems = []
  if (!f.name.trim()) problems.push('Nhập tên sản phẩm')
  if (wantsImages && !images.length && !thumbnail) problems.push('Chọn ảnh để đăng ảnh')
  if (wantsVideo && !video && !f.dailymotionVideoAddress.trim()) problems.push('Chọn video hoặc nhập Dailymotion')
  if (wantsFacebook && !f.facebookPageId) problems.push('Chọn Facebook Page')
  if (wantsTikTok && !f.tiktokMusicConsent) problems.push('Xác nhận điều khoản nhạc TikTok')
  if (chosen.length && !f.immediate && !f.scheduledAt) problems.push('Chọn giờ đăng')
  if (images.some(i => i.size > 20 * 1048576) || (thumbnail && thumbnail.size > 20 * 1048576)) problems.push('Ảnh tối đa 20 MB')
  if (video && video.size > 250 * 1048576) problems.push('Video tối đa 250 MB')

  const submit = async () => {
    setSaving(true); setError('')
    try {
      const form = {
        ...f, name: f.name.trim(), price: f.price === '' ? null : Number(f.price),
        scheduledAt: f.immediate ? null : (f.scheduledAt.length === 16 ? `${f.scheduledAt}:00` : f.scheduledAt),
      }
      const body = new FormData()
      body.append('form', new Blob([JSON.stringify(form)], { type: 'application/json' }))
      images.forEach(file => body.append('images', file))
      if (thumbnail) body.append('thumbnail', thumbnail)
      if (video) body.append('video', video)
      const result = await createPortalLazyProduct(tenant, body)
      onCreated(result)
    } catch (e) { setError(e.message || 'Không tạo được sản phẩm') }
    finally { setSaving(false) }
  }

  const totalUpload = images.reduce((s, i) => s + i.size, 0) + (thumbnail?.size || 0) + (video?.size || 0)

  return <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="md" fullScreen={phone}>
    <DialogTitle>Tạo nhanh sản phẩm + lên lịch đăng</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        {error && <Alert severity="error" sx={{ whiteSpace: 'pre-wrap' }}>{error}</Alert>}

        <Typography variant="subtitle2">1 · Sản phẩm</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <TextField fullWidth required label="Tên sản phẩm" value={f.name} onChange={e => set('name')(e.target.value)}
            helperText="Mã và link (mã.html) do Portal tự tạo từ tên, không trùng." />
          <TextField sx={{ width: { md: 200 } }} type="number" label="Giá (VND)" value={f.price} onChange={e => set('price')(e.target.value)} />
        </Stack>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          <CodePick label="Danh mục" options={catalogs} value={f.catalog} onChange={set('catalog')} />
          <CodePick label="Thương hiệu" options={brands} value={f.brand} onChange={set('brand')} />
        </Stack>
        <CodePick label="Nhóm sản phẩm" multiple options={groups} value={f.groupCodes} onChange={set('groupCodes')} />

        <Typography variant="subtitle2">2 · Ảnh và video</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} flexWrap="wrap" useFlexGap>
          <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateIcon />}>
            Ảnh bìa{thumbnail ? `: ${thumbnail.name}` : ''}
            <input hidden type="file" accept="image/*" onChange={e => setThumbnail(e.target.files?.[0] || null)} />
          </Button>
          <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateIcon />}>
            Thêm ảnh ({images.length})
            <input hidden multiple type="file" accept="image/*"
              onChange={e => { const list = Array.from(e.target.files || []); setImages(cur => [...cur, ...list].slice(0, 35)); e.target.value = '' }} />
          </Button>
          <Button component="label" variant="outlined" startIcon={<VideoFileIcon />}>
            {video ? `Video: ${video.name} (${mb(video.size)})` : 'Chọn video'}
            <input hidden type="file" accept="video/*" onChange={e => setVideo(e.target.files?.[0] || null)} />
          </Button>
          {(images.length > 0 || thumbnail || video) && <Button color="inherit" onClick={() => { setImages([]); setThumbnail(null); setVideo(null) }}>Xoá file</Button>}
        </Stack>
        {previews.length > 0 && <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1 }}>
          {previews.map((p, i) => <Box key={p.url} sx={{ position: 'relative', flex: '0 0 auto' }}>
            <Box component="img" src={p.url} alt="" sx={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 1, border: 1, borderColor: 'divider' }} />
            <Button size="small" onClick={() => setImages(cur => cur.filter((_, j) => j !== i))}
              sx={{ position: 'absolute', top: 0, right: 0, minWidth: 0, p: '0 6px', bgcolor: 'rgba(255,255,255,.85)' }}>✕</Button>
          </Box>)}
        </Stack>}
        {!video && <TextField fullWidth label="Hoặc video Dailymotion (id hoặc link)" value={f.dailymotionVideoAddress}
          onChange={e => set('dailymotionVideoAddress')(e.target.value)} />}

        <Typography variant="subtitle2">3 · Đăng mạng xã hội</Typography>
        <Box>
          <FormLabel>Đăng lên</FormLabel>
          <FormGroup row>
            {PLATFORMS.map(p => <FormControlLabel key={p.value} label={p.label}
              control={<Checkbox checked={f.actions.includes(p.value)} onChange={toggle(p.value)} />} />)}
          </FormGroup>
        </Box>
        {chosen.length > 0 && <>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            <FormControlLabel control={<Switch checked={f.immediate} onChange={e => set('immediate')(e.target.checked)} />}
              label="Đăng ngay (sau 1 phút)" />
            {!f.immediate && <TextField fullWidth type="datetime-local" label="Giờ đăng (giờ Việt Nam)" value={f.scheduledAt}
              onChange={e => set('scheduledAt')(e.target.value)} InputLabelProps={{ shrink: true }}
              helperText="Sản phẩm được duyệt hiển thị khi bài đăng chạy." />}
          </Stack>
          {wantsFacebook && <>
            <TextField select fullWidth label="Facebook Page" value={f.facebookPageId} onChange={e => set('facebookPageId')(e.target.value)}
              helperText={pages.length ? '' : 'Website này chưa kết nối Facebook Page'}>
              {pages.map(p => <MenuItem key={p.pageId} value={p.pageId}>{p.name || p.pageId} · {p.pageId}</MenuItem>)}
            </TextField>
            <MessageField label="Nội dung Facebook" message={f.facebookMessage} onMessage={set('facebookMessage')}
              sequence={f.facebookSequence} onSequence={set('facebookSequence')} />
          </>}
          {wantsTikTok && <>
            <MessageField label="Nội dung TikTok" message={f.tiktokMessage} onMessage={set('tiktokMessage')}
              sequence={f.tiktokSequence} onSequence={set('tiktokSequence')} />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} flexWrap="wrap" useFlexGap>
              <TextField select sx={{ minWidth: 200 }} label="Quyền riêng tư TikTok" value={f.tiktokPrivacy} onChange={e => set('tiktokPrivacy')(e.target.value)}>
                {PRIVACY.map(p => <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>)}
              </TextField>
              <FormControlLabel label="Bình luận" control={<Checkbox checked={f.tiktokAllowComment} onChange={e => set('tiktokAllowComment')(e.target.checked)} />} />
              <FormControlLabel label="Duet" control={<Checkbox checked={f.tiktokAllowDuet} onChange={e => set('tiktokAllowDuet')(e.target.checked)} />} />
              <FormControlLabel label="Stitch" control={<Checkbox checked={f.tiktokAllowStitch} onChange={e => set('tiktokAllowStitch')(e.target.checked)} />} />
              <FormControlLabel label="Tự thêm nhạc" control={<Checkbox checked={f.tiktokAutoAddMusic} onChange={e => set('tiktokAutoAddMusic')(e.target.checked)} />} />
            </Stack>
            <FormControlLabel label="Tôi đồng ý chính sách sử dụng nhạc/nội dung của TikTok"
              control={<Checkbox checked={f.tiktokMusicConsent} onChange={e => set('tiktokMusicConsent')(e.target.checked)} />} />
          </>}
          {wantsYouTube && <MessageField label="Mô tả YouTube" message={f.youtubeDescription} onMessage={set('youtubeDescription')}
            sequence={f.youtubeSequence} onSequence={set('youtubeSequence')} />}
          <Typography variant="caption" color="text.secondary">{SEQUENCE_HELP}</Typography>
        </>}
        {problems.length > 0 && f.name && <Alert severity="info">{problems.join(' · ')}</Alert>}
        {saving && <Alert severity="info" icon={<CircularProgress size={18} />}>
          Đang tải {mb(totalUpload)} lên Portal và tạo sản phẩm… video lớn có thể mất vài phút, đừng đóng trang.
        </Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={saving}>Huỷ</Button>
      <Button variant="contained" startIcon={<RocketLaunchIcon />} onClick={submit} disabled={saving || problems.length > 0}>
        {saving ? 'Đang tạo…' : chosen.length ? `Tạo + lên lịch ${chosen.length} bài` : 'Tạo sản phẩm'}
      </Button>
    </DialogActions>
  </Dialog>
}
