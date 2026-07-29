export function parseAllowedSideConfig(raw) {
  if (!raw) return []
  let parsed = raw
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw) } catch { return [] }
  }
  if (!Array.isArray(parsed)) return []
  return parsed
    .map(entry => {
      if (entry == null) return null
      if (typeof entry === 'string') return { modelId: String(entry), maxQty: null }
      if (typeof entry === 'object') {
        const modelId = entry.modelId || entry.id
        if (!modelId) return null
        const numericMax = Number(entry.maxQty)
        return {
          modelId: String(modelId),
          maxQty: Number.isFinite(numericMax) && numericMax > 0 ? Math.floor(numericMax) : null,
        }
      }
      return null
    })
    .filter(Boolean)
}

export function parseAllowedSideIds(raw) {
  return parseAllowedSideConfig(raw).map(entry => String(entry.modelId))
}

export function serializeAllowedSideConfig(config) {
  const normalized = parseAllowedSideConfig(config)
  if (!normalized.length) return null
  return JSON.stringify(normalized.map(entry => ({
    modelId: String(entry.modelId),
    maxQty: Number.isFinite(Number(entry.maxQty)) && Number(entry.maxQty) > 0 ? Math.floor(Number(entry.maxQty)) : 1,
  })))
}

export function decorateAllowedSideOptions(menu, raw) {
  const config = parseAllowedSideConfig(raw)
  if (!config.length) return []
  return config
    .map(entry => {
      const model = (menu || []).find(item => String(item.id) === String(entry.modelId))
      return model ? { ...model, maxQty: entry.maxQty } : null
    })
    .filter(Boolean)
}

export function getAllowedSideMax(raw, modelId) {
  const match = parseAllowedSideConfig(raw).find(entry => String(entry.modelId) === String(modelId))
  return match?.maxQty && match.maxQty > 0 ? match.maxQty : null
}
