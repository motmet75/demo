import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  formatDateTimeValue,
  formatMoneyValue,
  formatNumberValue,
  formatTimeValue,
  getBrowserTimeZone,
  getCurrentLanguage,
  getLanguageMeta,
  normalizeLanguage,
  tFor,
  translateRelativeTime,
  translateSource,
} from './translations'

const I18nContext = createContext(null)

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(() => getCurrentLanguage())

  const setLanguage = useCallback((nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage) || DEFAULT_LANGUAGE
    setLanguageState(normalized)
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, normalized) } catch { /* storage may be blocked */ }
  }, [])

  useEffect(() => {
    const meta = getLanguageMeta(language)
    document.documentElement.lang = meta.locale
    document.documentElement.dir = meta.dir
  }, [language])

  const value = useMemo(() => ({
    language,
    locale: getLanguageMeta(language).locale,
    dir: getLanguageMeta(language).dir,
    timeZone: getBrowserTimeZone(),
    setLanguage,
    t: (key, params) => tFor(language, key, params),
    tx: (text) => translateSource(language, text),
    formatDateTime: (value, options) => formatDateTimeValue(value, language, options),
    formatTime: (value, options) => formatTimeValue(value, language, options),
    formatNumber: (value, options) => formatNumberValue(value, language, options),
    formatMoney: (value, currency = 'VND') => formatMoneyValue(value, language, currency),
    relativeTime: (value, now) => translateRelativeTime(language, value, now),
  }), [language, setLanguage])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) {
    return {
      language: DEFAULT_LANGUAGE,
      locale: getLanguageMeta(DEFAULT_LANGUAGE).locale,
      dir: getLanguageMeta(DEFAULT_LANGUAGE).dir,
      timeZone: getBrowserTimeZone(),
      setLanguage: () => {},
      t: (key, params) => tFor(DEFAULT_LANGUAGE, key, params),
      tx: (text) => translateSource(DEFAULT_LANGUAGE, text),
      formatDateTime: (value, options) => formatDateTimeValue(value, DEFAULT_LANGUAGE, options),
      formatTime: (value, options) => formatTimeValue(value, DEFAULT_LANGUAGE, options),
      formatNumber: (value, options) => formatNumberValue(value, DEFAULT_LANGUAGE, options),
      formatMoney: (value, currency = 'VND') => formatMoneyValue(value, DEFAULT_LANGUAGE, currency),
      relativeTime: (value, now) => translateRelativeTime(DEFAULT_LANGUAGE, value, now),
    }
  }
  return value
}
