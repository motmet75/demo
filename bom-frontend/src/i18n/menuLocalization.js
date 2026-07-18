import { normalizeLanguage } from './translations'

export const MENU_TRANSLATION_LANGUAGES = ['cn', 'tw', 'ja', 'ko', 'es', 'dv', 'ms', 'id', 'vi']

export function parseJsonObject(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

export function parseChoices(value) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function compactTranslations(translations) {
  const result = {}
  Object.entries(translations || {}).forEach(([language, value]) => {
    const code = normalizeLanguage(language)
    const text = String(value || '').trim()
    if (code && text) result[code] = text
  })
  return result
}

export function stringifyTranslations(translations) {
  const compact = compactTranslations(translations)
  return Object.keys(compact).length ? JSON.stringify(compact) : null
}

export function localizedValue(baseValue, translations, language) {
  const code = normalizeLanguage(language)
  if (!code || code === 'en') return baseValue || ''
  const map = parseJsonObject(translations)
  return map[code] || baseValue || ''
}

export function localizedModelName(model, language) {
  return localizedValue(model?.modelName, model?.modelNameTranslations, language)
}

export function localizedCategory(model, language) {
  return localizedValue(model?.category, model?.categoryTranslations, language)
}

export function localizedGroupName(group, language) {
  return localizedValue(group?.groupName, group?.groupNameTranslations, language)
}

export function normalizeChoice(choice) {
  return typeof choice === 'object' && choice !== null
    ? choice
    : { label: String(choice), price: 0 }
}

export function localizedChoiceLabel(choice, language) {
  const normalized = normalizeChoice(choice)
  return localizedValue(normalized.label, normalized.labelTranslations, language)
}

export function getChoiceLabelTranslations(choice) {
  return parseJsonObject(normalizeChoice(choice).labelTranslations)
}
