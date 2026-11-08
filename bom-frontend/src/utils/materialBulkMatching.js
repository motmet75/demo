/**
 * Conservative bulk matching for customs and invoice receiving.
 * Only a unique full material-name match is eligible. We deliberately do not
 * use substring/fuzzy matching: selecting the wrong SKU can corrupt stock.
 */
export function normalizeMaterialDescription(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export function matchMaterialByDescription(description, materials, unit = '') {
  const name = normalizeMaterialDescription(description)
  if (!name) return { status: 'empty', material: null }

  const matches = (materials || []).filter(material =>
    normalizeMaterialDescription(material?.materialName) === name
  )
  if (!matches.length) return { status: 'missing', material: null }
  if (matches.length === 1) return { status: 'matched', material: matches[0] }

  // If duplicate names have different base units, allow unit to disambiguate.
  const normalizedUnit = normalizeMaterialDescription(unit)
  if (normalizedUnit) {
    const sameUnit = matches.filter(material =>
      normalizeMaterialDescription(material?.unit) === normalizedUnit
    )
    if (sameUnit.length === 1) return { status: 'matched', material: sameUnit[0] }
  }
  return { status: 'ambiguous', material: null }
}
