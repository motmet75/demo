import {qrGreenMedianCandidates} from './qrImageRecovery.js'

/**
 * Try a second decoder after html5-qrcode/ZXing fails.
 * A real faint CCCD photo decoded successfully with native ZBar only after
 * GREEN channel + median 3x3 at unchanged 1:1 crop resolution.
 *
 * Uses local ZBar WebAssembly lazily, entirely on-device. QR text, identity
 * numbers and photos are never sent to a server or logged here.
 */
export async function decodeFaintQrWithZbar(file, {
  isCancelled = () => false,
  onProgress = () => {}
} = {}) {
  if (!file?.type?.startsWith('image/') || isCancelled()) return null

  // Vite is configured to use the 'zbar-inlined' package export condition.
  // This prevents fetching a WASM binary from a third-party CDN.
  const {scanImageData} = await import('@undecaf/zbar-wasm')
  let attempt = 0
  for await (const imageData of qrGreenMedianCandidates(file)) {
    if (isCancelled()) break
    attempt++
    onProgress(`Đang đọc QR với ZBar sau lọc nhiễu (${attempt}/5)…`)
    const symbols = await scanImageData(imageData)
    if (isCancelled()) return null
    const qr = symbols.find(symbol => symbol.typeName === 'ZBAR_QRCODE')
    if (qr) {
      const decoded = qr.decode()
      if (typeof decoded === 'string' && decoded.trim()) return decoded.trim()
    }
  }
  return null
}
