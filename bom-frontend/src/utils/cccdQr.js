/**
 * Vietnamese Căn cước/CCCD QR: 12-digit personal ID | 9-digit old ID (may be
 * empty) | full name | DOB | sex | residence | issue date.
 *
 * Decode locally. Return ONLY the buyer-facing name/address needed to draft
 * an invoice. Do not persist or transmit the scanned ID, DOB, sex or raw QR.
 */
export function parseCccdBuyerQr(raw) {
  const payload = String(raw ?? '').trim().replace(/^\uFEFF/, '')
  if (!payload || payload.length > 1600 || !payload.includes('|')) return null
  const parts = payload.split('|').map(part => part.trim())
  if (parts.length < 6 || parts.length > 8) return null

  // Layout with old identity number (or blank) is the standard QR layout.
  const oldIdIncluded = parts.length >= 7
  const nameIndex = oldIdIncluded ? 2 : 1
  const residenceIndex = oldIdIncluded ? 5 : 4
  const id = parts[0]
  if (!/^\d{12}$/.test(id)) return null
  if (oldIdIncluded && parts[1] && !/^\d{9,12}$/.test(parts[1])) return null

  const fullName = parts[nameIndex].replace(/\s+/g, ' ')
  const buyerAddress = parts[residenceIndex].replace(/\s+/g, ' ')
  // Avoid treating arbitrary QR data as an ID and filling invoice fields.
  if (!fullName || fullName.length > 255 || !/[\p{L}]/u.test(fullName)
      || !buyerAddress || buyerAddress.length > 500
      || !/[\p{L}]/u.test(buyerAddress)) return null

  return { fullName, buyerAddress }
}
