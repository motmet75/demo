import { useCallback, useEffect, useRef, useState } from 'react'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CropFreeRoundedIcon from '@mui/icons-material/CropFreeRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import './DocumentScannerPage.css'

const DEFAULT_CORNERS = [
  { x: 0.07, y: 0.07 },
  { x: 0.93, y: 0.07 },
  { x: 0.93, y: 0.93 },
  { x: 0.07, y: 0.93 },
]

const CORNER_LABELS = ['Top left', 'Top right', 'Bottom right', 'Bottom left']

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function detectDocument(image) {
  const canvas = document.createElement('canvas')
  const maxSide = 420
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight))
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height)

  const sample = (x, y) => {
    const index = (y * canvas.width + x) * 4
    return [data[index], data[index + 1], data[index + 2]]
  }
  const edgeSamples = [
    sample(1, 1), sample(canvas.width - 2, 1),
    sample(canvas.width - 2, canvas.height - 2), sample(1, canvas.height - 2),
  ]
  const background = edgeSamples.reduce((result, color) => result.map((value, index) => value + color[index] / 4), [0, 0, 0])
  const rowHits = new Array(canvas.height).fill(0)
  const columnHits = new Array(canvas.width).fill(0)
  const foreground = []

  for (let y = 2; y < canvas.height - 2; y += 2) {
    for (let x = 2; x < canvas.width - 2; x += 2) {
      const color = sample(x, y)
      const difference = Math.abs(color[0] - background[0]) + Math.abs(color[1] - background[1]) + Math.abs(color[2] - background[2])
      if (difference > 88) {
        rowHits[y] += 1
        columnHits[x] += 1
        foreground.push({ x, y })
      }
    }
  }

  const rowThreshold = Math.max(3, canvas.width * 0.035)
  const columnThreshold = Math.max(3, canvas.height * 0.035)
  const top = rowHits.findIndex(hits => hits > rowThreshold)
  const bottomFromEnd = [...rowHits].reverse().findIndex(hits => hits > rowThreshold)
  const left = columnHits.findIndex(hits => hits > columnThreshold)
  const rightFromEnd = [...columnHits].reverse().findIndex(hits => hits > columnThreshold)

  if (top < 0 || left < 0 || bottomFromEnd < 0 || rightFromEnd < 0) return DEFAULT_CORNERS
  const bottom = canvas.height - 1 - bottomFromEnd
  const right = canvas.width - 1 - rightFromEnd
  if (right - left < canvas.width * 0.3 || bottom - top < canvas.height * 0.3) return DEFAULT_CORNERS

  const cornerScores = [
    point => point.x + point.y,
    point => canvas.width - point.x + point.y,
    point => canvas.width - point.x + canvas.height - point.y,
    point => point.x + canvas.height - point.y,
  ]
  const tolerance = (canvas.width + canvas.height) * 0.018
  const detected = cornerScores.map(score => {
    const minimum = foreground.reduce((value, point) => Math.min(value, score(point)), Infinity)
    const candidates = foreground.filter(point => score(point) <= minimum + tolerance)
    const average = candidates.reduce((result, point) => ({ x: result.x + point.x / candidates.length, y: result.y + point.y / candidates.length }), { x: 0, y: 0 })
    return {
      x: Math.max(0.01, Math.min(0.99, average.x / canvas.width)),
      y: Math.max(0.01, Math.min(0.99, average.y / canvas.height)),
    }
  })
  const polygonArea = Math.abs(detected.reduce((area, point, index) => {
    const next = detected[(index + 1) % detected.length]
    return area + point.x * next.y - next.x * point.y
  }, 0) / 2)
  if (polygonArea < 0.12) return DEFAULT_CORNERS
  return detected
}

function distance(a, b, width, height) {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height)
}

function enhancePixel(red, green, blue, filter) {
  if (filter === 'original') return [red, green, blue]
  const gray = red * 0.299 + green * 0.587 + blue * 0.114
  if (filter === 'grayscale') {
    const value = Math.max(0, Math.min(255, (gray - 128) * 1.18 + 134))
    return [value, value, value]
  }
  const value = gray > 154 ? 255 : gray < 90 ? 0 : (gray - 90) * 3.98
  return [value, value, value]
}

function correctPerspective(image, corners, filter) {
  const sourceScale = Math.min(1, 2600 / Math.max(image.naturalWidth, image.naturalHeight))
  const sourceWidth = Math.max(1, Math.round(image.naturalWidth * sourceScale))
  const sourceHeight = Math.max(1, Math.round(image.naturalHeight * sourceScale))
  const top = distance(corners[0], corners[1], sourceWidth, sourceHeight)
  const bottom = distance(corners[3], corners[2], sourceWidth, sourceHeight)
  const left = distance(corners[0], corners[3], sourceWidth, sourceHeight)
  const right = distance(corners[1], corners[2], sourceWidth, sourceHeight)
  const rawWidth = Math.max(1, Math.round((top + bottom) / 2))
  const rawHeight = Math.max(1, Math.round((left + right) / 2))
  const scale = Math.min(1, 1800 / Math.max(rawWidth, rawHeight))
  const outputWidth = Math.max(1, Math.round(rawWidth * scale))
  const outputHeight = Math.max(1, Math.round(rawHeight * scale))

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = sourceWidth
  sourceCanvas.height = sourceHeight
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
  sourceContext.drawImage(image, 0, 0)
  const sourcePixels = sourceContext.getImageData(0, 0, sourceWidth, sourceHeight).data

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = outputWidth
  outputCanvas.height = outputHeight
  const outputContext = outputCanvas.getContext('2d')
  const output = outputContext.createImageData(outputWidth, outputHeight)
  const points = corners.map(point => ({ x: point.x * (sourceWidth - 1), y: point.y * (sourceHeight - 1) }))

  for (let y = 0; y < outputHeight; y += 1) {
    const v = outputHeight === 1 ? 0 : y / (outputHeight - 1)
    for (let x = 0; x < outputWidth; x += 1) {
      const u = outputWidth === 1 ? 0 : x / (outputWidth - 1)
      const sourceX = (1 - u) * (1 - v) * points[0].x + u * (1 - v) * points[1].x + u * v * points[2].x + (1 - u) * v * points[3].x
      const sourceY = (1 - u) * (1 - v) * points[0].y + u * (1 - v) * points[1].y + u * v * points[2].y + (1 - u) * v * points[3].y
      const sx = Math.max(0, Math.min(sourceWidth - 1, Math.round(sourceX)))
      const sy = Math.max(0, Math.min(sourceHeight - 1, Math.round(sourceY)))
      const sourceIndex = (sy * sourceWidth + sx) * 4
      const outputIndex = (y * outputWidth + x) * 4
      const [red, green, blue] = enhancePixel(sourcePixels[sourceIndex], sourcePixels[sourceIndex + 1], sourcePixels[sourceIndex + 2], filter)
      output.data[outputIndex] = red
      output.data[outputIndex + 1] = green
      output.data[outputIndex + 2] = blue
      output.data[outputIndex + 3] = 255
    }
  }
  outputContext.putImageData(output, 0, 0)
  return outputCanvas
}

function dataUrlToBytes(dataUrl) {
  const binary = atob(dataUrl.split(',')[1])
  return Uint8Array.from(binary, character => character.charCodeAt(0))
}

function canvasToPdf(canvas) {
  const jpegBytes = dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.92))
  const pageWidth = 595.28
  const pageHeight = 841.89
  const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height)
  const imageWidth = canvas.width * scale
  const imageHeight = canvas.height * scale
  const x = (pageWidth - imageWidth) / 2
  const y = (pageHeight - imageHeight) / 2
  const stream = `q\n${imageWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`
  const encoder = new TextEncoder()
  const objects = [
    encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encoder.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`),
    encoder.encode(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`),
    null,
  ]
  const imageHeader = encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`)
  const imageFooter = encoder.encode('\nendstream')
  objects[4] = new Uint8Array(imageHeader.length + jpegBytes.length + imageFooter.length)
  objects[4].set(imageHeader)
  objects[4].set(jpegBytes, imageHeader.length)
  objects[4].set(imageFooter, imageHeader.length + jpegBytes.length)

  const chunks = [encoder.encode('%PDF-1.4\n% scan\n')]
  const offsets = [0]
  let length = chunks[0].length
  objects.forEach((object, index) => {
    offsets.push(length)
    const header = encoder.encode(`${index + 1} 0 obj\n`)
    const footer = encoder.encode('\nendobj\n')
    chunks.push(header, object, footer)
    length += header.length + object.length + footer.length
  })
  const xrefOffset = length
  const xref = `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  chunks.push(encoder.encode(xref))
  return new Blob(chunks, { type: 'application/pdf' })
}

function canvasToBlob(canvas, format) {
  if (format === 'pdf') return Promise.resolve(canvasToPdf(canvas))
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  return new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.94))
}

export default function DocumentScannerPage() {
  const [sourceUrl, setSourceUrl] = useState('')
  const [fileName, setFileName] = useState('scan')
  const [corners, setCorners] = useState(DEFAULT_CORNERS)
  const [filter, setFilter] = useState('document')
  const [format, setFormat] = useState('pdf')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewUrl, setPreviewUrl] = useState('')
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }, [])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const analyzeSource = useCallback(async url => {
    const image = await loadImage(url)
    setCorners(detectDocument(image))
    setStatus('Edges detected — drag any corner to fine-tune.')
  }, [])

  const applySource = useCallback(async (url, name = 'scan') => {
    if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl)
    setSourceUrl(url)
    setFileName(name.replace(/\.[^.]+$/, '') || 'scan')
    setPreviewUrl(current => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
    setBusy(true)
    try {
      await analyzeSource(url)
    } catch {
      setStatus('This image could not be opened. Please choose another file.')
    } finally {
      setBusy(false)
    }
  }, [analyzeSource, sourceUrl])

  const handleFile = async event => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setStatus('Choose an image file. PDF is available as an export format.')
      return
    }
    const dataUrl = await fileToDataUrl(file)
    applySource(dataUrl, file.name)
  }

  const openCamera = async () => {
    setCameraError('')
    setCameraOpen(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch {
      setCameraError('Camera access was blocked. Allow camera permission or upload a photo instead.')
    }
  }

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video?.videoWidth) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d').drawImage(video, 0, 0)
    const url = canvas.toDataURL('image/jpeg', 0.95)
    closeCamera()
    applySource(url, `scan-${new Date().toISOString().slice(0, 10)}`)
  }

  const updateCorner = (index, clientX, clientY) => {
    const rect = editorRef.current?.getBoundingClientRect()
    if (!rect) return
    const nextPoint = {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
    setCorners(current => current.map((point, pointIndex) => pointIndex === index ? nextPoint : point))
    setPreviewUrl(current => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
  }

  const handleCornerPointerDown = (event, index) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    updateCorner(index, event.clientX, event.clientY)
  }

  const createOutput = async () => {
    setBusy(true)
    setStatus('Straightening and enhancing your document…')
    try {
      const image = await loadImage(sourceUrl)
      const canvas = correctPerspective(image, corners, filter)
      const blob = await canvasToBlob(canvas, format)
      const nextUrl = URL.createObjectURL(blob)
      setPreviewUrl(current => {
        if (current) URL.revokeObjectURL(current)
        return nextUrl
      })
      setStatus('Your scan is ready to download or share.')
      return { blob, url: nextUrl }
    } catch {
      setStatus('We could not create this scan. Try moving the corners slightly inward.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const downloadScan = async () => {
    const result = await createOutput()
    if (!result) return
    const link = document.createElement('a')
    link.href = result.url
    link.download = `${fileName}-scanned.${format === 'jpeg' ? 'jpg' : format}`
    link.click()
  }

  const shareScan = async () => {
    const result = await createOutput()
    if (!result) return
    const extension = format === 'jpeg' ? 'jpg' : format
    const file = new File([result.blob], `${fileName}-scanned.${extension}`, { type: result.blob.type })
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ title: 'Scanned document', files: [file] })
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }
    setStatus('Sharing is not supported in this browser. Your scan has been downloaded instead.')
    const link = document.createElement('a')
    link.href = result.url
    link.download = file.name
    link.click()
  }

  const resetScan = () => {
    if (sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(sourceUrl)
    setSourceUrl('')
    setCorners(DEFAULT_CORNERS)
    setStatus('')
    setPreviewUrl(current => {
      if (current) URL.revokeObjectURL(current)
      return ''
    })
  }

  const polygon = corners.map(point => `${point.x * 100},${point.y * 100}`).join(' ')

  return (
    <main className="document-scanner">
      <header className="scanner-header">
        <div>
          <span className="scanner-eyebrow">Smart capture</span>
          <h1>Document Scanner</h1>
          <p>Capture, straighten and share clean documents in seconds.</p>
        </div>
        <div className="scanner-privacy"><span>✓</span> Processed privately on this device</div>
      </header>

      {!sourceUrl ? (
        <section className="scanner-start-card">
          <div className="scanner-illustration" aria-hidden="true">
            <div className="scanner-paper"><span /><span /><span /><span /></div>
            <i className="corner corner-tl" /><i className="corner corner-tr" /><i className="corner corner-br" /><i className="corner corner-bl" />
          </div>
          <div className="scanner-start-copy">
            <span className="step-pill">Step 1 of 3</span>
            <h2>Add a document</h2>
            <p>Place the whole page in view with good light. We’ll find its edges automatically.</p>
            <div className="scanner-primary-actions">
              <button className="scanner-button scanner-button-primary" onClick={openCamera}>
                <CameraAltRoundedIcon /> Open camera
              </button>
              <button className="scanner-button scanner-button-secondary" onClick={() => fileInputRef.current?.click()}>
                <FileUploadOutlinedIcon /> Upload photo
              </button>
            </div>
            <input ref={fileInputRef} className="scanner-file-input" type="file" accept="image/*" capture="environment" onChange={handleFile} />
            <p className="scanner-file-help">JPG, PNG, WEBP or HEIC · up to your browser’s file limit</p>
            {status && <div className="scanner-message">{status}</div>}
          </div>
        </section>
      ) : (
        <div className="scanner-workspace">
          <section className="scanner-editor-card">
            <div className="scanner-card-heading">
              <div><span className="step-pill">Step 2 of 3</span><h2>Adjust the corners</h2></div>
              <button className="scanner-icon-button" onClick={resetScan} title="Remove photo"><CloseRoundedIcon /></button>
            </div>
            <p className="scanner-instruction"><CropFreeRoundedIcon /> Drag the four handles so they sit exactly on the document.</p>
            <div className="scanner-editor-stage">
              <div className="scanner-image-wrap" ref={editorRef}>
                <img src={sourceUrl} alt="Document to crop" draggable="false" />
                <svg className="scanner-crop-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  <defs><mask id="crop-mask"><rect width="100" height="100" fill="white" /><polygon points={polygon} fill="black" /></mask></defs>
                  <rect width="100" height="100" fill="rgba(4, 16, 35, .58)" mask="url(#crop-mask)" />
                  <polygon points={polygon} fill="none" stroke="#5de1c3" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
                </svg>
                {corners.map((point, index) => (
                  <button
                    key={CORNER_LABELS[index]}
                    className="scanner-corner-handle"
                    aria-label={`Move ${CORNER_LABELS[index]} corner`}
                    style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                    onPointerDown={event => handleCornerPointerDown(event, index)}
                    onPointerMove={event => {
                      if (event.currentTarget.hasPointerCapture(event.pointerId)) updateCorner(index, event.clientX, event.clientY)
                    }}
                  />
                ))}
              </div>
            </div>
            <button className="scanner-auto-button" onClick={() => analyzeSource(sourceUrl)} disabled={busy}>
              <AutoAwesomeOutlinedIcon /> Detect edges again
            </button>
          </section>

          <aside className="scanner-settings-card">
            <div><span className="step-pill">Step 3 of 3</span><h2>Finish your scan</h2></div>
            <div className="scanner-fieldset">
              <label>Enhancement</label>
              <div className="scanner-segmented">
                {[
                  ['document', 'Clean'], ['grayscale', 'B&W'], ['original', 'Original'],
                ].map(([value, label]) => (
                  <button key={value} className={filter === value ? 'active' : ''} onClick={() => setFilter(value)}>
                    {filter === value && <CheckRoundedIcon />} {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="scanner-fieldset">
              <label>Export as</label>
              <div className="scanner-format-grid">
                {[
                  ['pdf', 'PDF', 'Best for documents'],
                  ['jpeg', 'JPG', 'Small & compatible'],
                  ['png', 'PNG', 'Highest detail'],
                ].map(([value, label, hint]) => (
                  <button key={value} className={format === value ? 'active' : ''} onClick={() => setFormat(value)}>
                    <strong>{label}</strong><span>{hint}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="scanner-export-actions">
              <button className="scanner-button scanner-button-primary" onClick={downloadScan} disabled={busy}>
                <DownloadRoundedIcon /> {busy ? 'Creating…' : 'Download scan'}
              </button>
              <button className="scanner-button scanner-button-secondary" onClick={shareScan} disabled={busy}>
                <IosShareRoundedIcon /> Share
              </button>
              <button className="scanner-add-another" onClick={() => fileInputRef.current?.click()}><AddPhotoAlternateOutlinedIcon /> Choose another photo</button>
              <input ref={fileInputRef} className="scanner-file-input" type="file" accept="image/*" capture="environment" onChange={handleFile} />
            </div>
            {status && <div className="scanner-message">{status}</div>}
            {previewUrl && format !== 'pdf' && <img className="scanner-result-preview" src={previewUrl} alt="Corrected scan preview" />}
          </aside>
        </div>
      )}

      <section className="scanner-how-it-works">
        <div><b>1</b><span><strong>Capture</strong><small>Camera or photo</small></span></div>
        <i />
        <div><b>2</b><span><strong>Adjust</strong><small>Auto or manual edges</small></span></div>
        <i />
        <div><b>3</b><span><strong>Export</strong><small>PDF, JPG or PNG</small></span></div>
      </section>

      {cameraOpen && (
        <div className="scanner-camera-modal" role="dialog" aria-modal="true" aria-label="Document camera">
          <div className="scanner-camera-frame">
            <button className="scanner-camera-close" onClick={closeCamera} aria-label="Close camera"><CloseRoundedIcon /></button>
            <video ref={videoRef} playsInline muted />
            <div className="scanner-camera-guide"><span /><span /><span /><span /></div>
            <p>{cameraError || 'Keep the document inside the frame and hold steady.'}</p>
            {!cameraError && <button className="scanner-shutter" onClick={capturePhoto} aria-label="Take photo"><span /></button>}
            {cameraError && <button className="scanner-button scanner-button-secondary" onClick={() => fileInputRef.current?.click()}>Upload a photo</button>}
          </div>
        </div>
      )}
    </main>
  )
}
