function dataUrlToBlob(dataUrl) {
  const [header, body] = String(dataUrl).split(',')
  const mime = header.match(/data:([^;]+)/)?.[1] || 'image/png'
  const bytes = atob(body || '')
  const array = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) array[i] = bytes.charCodeAt(i)
  return new Blob([array], { type: mime })
}

export async function saveQrImage(qrValue, orderCode = 'payment') {
  if (!qrValue) return false
  const source = qrValue.startsWith('http')
    ? qrValue
    : qrValue.startsWith('data:') ? qrValue : `data:image/png;base64,${qrValue}`

  try {
    const blob = source.startsWith('data:')
      ? dataUrlToBlob(source)
      : await fetch(source, { mode: 'cors' }).then(response => {
          if (!response.ok) throw new Error('Unable to download QR')
          return response.blob()
        })
    const file = new File([blob], `payment-qr-${orderCode}.png`, { type: blob.type || 'image/png' })

    // iOS/iPadOS exposes “Save Image” through the native share sheet.
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `Payment QR ${orderCode}` })
      return true
    }

    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
    return true
  } catch {
    // Cross-origin or older-browser fallback: open the image for long-press/save.
    window.open(source, '_blank', 'noopener,noreferrer')
    return false
  }
}
