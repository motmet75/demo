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
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

export default function VoucherQrScanDialog({ open, onClose, onScan, title = 'Scan Voucher QR', manualLabel = 'Voucher code or QR payload', scannerLabel = 'Camera or image scanner' }) {
  const scannerRef = useRef(null)
  const detectedRef = useRef(false)
  const readerIdRef = useRef(`voucher-qr-reader-${Math.random().toString(36).slice(2)}`)

  const [manualValue, setManualValue] = useState('')
  const [starting, setStarting] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [error, setError] = useState('')

  const cameraSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  const stopCamera = useCallback(async () => {
    const scanner = scannerRef.current
    scannerRef.current = null
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop()
      } catch {
        // Ignore stop errors caused by browser camera teardown timing.
      }
      try {
        await scanner.clear()
      } catch {
        // The element may already be cleared during dialog close.
      }
    }
    setStreaming(false)
  }, [])

  const handleDetected = useCallback((rawValue) => {
    const value = String(rawValue || '').trim()
    if (!value || detectedRef.current) return
    detectedRef.current = true
    void stopCamera()
    onScan?.(value)
  }, [onScan, stopCamera])

  const createScanner = useCallback(() => new Html5Qrcode(readerIdRef.current, {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    verbose: false,
  }), [])

  const startCamera = useCallback(async () => {
    if (!cameraSupported) {
      setError('Camera access is not available in this browser. Use image upload or manual entry.')
      return
    }

    setStarting(true)
    setError('')
    detectedRef.current = false
    await stopCamera()

    try {
      const scanner = createScanner()
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: (width, height) => {
            const size = Math.floor(Math.min(width, height) * 0.72)
            return { width: size, height: size }
          },
        },
        decodedText => handleDetected(decodedText),
        () => {}
      )
      setStreaming(true)
    } catch (e) {
      setError(e?.message || 'Unable to start camera.')
      await stopCamera()
    } finally {
      setStarting(false)
    }
  }, [cameraSupported, createScanner, handleDetected, stopCamera])

  const decodeImageFile = async (file) => {
    if (!file) return
    setError('')
    detectedRef.current = false
    await stopCamera()

    const scanner = createScanner()
    scannerRef.current = scanner
    try {
      const decodedText = await scanner.scanFile(file, true)
      handleDetected(decodedText)
    } catch (e) {
      setError(e?.message || 'No QR code found in image.')
      try { await scanner.clear() } catch { /* ignore */ }
      if (scannerRef.current === scanner) scannerRef.current = null
    }
  }

  useEffect(() => {
    if (!open) return undefined
    setManualValue('')
    setError('')
    detectedRef.current = false
    void startCamera()
    return () => { void stopCamera() }
  }, [open, startCamera, stopCamera])

  const submitManual = () => {
    const value = manualValue.trim()
    if (!value) return
    handleDetected(value)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: 800 }}>
        <QrCode2Icon color="primary" /> {title}
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
          '& video': { width: '100% !important', height: '100% !important', objectFit: 'cover' },
          '& img': { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
        }}>
          <Box id={readerIdRef.current} sx={{ position: 'absolute', inset: 0 }} />
          {!streaming && !starting && (
            <Box sx={{ textAlign: 'center', color: '#e2e8f0', px: 2, zIndex: 1, pointerEvents: 'none' }}>
              <QrCode2Icon sx={{ fontSize: 42, mb: 1 }} />
              <Typography variant="body2">{scannerLabel}</Typography>
            </Box>
          )}
          {starting && (
            <Box sx={{ textAlign: 'center', color: '#e2e8f0', zIndex: 1 }}>
              <CircularProgress size={28} sx={{ color: '#fff' }} />
              <Typography variant="body2" sx={{ mt: 1 }}>Starting camera</Typography>
            </Box>
          )}
          <Chip
            size="small"
            label={streaming ? 'Camera active' : 'Scanner'}
            color={streaming ? 'success' : 'default'}
            sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 700, zIndex: 2 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={starting ? <CircularProgress size={14} /> : <CameraAltIcon />}
            onClick={startCamera}
            disabled={starting || !cameraSupported}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Start Camera
          </Button>
          <Button
            size="small"
            variant="outlined"
            component="label"
            startIcon={<UploadFileIcon />}
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
          label={manualLabel}
          size="small"
          fullWidth
          value={manualValue}
          onChange={e => setManualValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submitManual() }}
        />
      </DialogContent>
      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={() => { void stopCamera(); onClose?.() }} sx={{ textTransform: 'none' }}>Cancel</Button>
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
