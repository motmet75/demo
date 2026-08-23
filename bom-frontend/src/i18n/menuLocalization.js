import { normalizeLanguage } from './translations'

export const MENU_TRANSLATION_LANGUAGES = ['cn', 'tw', 'ja', 'ko', 'es', 'dv', 'ms', 'id', 'vi', 'th']

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
  if (!code) return baseValue || ''
  const map = parseJsonObject(translations)
  return map[code] || baseValue || ''
}

export function localizedLabel(translations, language, fallback = '') {
  const code = normalizeLanguage(language)
  const map = parseJsonObject(translations)
  return (code && map[code]) || map.en || fallback || ''
}

const TABLE_PREFIX = {
  en: 'Table',
  vi: 'Bàn',
  cn: '桌',
  tw: '桌',
  ja: 'テーブル',
  ko: '테이블',
  es: 'Mesa',
  th: 'โต๊ะ',
  ms: 'Meja',
  id: 'Meja',
  dv: 'މޭޒު',
}

const LOOSE_OPTION_LABELS = {
  en: {
    'Mức đường': 'Sugar',
    'Mức đá': 'Ice',
    'Topping': 'Topping',
    'Đá bình thường': 'Regular ice',
    'Ít đá': 'Less ice',
    'Không đá': 'No ice',
    'Trân châu đen': 'Black pearls',
    'Thạch dừa sợi': 'Coconut jelly strips',
  },
  cn: {
    'Mức đường': '糖度',
    'Mức đá': '冰量',
    'Topping': '配料',
    'Đá bình thường': '正常冰',
    'Ít đá': '少冰',
    'Không đá': '去冰',
    'Trân châu đen': '黑珍珠',
    'Thạch dừa sợi': '椰果丝',
  },
  tw: {
    'Mức đường': '糖度',
    'Mức đá': '冰量',
    'Topping': '配料',
    'Đá bình thường': '正常冰',
    'Ít đá': '少冰',
    'Không đá': '去冰',
    'Trân châu đen': '黑珍珠',
    'Thạch dừa sợi': '椰果絲',
  },
}

export function localizedLooseLabel(value, language) {
  const text = String(value || '')
  const code = normalizeLanguage(language)
  return LOOSE_OPTION_LABELS[code]?.[text] || LOOSE_OPTION_LABELS.en[text] || text
}

export function localizedTableName(table, language) {
  const rawName = typeof table === 'string' ? table : table?.tableName
  const translated = typeof table === 'string'
    ? ''
    : localizedValue(rawName, table?.tableNameTranslations, language)
  if (translated && translated !== rawName) return translated
  return localizeTableNamePattern(rawName, language)
}

export function localizeTableNamePattern(name, language) {
  const text = String(name || '').trim()
  if (!text) return ''
  const code = normalizeLanguage(language)
  const match = text.match(/^(?:b[aà]n|table|mesa|桌|テーブル|테이블|โต๊ะ|meja)\s*[-#:]?\s*(.+)$/i)
  if (!match) return text
  const prefix = TABLE_PREFIX[code] || TABLE_PREFIX.en
  return `${prefix} ${match[1].trim()}`
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
  const translated = localizedValue(normalized.label, normalized.labelTranslations, language)
  return translated === normalized.label ? localizedLooseLabel(translated, language) : translated
}

export function getChoiceLabelTranslations(choice) {
  return parseJsonObject(normalizeChoice(choice).labelTranslations)
}

export function localizedSelectedOptions(modelId, selectedOptions, optionsByModel, language) {
  if (!selectedOptions) return null
  const selected = parseJsonObject(selectedOptions)
  const groups = optionsByModel?.[modelId] || optionsByModel?.[String(modelId)] || []
  const hasDefinitions = groups.length > 0

  return Object.entries(selected).map(([groupKey, value]) => {
    const group = groups.find(item => item.groupName === groupKey)
    const choices = group ? parseChoices(group.choices) : []
    const displayGroup = group ? localizedGroupName(group, language) : localizedLooseLabel(groupKey, language)
    const displayChoice = (label) => {
      const choice = choices.map(normalizeChoice).find(item => item.label === label)
      return choice ? localizedChoiceLabel(choice, language) : localizedLooseLabel(label, language)
    }
    if (Array.isArray(value)) return `${displayGroup}: ${value.map(displayChoice).join(', ')}`
    if (value && typeof value === 'object') {
      const parts = Object.entries(value)
        .filter(([, qty]) => Number(qty) > 0)
        .map(([label, qty]) => `${displayChoice(label)} x${qty}`)
      return parts.length ? `${displayGroup}: ${parts.join(', ')}` : null
    }
    return `${displayGroup}: ${displayChoice(String(value))}`
  }).filter(Boolean).join(hasDefinitions ? ' - ' : ' · ')
}
