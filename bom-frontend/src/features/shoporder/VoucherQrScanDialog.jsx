import React, { useCallback, useEffect, useRef, useState } from 'react'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import CameraAltIcon from '@mui/icons-material/CameraAlt'
import UploadFileIcon from '@mui/icons-material/UploadFile'
import QrCode2Icon from '@mui/icons-material/QrCode2'

export default function VoucherQrScanDialog({ open, onClose, onScan }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const detectedRef = useRef(false)

  const [manualValue, setManualValue] = useState('')
  const [starting, setStarting] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  const scannerSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    setStreaming(false)
  }, [])

  const handleDetected = useCallback((rawValue) => {
    const value = String(rawValue || '').trim()
    if (!value || detectedRef.current) return
    detectedRef.current = true
    stopCamera()
    onScan?.(value)
  }, [onScan, stopCamera])

  const startCamera = useCallback(async () => {
    if (!scannerSupported) {
      setError('Camera QR scanning is not supported by this browser.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera access is not available in this browser.')
      return
    }

    setStarting(true)
    setError('')
    detectedRef.current = false
    stopCamera()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()
      setStreaming(true)

      const Detector = window.BarcodeDetector
      const detector = new Detector({ formats: ['qr_code'] })

      const scanFrame = async () => {
        if (!streamRef.current || detectedRef.current) return
        try {
          if (video.readyState >= 2) {
            const codes = await detector.detect(video)
            if (codes.length > 0) {
              handleDetected(codes[0].rawValue)
              return
            }
          }
        } catch {
          // Some browsers throw while the video metadata settles; keep scanning.
        }
        rafRef.current = window.requestAnimationFrame(scanFrame)
      }

      rafRef.current = window.requestAnimationFrame(scanFrame)
    } catch (e) {
      setError(e?.message || 'Unable to start camera.')
      stopCamera()
    } finally {
      setStarting(false)
    }
  }, [handleDetected, scannerSupported, stopCamera])

  const decodeImageFile = async (file) => {
    if (!file) return
    if (!scannerSupported || !window.createImageBitmap) {
      setError('Image QR scanning is not supported by this browser.')
      return
    }
    setError('')
    try {
      const Detector = window.BarcodeDetector
      const detector = new Detector({ formats: ['qr_code'] })
      const bitmap = await window.createImageBitmap(file)
      const codes = await detector.detect(bitmap)
      bitmap.close?.()
      if (codes.length > 0) handleDetected(codes[0].rawValue)
      else setError('No QR code found in image.')
    } catch (e) {
      setError(e?.message || 'Unable to read image.')
    }
  }

  useEffect(() => {
    if (!open) return undefined
    setManualValue('')
    setError('')
    detectedRef.current = false
    startCamera()
    return stopCamera
  }, [open, startCamera, stopCamera])

  const submitManual = () => {
    const value = manualValue.trim()
    if (!value) return
    handleDetected(value)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
        <QrCode2Icon color="primary" /> Scan Voucher QR
      </DialogTitle>
      <DialogContent sx={{ pt: '8px !important', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {error && <Alert severity="warning">{error}</Alert>}

        <Box sx={{
          position: 'relative',
          bgcolor: '#0f172a',
          borderRadius: 2,
          overflow: 'hidden',
          aspectRatio: '4 / 3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {scannerSupported ? (
            <>
              <video
                ref={videoRef}
                muted
                playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: streaming ? 'block' : 'none' }}
              />
              {!streaming && (
                <Box sx={{ textAlign: 'center', color: '#e2e8f0' }}>
                  {starting ? <CircularProgress size={28} sx={{ color: '#fff' }} /> : <CameraAltIcon sx={{ fontSize: 40 }} />}
                  <Typography variant="body2" sx={{ mt: 1 }}>{starting ? 'Starting camera' : 'Camera paused'}</Typography>
                </Box>
              )}
              <Chip
                size="small"
                label={streaming ? 'Camera active' : 'Camera'}
                color={streaming ? 'success' : 'default'}
                sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 700 }}
              />
            </>
          ) : (
            <Box sx={{ textAlign: 'center', color: '#e2e8f0', px: 2 }}>
              <QrCode2Icon sx={{ fontSize: 42, mb: 1 }} />
              <Typography variant="body2">Manual entry available</Typography>
            </Box>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={starting ? <CircularProgress size={14} /> : <CameraAltIcon />}
            onClick={startCamera}
            disabled={starting || !scannerSupported}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Start Camera
          </Button>
          <Button
            size="small"
            variant="outlined"
            component="label"
            startIcon={<UploadFileIcon />}
            disabled={!scannerSupported}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Image
            <input
              hidden
              type="file"
              accept="image/*"
              capture="environment"
              onChange={e => decodeImageFile(e.target.files?.[0])}
            />
          </Button>
        </Box>

        <TextField
          label="Voucher code or QR payload"
          size="small"
          fullWidth
          value={manualValue}
          onChange={e => setManualValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitManual() }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={() => { stopCamera(); onClose?.() }} sx={{ textTransform: 'none' }}>Cancel</Button>
        <Button
          variant="contained"
          onClick={submitManual}
          disabled={!manualValue.trim()}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          Use
        </Button>
      </DialogActions>
    </Dialog>
  )
}
