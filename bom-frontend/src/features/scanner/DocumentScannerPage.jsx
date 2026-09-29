import { useCallback, useEffect, useRef, useState } from 'react'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined'
import CropFreeRoundedIcon from '@mui/icons-material/CropFreeRounded'
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded'
import IosShareRoundedIcon from '@mui/icons-material/IosShareRounded'
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined'
import CloseRoundedIcon from '@mui/icons-material/CloseRounded'
import CheckRoundedIcon from '@mui/icons-material/CheckRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import FolderZipOutlinedIcon from '@mui/icons-material/FolderZipOutlined'
import { unzip } from 'fflate'
import { apiFetch } from '../../api/client'
import './DocumentScannerPage.css'

const DEFAULT_CORNERS = [
  { x: 0.07, y: 0.07 },
  { x: 0.93, y: 0.07 },
  { x: 0.93, y: 0.93 },
  { x: 0.07, y: 0.93 },
]

const CORNER_LABELS = ['Top left', 'Top right', 'Bottom right', 'Bottom left']
const IMAGE_EXTENSION = /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i
const MAX_ZIP_BYTES = 200 * 1024 * 1024
const MAX_ZIP_IMAGE_BYTES = 20 * 1024 * 1024
const MAX_ZIP_IMAGES = 250
const MAX_EXTRACTED_BYTES = 350 * 1024 * 1024

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

function imageMimeType(name) {
  const extension = name.split('.').pop()?.toLowerCase()
  return {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', bmp: 'image/bmp', heic: 'image/heic', heif: 'image/heif',
  }[extension] || 'application/octet-stream'
}

function dosTimestamp(date, time) {
  if (!date) return 0
  const value = new Date(
    ((date >> 9) & 0x7f) + 1980,
    Math.max(0, ((date >> 5) & 0x0f) - 1),
    date & 0x1f,
    (time >> 11) & 0x1f,
    (time >> 5) & 0x3f,
    (time & 0x1f) * 2,
  ).getTime()
  return Number.isFinite(value) ? value : 0
}

function readZipMetadata(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const minimum = Math.max(0, bytes.length - 65557)
  let directoryEnd = -1
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) {
      directoryEnd = offset
      break
    }
  }
  if (directoryEnd < 0) throw new Error('ZIP directory not found')
  const entryCount = view.getUint16(directoryEnd + 10, true)
  let offset = view.getUint32(directoryEnd + 16, true)
  const decoder = new TextDecoder('utf-8')
  const metadata = new Map()
  for (let index = 0; index < entryCount && offset + 46 <= bytes.length; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break
    const time = view.getUint16(offset + 12, true)
    const date = view.getUint16(offset + 14, true)
    const nameLength = view.getUint16(offset + 28, true)
    const extraLength = view.getUint16(offset + 30, true)
    const commentLength = view.getUint16(offset + 32, true)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    metadata.set(name, { modifiedAt: dosTimestamp(date, time) })
    offset += 46 + nameLength + extraLength + commentLength
  }
  return metadata
}

function unzipImages(file) {
  if (file.size > MAX_ZIP_BYTES) return Promise.reject(new Error('ZIP files must be 200 MB or smaller.'))
  return file.arrayBuffer().then(buffer => new Promise((resolve, reject) => {
    const archive = new Uint8Array(buffer)
    let metadata
    try {
      metadata = readZipMetadata(archive)
    } catch {
      metadata = new Map()
    }
    unzip(archive, {
      filter(entry) {
        return IMAGE_EXTENSION.test(entry.name)
          && !entry.name.startsWith('__MACOSX/')
          && entry.originalSize <= MAX_ZIP_IMAGE_BYTES
      },
    }, (error, extracted) => {
      if (error) {
        reject(new Error('The ZIP archive could not be extracted.'))
        return
      }
      const entries = Object.entries(extracted)
        .filter(([name]) => IMAGE_EXTENSION.test(name))
        .map(([name, data]) => ({
          name,
          data,
          modifiedAt: metadata.get(name)?.modifiedAt || file.lastModified || 0,
        }))
      const totalBytes = entries.reduce((sum, entry) => sum + entry.data.byteLength, 0)
      if (entries.length > MAX_ZIP_IMAGES) {
        reject(new Error(`This ZIP contains more than ${MAX_ZIP_IMAGES} images.`))
      } else if (totalBytes > MAX_EXTRACTED_BYTES) {
        reject(new Error('The extracted images are larger than 350 MB.'))
      } else {
        resolve(entries)
      }
    })
  }))
}

function comparePages(first, second, mode) {
  if (mode === 'time') {
    const timeDifference = (first.modifiedAt || 0) - (second.modifiedAt || 0)
    if (timeDifference) return timeDifference
  }
  return first.sortName.localeCompare(second.sortName, undefined, { numeric: true, sensitivity: 'base' })
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
  const scale = Math.min(1, 2048 / Math.max(rawWidth, rawHeight))
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

function imageObject(jpegBytes, width, height) {
  const encoder = new TextEncoder()
  const header = encoder.encode(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`)
  const footer = encoder.encode('\nendstream')
  const object = new Uint8Array(header.length + jpegBytes.length + footer.length)
  object.set(header)
  object.set(jpegBytes, header.length)
  object.set(footer, header.length + jpegBytes.length)
  return object
}

async function blobToJpegPage(blob) {
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    canvas.getContext('2d').drawImage(image, 0, 0)
    return { bytes: dataUrlToBytes(canvas.toDataURL('image/jpeg', 0.94)), width: canvas.width, height: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function blobsToPdf(blobs) {
  const pages = await Promise.all(blobs.map(blobToJpegPage))
  const pageWidth = 595.28
  const pageHeight = 841.89
  const encoder = new TextEncoder()
  const pageIds = pages.map((_, index) => 3 + index * 3)
  const objects = [
    encoder.encode('<< /Type /Catalog /Pages 2 0 R >>'),
    encoder.encode(`<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`),
  ]
  pages.forEach((page, index) => {
    const pageId = pageIds[index]
    const contentId = pageId + 1
    const imageId = pageId + 2
    const scale = Math.min(pageWidth / page.width, pageHeight / page.height)
    const imageWidth = page.width * scale
    const imageHeight = page.height * scale
    const x = (pageWidth - imageWidth) / 2
    const y = (pageHeight - imageHeight) / 2
    const stream = `q\n${imageWidth.toFixed(2)} 0 0 ${imageHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm\n/Im0 Do\nQ\n`
    objects.push(
      encoder.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`),
      encoder.encode(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`),
      imageObject(page.bytes, page.width, page.height),
    )
  })

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
  const objectCount = objects.length + 1
  const xref = `xref\n0 ${objectCount}\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  chunks.push(encoder.encode(xref))
  return new Blob(chunks, { type: 'application/pdf' })
}

function canvasToBlob(canvas, format = 'jpeg') {
  const mimeType = format === 'png' ? 'image/png' : 'image/jpeg'
  return new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.94))
}

export default function DocumentScannerPage() {
  const [pages, setPages] = useState([])
  const [activeId, setActiveId] = useState(null)
  const [format, setFormat] = useState('pdf')
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState('adjust')
  const [magnifier, setMagnifier] = useState(null)
  const [sortMode, setSortMode] = useState('manual')
  const [draggedPageId, setDraggedPageId] = useState(null)
  const pagesRef = useRef([])
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const editorRef = useRef(null)
  const fileInputRef = useRef(null)
  const activePage = pages.find(page => page.id === activeId) || pages[0] || null

  useEffect(() => {
    pagesRef.current = pages
  }, [pages])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    pagesRef.current.forEach(page => {
      if (page.previewUrl) URL.revokeObjectURL(page.previewUrl)
      if (page.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(page.sourceUrl)
    })
  }, [])

  const closeCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop())
    streamRef.current = null
    setCameraOpen(false)
  }, [])

  const updatePage = useCallback((pageId, changes) => {
    setPages(current => current.map(page => page.id === pageId
      ? { ...page, ...(typeof changes === 'function' ? changes(page) : changes) }
      : page))
  }, [])

  const addSource = useCallback(async (url, name = 'scan', metadata = {}) => {
    setBusy(true)
    try {
      const image = await loadImage(url)
      const page = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sourceUrl: url,
        fileName: name.replace(/\.[^.]+$/, '') || 'scan',
        sortName: metadata.sortName || name,
        modifiedAt: metadata.modifiedAt || Date.now(),
        corners: detectDocument(image),
        filter: 'document',
        previewUrl: '',
      }
      setPages(current => [...current, page])
      setActiveId(page.id)
      setView('adjust')
      setStatus(`Page ${pagesRef.current.length + 1} added. Drag a corner for precise adjustment.`)
    } catch {
      if (url.startsWith('blob:')) URL.revokeObjectURL(url)
      setStatus('This image could not be opened. Please choose another file.')
    } finally {
      setBusy(false)
    }
  }, [])

  const handleFiles = async event => {
    const selectedFiles = [...(event.target.files || [])]
    event.target.value = ''
    for (const file of selectedFiles) {
      const isZip = file.type === 'application/zip' || file.type === 'application/x-zip-compressed' || /\.zip$/i.test(file.name)
      if (isZip) {
        setBusy(true)
        setStatus(`Extracting images from ${file.name}…`)
        try {
          const entries = await unzipImages(file)
          if (!entries.length) {
            setStatus('No supported images were found in this ZIP archive.')
            continue
          }
          const ordered = [...entries].sort((first, second) => comparePages(
            { ...first, sortName: first.name }, { ...second, sortName: second.name }, 'name'))
          for (const entry of ordered) {
            const url = URL.createObjectURL(new Blob([entry.data], { type: imageMimeType(entry.name) }))
            await addSource(url, entry.name.split('/').pop(), { sortName: entry.name, modifiedAt: entry.modifiedAt })
          }
          setPages(current => [...current].sort((first, second) => comparePages(first, second, 'name')))
          setSortMode('name')
          setStatus(`${ordered.length} image${ordered.length === 1 ? '' : 's'} extracted from ${file.name} and sorted by filename.`)
        } catch (error) {
          setStatus(error.message || 'The ZIP archive could not be extracted.')
        } finally {
          setBusy(false)
        }
        continue
      }
      if (!file.type.startsWith('image/')) {
        setStatus('Choose image files or a ZIP archive containing images.')
        continue
      }
      await addSource(await fileToDataUrl(file), file.name, { sortName: file.name, modifiedAt: file.lastModified })
      setSortMode('manual')
    }
  }

  const openCamera = async () => {
    setCameraError('')
    setCameraOpen(true)
    try {
      await new Promise(resolve => requestAnimationFrame(resolve))
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1440 } },
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
    const maxCaptureSide = 2560
    const scale = Math.min(1, maxCaptureSide / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    const url = canvas.toDataURL('image/jpeg', 0.96)
    closeCamera()
    const captureName = `scan-${new Date().toISOString().slice(0, 19).replaceAll(':', '-')}-${pagesRef.current.length + 1}`
    addSource(url, captureName, { sortName: captureName, modifiedAt: Date.now() })
    setSortMode('manual')
  }

  const invalidatePreview = page => {
    if (page.previewUrl) URL.revokeObjectURL(page.previewUrl)
    return { previewUrl: '' }
  }

  const analyzeActivePage = async () => {
    if (!activePage) return
    setBusy(true)
    try {
      const image = await loadImage(activePage.sourceUrl)
      updatePage(activePage.id, page => ({ corners: detectDocument(image), ...invalidatePreview(page) }))
      setView('adjust')
      setStatus('Edges detected again. Fine-tune them with the magnified corner handles.')
    } finally {
      setBusy(false)
    }
  }

  const updateCorner = (index, clientX, clientY) => {
    const rect = editorRef.current?.getBoundingClientRect()
    if (!rect || !activePage) return
    const point = {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height)),
    }
    updatePage(activePage.id, page => ({
      corners: page.corners.map((corner, pointIndex) => pointIndex === index ? point : corner),
      ...invalidatePreview(page),
    }))
    setMagnifier({ index, point, width: rect.width, height: rect.height })
  }

  const handleCornerPointerDown = (event, index) => {
    event.currentTarget.setPointerCapture(event.pointerId)
    updateCorner(index, event.clientX, event.clientY)
  }

  const processPage = async page => {
    const sourceBlob = await fetch(page.sourceUrl).then(response => response.blob())
    const form = new FormData()
    form.append('image', sourceBlob, `${page.fileName}.jpg`)
    form.append('corners', JSON.stringify(page.corners))
    form.append('mode', page.filter)
    form.append('maxDimension', '2048')
    try {
      const response = await apiFetch('/bom/document-scanner/process', { method: 'POST', body: form })
      if (response.ok) return { blob: await response.blob(), serverProcessed: true }
    } catch {
      // The local high-resolution fallback below keeps scanning usable while the backend is unavailable.
    }
    const image = await loadImage(page.sourceUrl)
    const canvas = correctPerspective(image, page.corners, page.filter)
    return { blob: await canvasToBlob(canvas, 'jpeg'), serverProcessed: false }
  }

  const previewActivePage = async () => {
    if (!activePage) return
    setBusy(true)
    setStatus('Applying 2K perspective correction and enhancement…')
    try {
      const result = await processPage(activePage)
      const previewUrl = URL.createObjectURL(result.blob)
      updatePage(activePage.id, page => {
        if (page.previewUrl) URL.revokeObjectURL(page.previewUrl)
        return { previewUrl }
      })
      setView('preview')
      setStatus(result.serverProcessed
        ? '2K preview processed by the OpenCV scan engine. Readjust if any edge is off.'
        : '2K preview ready using the on-device fallback. Readjust if any edge is off.')
    } catch {
      setStatus('We could not create the preview. Move the corners slightly inward and try again.')
    } finally {
      setBusy(false)
    }
  }

  const createDocument = async () => {
    setBusy(true)
    setStatus(`Processing ${pages.length} page${pages.length === 1 ? '' : 's'} at 2K…`)
    try {
      const results = []
      for (let index = 0; index < pages.length; index += 1) {
        setStatus(`Processing page ${index + 1} of ${pages.length}…`)
        results.push(await processPage(pages[index]))
      }
      const baseName = pages[0]?.fileName || 'scanned-document'
      if (format === 'pdf') {
        return { blob: await blobsToPdf(results.map(result => result.blob)), fileName: `${baseName}-scanned.pdf` }
      }
      const converted = await Promise.all(results.map(async (result, index) => {
        if (format === 'jpeg') return { blob: result.blob, fileName: `${baseName}-page-${index + 1}.jpg` }
        const page = await blobToJpegPage(result.blob)
        const imageBlob = new Blob([page.bytes], { type: 'image/jpeg' })
        const imageUrl = URL.createObjectURL(imageBlob)
        try {
          const image = await loadImage(imageUrl)
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth
          canvas.height = image.naturalHeight
          canvas.getContext('2d').drawImage(image, 0, 0)
          return { blob: await canvasToBlob(canvas, 'png'), fileName: `${baseName}-page-${index + 1}.png` }
        } finally {
          URL.revokeObjectURL(imageUrl)
        }
      }))
      return converted.length === 1 ? converted[0] : { files: converted, fileName: baseName }
    } catch {
      setStatus('The document could not be completed. Review the page corners and try again.')
      return null
    } finally {
      setBusy(false)
    }
  }

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const downloadScan = async () => {
    const result = await createDocument()
    if (!result) return
    if (result.files) result.files.forEach(file => downloadBlob(file.blob, file.fileName))
    else downloadBlob(result.blob, result.fileName)
    setStatus(`${pages.length}-page document is ready.`)
  }

  const shareScan = async () => {
    const result = await createDocument()
    if (!result) return
    const outputFiles = result.files || [result]
    const files = outputFiles.map(output => new File([output.blob], output.fileName, { type: output.blob.type }))
    if (navigator.share && navigator.canShare?.({ files })) {
      try {
        await navigator.share({ title: 'Scanned document', files })
        return
      } catch (error) {
        if (error.name === 'AbortError') return
      }
    }
    outputFiles.forEach(file => downloadBlob(file.blob, file.fileName))
    setStatus('File sharing is unavailable in this browser, so the document was downloaded.')
  }

  const removePage = pageId => {
    const removingIndex = pages.findIndex(page => page.id === pageId)
    const removing = pages[removingIndex]
    if (removing?.previewUrl) URL.revokeObjectURL(removing.previewUrl)
    if (removing?.sourceUrl?.startsWith('blob:')) URL.revokeObjectURL(removing.sourceUrl)
    const remaining = pages.filter(page => page.id !== pageId)
    setPages(remaining)
    if (activeId === pageId) setActiveId(remaining[Math.max(0, removingIndex - 1)]?.id || null)
    setView('adjust')
    setStatus(remaining.length ? 'Page removed.' : '')
  }

  const selectPage = pageId => {
    setActiveId(pageId)
    setView('adjust')
    setMagnifier(null)
  }

  const applySort = mode => {
    setSortMode(mode)
    if (mode === 'manual') return
    setPages(current => [...current].sort((first, second) => comparePages(first, second, mode)))
  }

  const movePage = (pageId, direction) => {
    setPages(current => {
      const from = current.findIndex(page => page.id === pageId)
      const to = from + direction
      if (from < 0 || to < 0 || to >= current.length) return current
      const reordered = [...current]
      const [page] = reordered.splice(from, 1)
      reordered.splice(to, 0, page)
      return reordered
    })
    setSortMode('manual')
  }

  const dropPage = targetId => {
    if (!draggedPageId || draggedPageId === targetId) return
    setPages(current => {
      const reordered = [...current]
      const from = reordered.findIndex(page => page.id === draggedPageId)
      const target = reordered.findIndex(page => page.id === targetId)
      if (from < 0 || target < 0) return current
      const [page] = reordered.splice(from, 1)
      const insertAt = reordered.findIndex(item => item.id === targetId)
      reordered.splice(insertAt < 0 ? reordered.length : insertAt, 0, page)
      return reordered
    })
    setSortMode('manual')
    setDraggedPageId(null)
  }

  const setActiveFilter = value => {
    if (!activePage) return
    updatePage(activePage.id, page => ({ filter: value, ...invalidatePreview(page) }))
    setView('adjust')
  }

  const polygon = activePage?.corners.map(point => `${point.x * 100},${point.y * 100}`).join(' ') || ''
  const magnifierStyle = magnifier && activePage ? {
    left: `${magnifier.point.x * 100}%`,
    top: `${magnifier.point.y * 100}%`,
    backgroundImage: `url(${activePage.sourceUrl})`,
    backgroundSize: `${magnifier.width * 3}px ${magnifier.height * 3}px`,
    backgroundPosition: `${52 - magnifier.point.x * magnifier.width * 3}px ${52 - magnifier.point.y * magnifier.height * 3}px`,
    transform: `translate(-50%, ${magnifier.point.y < 0.3 ? '34px' : '-132px'})`,
  } : undefined

  return (
    <main className="document-scanner">
      <header className="scanner-header">
        <div>
          <span className="scanner-eyebrow">2K smart capture</span>
          <h1>Document Scanner</h1>
          <p>Crop, straighten and combine every page into one clean document.</p>
        </div>
        <div className="scanner-privacy"><span>✓</span> Secure processing · images are not stored</div>
      </header>

      {!activePage ? (
        <section className="scanner-start-card">
          <div className="scanner-illustration" aria-hidden="true">
            <div className="scanner-paper"><span /><span /><span /><span /></div>
            <i className="corner corner-tl" /><i className="corner corner-tr" /><i className="corner corner-br" /><i className="corner corner-bl" />
          </div>
          <div className="scanner-start-copy">
            <span className="step-pill">Step 1 of 3</span>
            <h2>Add the first page</h2>
            <p>Use your iPhone camera, select photos, or upload a ZIP. ZIP images are extracted and ordered automatically.</p>
            <div className="scanner-primary-actions">
              <button className="scanner-button scanner-button-primary" onClick={openCamera}><CameraAltRoundedIcon /> Open camera</button>
              <button className="scanner-button scanner-button-secondary" onClick={() => fileInputRef.current?.click()}><FolderZipOutlinedIcon /> Photos or ZIP</button>
            </div>
            <input ref={fileInputRef} className="scanner-file-input" type="file" accept="image/*,.zip,application/zip" multiple onChange={handleFiles} />
            <p className="scanner-file-help">JPG, PNG, WEBP, iPhone HEIC, or ZIP · up to 250 images per ZIP</p>
            {status && <div className="scanner-message">{status}</div>}
          </div>
        </section>
      ) : (
        <>
          <div className="scanner-workspace">
            <section className="scanner-editor-card">
              <div className="scanner-card-heading">
                <div><span className="step-pill">Page {pages.findIndex(page => page.id === activePage.id) + 1} of {pages.length}</span><h2>{view === 'preview' ? 'Review the result' : 'Adjust the corners'}</h2></div>
                <button className="scanner-icon-button" onClick={() => removePage(activePage.id)} title="Remove page"><DeleteOutlineRoundedIcon /></button>
              </div>
              <p className="scanner-instruction">
                {view === 'preview' ? <><VisibilityOutlinedIcon /> Check every edge, then readjust or add the next page.</> : <><CropFreeRoundedIcon /> Drag a handle. The 3× magnifier shows the exact corner under your finger.</>}
              </p>
              <div className="scanner-editor-stage">
                {view === 'preview' && activePage.previewUrl ? (
                  <div className="scanner-preview-wrap"><img src={activePage.previewUrl} alt="Corrected page preview" /></div>
                ) : (
                  <div className="scanner-image-wrap" ref={editorRef}>
                    <img src={activePage.sourceUrl} alt="Document to crop" draggable="false" />
                    <svg className="scanner-crop-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <defs><mask id="crop-mask"><rect width="100" height="100" fill="white" /><polygon points={polygon} fill="black" /></mask></defs>
                      <rect width="100" height="100" fill="rgba(4, 16, 35, .58)" mask="url(#crop-mask)" />
                      <polygon points={polygon} fill="none" stroke="#5de1c3" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
                    </svg>
                    {activePage.corners.map((point, index) => (
                      <button
                        key={CORNER_LABELS[index]}
                        className="scanner-corner-handle"
                        aria-label={`Move ${CORNER_LABELS[index]} corner`}
                        style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
                        onPointerDown={event => handleCornerPointerDown(event, index)}
                        onPointerMove={event => {
                          if (event.currentTarget.hasPointerCapture(event.pointerId)) updateCorner(index, event.clientX, event.clientY)
                        }}
                        onPointerUp={event => { event.currentTarget.releasePointerCapture(event.pointerId); setMagnifier(null) }}
                        onPointerCancel={() => setMagnifier(null)}
                      />
                    ))}
                    {magnifier && <div className="scanner-magnifier" style={magnifierStyle} aria-hidden="true"><span /></div>}
                  </div>
                )}
              </div>
              <div className="scanner-editor-actions">
                {view === 'preview' ? (
                  <button className="scanner-auto-button" onClick={() => setView('adjust')}><EditOutlinedIcon /> Readjust corners</button>
                ) : (
                  <button className="scanner-auto-button" onClick={analyzeActivePage} disabled={busy}><AutoAwesomeOutlinedIcon /> Detect edges again</button>
                )}
                <button className="scanner-auto-button" onClick={openCamera}><CameraAltRoundedIcon /> Add next page</button>
              </div>
            </section>

            <aside className="scanner-settings-card">
              <div><span className="step-pill">Step 3 of 3</span><h2>Finish your document</h2></div>
              <div className="scanner-quality-note"><strong>2K output</strong><span>OpenCV perspective correction · 2048 px</span></div>
              <div className="scanner-fieldset">
                <label>Page appearance</label>
                <div className="scanner-segmented scanner-segmented-stacked">
                  {[
                    ['document', 'Enhanced color'], ['grayscale', 'High-contrast B&W'], ['original', 'Keep original'],
                  ].map(([value, label]) => (
                    <button key={value} className={activePage.filter === value ? 'active' : ''} onClick={() => setActiveFilter(value)}>
                      {activePage.filter === value && <CheckRoundedIcon />} {label}
                    </button>
                  ))}
                </div>
              </div>
              <button className="scanner-button scanner-preview-button" onClick={previewActivePage} disabled={busy}>
                <VisibilityOutlinedIcon /> {busy ? 'Processing…' : 'Preview this page'}
              </button>
              <div className="scanner-fieldset">
                <label>Final document</label>
                <div className="scanner-format-grid">
                  {[
                    ['pdf', 'PDF', `One document · ${pages.length} page${pages.length === 1 ? '' : 's'}`],
                    ['jpeg', 'JPG', 'Separate high-quality images'],
                    ['png', 'PNG', 'Separate lossless images'],
                  ].map(([value, label, hint]) => (
                    <button key={value} className={format === value ? 'active' : ''} onClick={() => setFormat(value)}><strong>{label}</strong><span>{hint}</span></button>
                  ))}
                </div>
              </div>
              <div className="scanner-export-actions">
                <button className="scanner-button scanner-button-primary" onClick={downloadScan} disabled={busy}><DownloadRoundedIcon /> {busy ? 'Creating…' : 'Finish & download'}</button>
                <button className="scanner-button scanner-button-secondary" onClick={shareScan} disabled={busy}><IosShareRoundedIcon /> Share</button>
                <button className="scanner-add-another" onClick={() => fileInputRef.current?.click()}><AddPhotoAlternateOutlinedIcon /> Add photos or ZIP</button>
                <input ref={fileInputRef} className="scanner-file-input" type="file" accept="image/*,.zip,application/zip" multiple onChange={handleFiles} />
              </div>
              {status && <div className="scanner-message">{status}</div>}
            </aside>
          </div>

          <section className="scanner-pages-panel">
            <div className="scanner-pages-heading">
              <div><strong>Document pages</strong><span>{pages.length} page{pages.length === 1 ? '' : 's'} · drag, sort, or use the arrows to reorder</span></div>
              <div className="scanner-pages-tools">
                <label>Order
                  <select value={sortMode} onChange={event => applySort(event.target.value)}>
                    <option value="manual">Manual</option>
                    <option value="name">Filename sequence</option>
                    <option value="time">Time sequence</option>
                  </select>
                </label>
                <button onClick={() => fileInputRef.current?.click()}><FolderZipOutlinedIcon /> Add photos / ZIP</button>
              </div>
            </div>
            <div className="scanner-page-strip">
              {pages.map((page, index) => (
                <div
                  key={page.id}
                  className={`scanner-page-thumb ${page.id === activePage.id ? 'active' : ''} ${page.id === draggedPageId ? 'dragging' : ''}`}
                  draggable
                  onDragStart={() => setDraggedPageId(page.id)}
                  onDragEnd={() => setDraggedPageId(null)}
                  onDragOver={event => event.preventDefault()}
                  onDrop={() => dropPage(page.id)}
                  onClick={() => selectPage(page.id)}
                  title={page.sortName}
                >
                  <img src={page.previewUrl || page.sourceUrl} alt={`Page ${index + 1}`} draggable="false" />
                  <span>Page {index + 1}</span>
                  {page.previewUrl && <i><CheckRoundedIcon /></i>}
                  <div className="scanner-page-order-buttons">
                    <button disabled={index === 0} onClick={event => { event.stopPropagation(); movePage(page.id, -1) }} aria-label={`Move page ${index + 1} left`}><ArrowBackRoundedIcon /></button>
                    <button disabled={index === pages.length - 1} onClick={event => { event.stopPropagation(); movePage(page.id, 1) }} aria-label={`Move page ${index + 1} right`}><ArrowForwardRoundedIcon /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      <section className="scanner-how-it-works">
        <div><b>1</b><span><strong>Capture</strong><small>One or many pages</small></span></div><i />
        <div><b>2</b><span><strong>Adjust & preview</strong><small>3× corner magnifier</small></span></div><i />
        <div><b>3</b><span><strong>Finish</strong><small>One combined PDF</small></span></div>
      </section>

      {cameraOpen && (
        <div className="scanner-camera-modal" role="dialog" aria-modal="true" aria-label="Document camera">
          <div className="scanner-camera-frame">
            <button className="scanner-camera-close" onClick={closeCamera} aria-label="Close camera"><CloseRoundedIcon /></button>
            <video ref={videoRef} playsInline muted />
            <div className="scanner-camera-guide"><span /><span /><span /><span /></div>
            <p>{cameraError || `Page ${pages.length + 1} · keep the document inside the frame and hold steady.`}</p>
            {!cameraError && <button className="scanner-shutter" onClick={capturePhoto} aria-label="Take photo"><span /></button>}
            {cameraError && <button className="scanner-button scanner-button-secondary" onClick={() => fileInputRef.current?.click()}>Upload photos or ZIP</button>}
          </div>
        </div>
      )}
    </main>
  )
}
