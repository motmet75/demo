import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LANGUAGE,
  LANGUAGE_STORAGE_KEY,
  formatDateTimeValue,
  formatMoneyValue,
  formatNumberValue,
  formatTimeValue,
  getCurrentTimeZone,
  getCurrentLanguage,
  getLanguageMeta,
  normalizeLanguage,
  tFor,
  translateRelativeTime,
  translateSource,
} from './translations'

const I18nContext = createContext(null)
const translatedTextState = new WeakMap()
const translatedAttributeState = new WeakMap()
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'alt']

function localizeDomTree(root, language) {
  if (!root || root.nodeType === Node.COMMENT_NODE) return
  const localizeText = (node) => {
    const parentTag = node.parentElement?.tagName
    if (!node.nodeValue || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parentTag)) return
    const current = node.nodeValue
    const previous = translatedTextState.get(node)
    const source = previous && current === previous.rendered ? previous.source : current
    const rendered = translateSource(language, source)
    translatedTextState.set(node, { source, rendered })
    if (current !== rendered) node.nodeValue = rendered
  }
  const localizeElement = (element) => {
    let states = translatedAttributeState.get(element)
    if (!states) { states = new Map(); translatedAttributeState.set(element, states) }
    TRANSLATABLE_ATTRIBUTES.forEach((attribute) => {
      if (!element.hasAttribute(attribute)) return
      const current = element.getAttribute(attribute) || ''
      const previous = states.get(attribute)
      const source = previous && current === previous.rendered ? previous.source : current
      const rendered = translateSource(language, source)
      states.set(attribute, { source, rendered })
      if (current !== rendered) element.setAttribute(attribute, rendered)
    })
  }

  if (root.nodeType === Node.TEXT_NODE) {
    localizeText(root)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return
  if (root.nodeType === Node.ELEMENT_NODE) localizeElement(root)
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) localizeText(node)
    else localizeElement(node)
    node = walker.nextNode()
  }
}

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

  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return undefined
    let applying = false
    const apply = (root) => {
      applying = true
      localizeDomTree(root, language)
      queueMicrotask(() => { applying = false })
    }
    apply(document.body)
    const observer = new MutationObserver((records) => {
      if (applying) return
      records.forEach((record) => {
        if (record.type === 'childList') record.addedNodes.forEach(apply)
        else apply(record.target)
      })
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: TRANSLATABLE_ATTRIBUTES,
    })
    return () => observer.disconnect()
  }, [language])

  const value = useMemo(() => ({
    language,
    locale: getLanguageMeta(language).locale,
    dir: getLanguageMeta(language).dir,
    timeZone: getCurrentTimeZone(),
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
      timeZone: getCurrentTimeZone(),
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
