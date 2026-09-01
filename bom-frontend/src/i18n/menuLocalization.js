import { normalizeLanguage } from './translations'

export const MENU_TRANSLATION_LANGUAGES = ['en', 'cn', 'tw', 'ja', 'ko', 'es', 'dv', 'ms', 'id', 'vi', 'th']

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
  vi: {
    'Mức đường': 'Mức đường',
    'Mức đá': 'Mức đá',
    'Topping': 'Topping',
    'Đường': 'Đường',
    'Đá': 'Đá',
    'Đá bình thường': 'Đá bình thường',
    'Bình thường': 'Bình thường',
    'Ít đá': 'Ít đá',
    'Không đá': 'Không đá',
    'Nhiều đá': 'Nhiều đá',
    'Ít đường': 'Ít đường',
    'Không đường': 'Không đường',
    'Trân châu đen': 'Trân châu đen',
    'Thạch dừa sợi': 'Thạch dừa sợi',
  },
  en: {
    'Mức đường': 'Sugar',
    'Mức đá': 'Ice',
    'Topping': 'Topping',
    'Đường': 'Sugar',
    'Đá': 'Ice',
    'Đá bình thường': 'Regular ice',
    'Bình thường': 'Regular',
    'Ít đá': 'Less ice',
    'Không đá': 'No ice',
    'Nhiều đá': 'Extra ice',
    'Ít đường': 'Less sugar',
    'Không đường': 'No sugar',
    'Trân châu đen': 'Black pearls',
    'Thạch dừa sợi': 'Coconut jelly strips',
  },
  cn: {
    'Mức đường': '糖度',
    'Mức đá': '冰量',
    'Topping': '配料',
    'Đường': '糖度',
    'Đá': '冰量',
    'Đá bình thường': '正常冰',
    'Bình thường': '正常',
    'Ít đá': '少冰',
    'Không đá': '去冰',
    'Nhiều đá': '多冰',
    'Ít đường': '少糖',
    'Không đường': '无糖',
    'Trân châu đen': '黑珍珠',
    'Thạch dừa sợi': '椰果丝',
  },
  tw: {
    'Mức đường': '糖度',
    'Mức đá': '冰量',
    'Topping': '配料',
    'Đường': '糖度',
    'Đá': '冰量',
    'Đá bình thường': '正常冰',
    'Bình thường': '正常',
    'Ít đá': '少冰',
    'Không đá': '去冰',
    'Nhiều đá': '多冰',
    'Ít đường': '少糖',
    'Không đường': '無糖',
    'Trân châu đen': '黑珍珠',
    'Thạch dừa sợi': '椰果絲',
  },
  ja: {
    'Mức đường': '甘さ',
    'Mức đá': '氷の量',
    'Topping': 'トッピング',
    'Đường': '甘さ',
    'Đá': '氷',
    'Đá bình thường': '氷普通',
    'Bình thường': '普通',
    'Ít đá': '氷少なめ',
    'Không đá': '氷なし',
    'Nhiều đá': '氷多め',
    'Ít đường': '甘さ控えめ',
    'Không đường': '無糖',
    'Trân châu đen': 'ブラックタピオカ',
    'Thạch dừa sợi': 'ココナッツゼリー',
  },
  ko: {
    'Mức đường': '당도',
    'Mức đá': '얼음량',
    'Topping': '토핑',
    'Đường': '당도',
    'Đá': '얼음',
    'Đá bình thường': '보통 얼음',
    'Bình thường': '보통',
    'Ít đá': '얼음 적게',
    'Không đá': '얼음 없음',
    'Nhiều đá': '얼음 많이',
    'Ít đường': '당 적게',
    'Không đường': '무설탕',
    'Trân châu đen': '블랙 펄',
    'Thạch dừa sợi': '코코넛 젤리',
  },
  es: {
    'Mức đường': 'Nivel de azúcar',
    'Mức đá': 'Nivel de hielo',
    'Topping': 'Topping',
    'Đường': 'Azúcar',
    'Đá': 'Hielo',
    'Đá bình thường': 'Hielo normal',
    'Bình thường': 'Normal',
    'Ít đá': 'Poco hielo',
    'Không đá': 'Sin hielo',
    'Nhiều đá': 'Más hielo',
    'Ít đường': 'Poco azúcar',
    'Không đường': 'Sin azúcar',
    'Trân châu đen': 'Perlas negras',
    'Thạch dừa sợi': 'Gelatina de coco',
  },
  th: {
    'Mức đường': 'ระดับความหวาน',
    'Mức đá': 'ระดับน้ำแข็ง',
    'Topping': 'ท็อปปิ้ง',
    'Đường': 'น้ำตาล',
    'Đá': 'น้ำแข็ง',
    'Đá bình thường': 'น้ำแข็งปกติ',
    'Bình thường': 'ปกติ',
    'Ít đá': 'น้ำแข็งน้อย',
    'Không đá': 'ไม่ใส่น้ำแข็ง',
    'Nhiều đá': 'น้ำแข็งมาก',
    'Ít đường': 'หวานน้อย',
    'Không đường': 'ไม่หวาน',
    'Trân châu đen': 'ไข่มุกดำ',
    'Thạch dừa sợi': 'วุ้นมะพร้าว',
  },
  ms: {
    'Mức đường': 'Tahap gula',
    'Mức đá': 'Tahap ais',
    'Topping': 'Topping',
    'Đường': 'Gula',
    'Đá': 'Ais',
    'Đá bình thường': 'Ais biasa',
    'Bình thường': 'Biasa',
    'Ít đá': 'Kurang ais',
    'Không đá': 'Tanpa ais',
    'Nhiều đá': 'Lebih ais',
    'Ít đường': 'Kurang gula',
    'Không đường': 'Tanpa gula',
    'Trân châu đen': 'Pearl hitam',
    'Thạch dừa sợi': 'Jeli kelapa',
  },
  id: {
    'Mức đường': 'Tingkat gula',
    'Mức đá': 'Tingkat es',
    'Topping': 'Topping',
    'Đường': 'Gula',
    'Đá': 'Es',
    'Đá bình thường': 'Es normal',
    'Bình thường': 'Normal',
    'Ít đá': 'Sedikit es',
    'Không đá': 'Tanpa es',
    'Nhiều đá': 'Banyak es',
    'Ít đường': 'Sedikit gula',
    'Không đường': 'Tanpa gula',
    'Trân châu đen': 'Pearl hitam',
    'Thạch dừa sợi': 'Jeli kelapa',
  },
  dv: {
    'Mức đường': 'Sugar level',
    'Mức đá': 'Ice level',
    'Topping': 'Topping',
    'Đường': 'Sugar',
    'Đá': 'Ice',
    'Đá bình thường': 'Regular ice',
    'Bình thường': 'Regular',
    'Ít đá': 'Less ice',
    'Không đá': 'No ice',
    'Nhiều đá': 'Extra ice',
    'Ít đường': 'Less sugar',
    'Không đường': 'No sugar',
    'Trân châu đen': 'Black pearls',
    'Thạch dừa sợi': 'Coconut jelly',
  },
}

export function localizedLooseLabel(value, language) {
  const text = String(value || '')
  const code = normalizeLanguage(language)
  const normalizedText = normalizeLooseOptionKey(text)
  const lookup = (labels) => {
    if (!labels) return null
    if (labels[text]) return labels[text]
    const found = Object.entries(labels).find(([key]) => normalizeLooseOptionKey(key) === normalizedText)
    return found ? found[1] : null
  }
  return lookup(LOOSE_OPTION_LABELS[code]) || (code === 'vi' ? text : lookup(LOOSE_OPTION_LABELS.en)) || text
}

function normalizeLooseOptionKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
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
  if (Object.keys(selected).length === 0) {
    const raw = String(selectedOptions || '').trim()
    return raw === '{}' ? null : raw
  }
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
