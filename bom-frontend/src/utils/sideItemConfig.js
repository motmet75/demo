const normalizeMaxQty = (value, fallback = null) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback
  return Math.min(99, Math.floor(numeric))
}

export function parseAllowedSideConfig(raw) {
  if (!raw) return []
  let parsed = raw
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(parsed)) return []

  const seen = new Set()
  return parsed
    .map(entry => {
      if (entry == null) return null
      if (typeof entry === 'string') return { modelId: String(entry), maxQty: null }
      if (typeof entry !== 'object') return null
      const modelId = entry.modelId || entry.id
      return modelId ? { modelId: String(modelId), maxQty: normalizeMaxQty(entry.maxQty) } : null
    })
    .filter(entry => {
      if (!entry || seen.has(entry.modelId)) return false
      seen.add(entry.modelId)
      return true
    })
}

export function parseAllowedSideIds(raw) {
  return parseAllowedSideConfig(raw).map(entry => entry.modelId)
}

export function serializeAllowedSideConfig(config) {
  const normalized = parseAllowedSideConfig(config)
  if (!normalized.length) return null
  return JSON.stringify(normalized.map(entry => ({
    modelId: entry.modelId,
    maxQty: normalizeMaxQty(entry.maxQty, 1),
  })))
}

export function decorateAllowedSideOptions(menu, raw) {
  const modelsById = new Map((menu || []).map(model => [String(model.id), model]))
  return parseAllowedSideConfig(raw)
    .map(entry => {
      const model = modelsById.get(entry.modelId)
      return model ? { ...model, maxQty: entry.maxQty } : null
    })
    .filter(Boolean)
}

export function getAllowedSideMax(raw, modelId) {
  const match = parseAllowedSideConfig(raw).find(entry => entry.modelId === String(modelId))
  return normalizeMaxQty(match?.maxQty)
}
