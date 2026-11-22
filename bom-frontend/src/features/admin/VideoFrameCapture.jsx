import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Box, Button, ButtonGroup, Stack, TextField, Typography } from '@mui/material'
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera'
import WallpaperIcon from '@mui/icons-material/Wallpaper'

// Play the chosen video, pause on an exact frame and take a JPEG of it.
// Frame numbers are counted from 0 using the frame rate below (browsers do
// not expose the real rate, so it is editable; 30 fits most phone videos).

const clampInt = (v, min, max) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)))
const timeLabel = s => {
  if (!Number.isFinite(s)) return '0:00.00'
  const m = Math.floor(s / 60)
  return `${m}:${(s - m * 60).toFixed(2).padStart(5, '0')}`
}

export default function VideoFrameCapture({ file, baseName, onGallery, onThumbnail, galleryFull }) {
  const videoRef = useRef(null)
  // The parent keys this component by file, so state starts fresh for each video.
  const url = useMemo(() => URL.createObjectURL(file), [file])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  const [fps, setFps] = useState(30)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [goTo, setGoTo] = useState('')
  const [error, setError] = useState('')
  const [flash, setFlash] = useState('')

  // Keep the frame counter exact while playing (requestVideoFrameCallback) or after seeks.
  useEffect(() => {
    const v = videoRef.current
    if (!v || !url) return undefined
    let handle = null
    const tick = (_, meta) => { setTime(meta?.mediaTime ?? v.currentTime); handle = v.requestVideoFrameCallback(tick) }
    if (v.requestVideoFrameCallback) handle = v.requestVideoFrameCallback(tick)
    const onTime = () => setTime(v.currentTime)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('seeked', onTime)
    return () => {
      if (handle != null && v.cancelVideoFrameCallback) v.cancelVideoFrameCallback(handle)
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('seeked', onTime)
    }
  }, [url])

  const rate = clampInt(fps, 1, 240)
  // Browsers round frame times to microseconds (frame 10 at 30 fps reports
  // 0.333333s), so allow a small tolerance before flooring.
  const lastFrame = duration ? Math.max(0, Math.floor(duration * rate) - 1) : 0
  const rawFrame = Math.floor(time * rate + 0.01)
  const frame = lastFrame ? Math.min(rawFrame, lastFrame) : rawFrame

  const seekFrame = n => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    const target = clampInt(n, 0, lastFrame || Number.MAX_SAFE_INTEGER)
    // Middle of the frame, so rounding never lands on the previous one.
    v.currentTime = Math.min((target + 0.5) / rate, Math.max(0, (duration || Infinity) - 0.001))
  }

  const capture = async target => {
    const v = videoRef.current
    if (!v || !v.videoWidth) { setError('Video chưa tải xong khung hình.'); return }
    v.pause()
    const canvas = document.createElement('canvas')
    canvas.width = v.videoWidth; canvas.height = v.videoHeight
    canvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.92))
    if (!blob) { setError('Không chụp được khung hình này.'); return }
    const shot = new File([blob], `${baseName || 'video'}-frame-${frame}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
    if (target === 'thumbnail') onThumbnail(shot); else onGallery(shot)
    setFlash(target === 'thumbnail' ? `Đã đặt khung ${frame} làm ảnh bìa` : `Đã thêm khung ${frame} vào thư viện ảnh`)
  }

  return <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
    <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>Chụp ảnh từ video</Typography>
    {error && <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setError('')}>{error}</Alert>}
    <Box component="video" ref={videoRef} src={url} controls playsInline preload="auto"
      onLoadedMetadata={e => setDuration(e.currentTarget.duration || 0)}
      onError={() => setError('Trình duyệt không phát được video này (ví dụ HEVC/.mov). Vẫn có thể tải video lên, nhưng không chụp được khung.')}
      sx={{ width: '100%', maxHeight: 360, bgcolor: 'black', borderRadius: 1, display: 'block' }} />
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }} sx={{ mt: 1 }} flexWrap="wrap" useFlexGap>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 190 }}>
        Khung <b>{frame}</b>{lastFrame ? ` / ${lastFrame}` : ''} · {timeLabel(time)}
      </Typography>
      <ButtonGroup size="small" variant="outlined">
        <Button onClick={() => seekFrame(frame - 10)} title="Lùi 10 khung">−10</Button>
        <Button onClick={() => seekFrame(frame - 1)} title="Lùi 1 khung">−1</Button>
        <Button onClick={() => seekFrame(frame + 1)} title="Tới 1 khung">+1</Button>
        <Button onClick={() => seekFrame(frame + 10)} title="Tới 10 khung">+10</Button>
      </ButtonGroup>
      <Stack direction="row" spacing={1} alignItems="center">
        <TextField size="small" type="number" label="Tới khung số" value={goTo} sx={{ width: 130 }}
          onChange={e => setGoTo(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); seekFrame(goTo) } }} />
        <Button size="small" onClick={() => seekFrame(goTo)} disabled={goTo === ''}>Đi</Button>
      </Stack>
      <TextField size="small" type="number" label="Khung/giây" value={fps} sx={{ width: 100 }}
        onChange={e => setFps(e.target.value)} onBlur={() => setFps(rate)} />
    </Stack>
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1 }}>
      <Button variant="contained" size="small" startIcon={<PhotoCameraIcon />} onClick={() => capture('gallery')} disabled={galleryFull || !!error}>
        Chụp → thư viện ảnh
      </Button>
      <Button variant="outlined" size="small" startIcon={<WallpaperIcon />} onClick={() => capture('thumbnail')} disabled={!!error}>
        Chụp → ảnh bìa
      </Button>
      {galleryFull && <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>Thư viện đã đủ 35 ảnh</Typography>}
    </Stack>
    {flash && <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>{flash}</Typography>}
  </Box>
}
