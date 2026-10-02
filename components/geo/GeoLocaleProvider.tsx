'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  dirOf,
  localeForCountry,
  formatLocalPrice,
  countryFromTimezone,
  CURRENCIES,
  type Lang,
} from '@/lib/currencies'
import { t as translate, type TKey } from '@/lib/i18n'
import type { ServerLocale } from '@/lib/locale-server'

const OVERRIDE_KEY = 'ff_locale_lang'

export interface LocaleValue {
  status: 'loading' | 'ready'
  lang: Lang
  dir: 'ltr' | 'rtl'
  currency: string
  countryCode?: string
  t: (key: TKey, vars?: Record<string, string | number>) => string
  formatPrice: (usd: number) => string
  /** Manually override the language (keeps the detected currency). */
  setLang: (lang: Lang) => void
  /** Manually override the display currency. */
  setCurrency: (currency: string) => void
}

const LocaleContext = createContext<LocaleValue | null>(null)

interface State {
  status: 'loading' | 'ready'
  lang: Lang
  currency: string
  countryCode?: string
}

async function detectCountryCode(): Promise<string | undefined> {
  const sources = ['https://ipapi.co/json/', 'https://ipwho.is/']
  for (const url of sources) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 3000)
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(timer)
      if (!res.ok) continue
      const json = (await res.json()) as { country_code?: string; countryCode?: string }
      const code = (json.country_code ?? json.countryCode ?? '').toUpperCase()
      if (code) return code
    } catch {
      // try next source
    }
  }
  // Fallback: infer from the browser language tag, e.g. 'ar-MA' → 'MA'.
  const locale = (typeof navigator !== 'undefined' ? navigator.language : '') || ''
  const parts = locale.toUpperCase().split('-')
  if (parts.length > 1) return parts[1]
  return undefined
}

export function GeoLocaleProvider({
  children,
  initialLocale,
}: {
  children: ReactNode
  initialLocale?: ServerLocale
}) {
  const seeded = useRef(initialLocale)
  const [state, setState] = useState<State>({
    status: seeded.current ? 'ready' : 'loading',
    lang: seeded.current?.lang ?? 'ar',
    currency: seeded.current?.currency ?? 'SAR',
    countryCode: seeded.current?.countryCode,
  })

  // Keep <html lang> and <html dir> in sync with the active language.
  useEffect(() => {
    document.documentElement.setAttribute('lang', state.lang)
    document.documentElement.setAttribute('dir', dirOf(state.lang))
  }, [state.lang])

  // Apply a stored override and refine the country/currency. First paint is
  // already correct (server-seeded); then an instant timezone check flips the
  // language, and a background IP lookup refines the currency further.
  useEffect(() => {
    let cancelled = false

    let override: Lang | undefined
    try {
      const stored = globalThis.localStorage?.getItem(OVERRIDE_KEY)
      override = (stored === 'en' || stored === 'ar' || stored === 'fr' || stored === 'es' || stored === 'pt') ? stored as Lang : undefined
    } catch {
      override = undefined
    }
    if (override) setState((s) => ({ ...s, lang: override }))

    // A manually chosen currency survives page reloads and beats geo-detection.
    let currencyOverride: string | undefined
    try {
      const stored = globalThis.localStorage?.getItem('ff_locale_currency')
      currencyOverride = stored && CURRENCIES[stored] ? stored : undefined
    } catch {
      currencyOverride = undefined
    }
    if (currencyOverride) setState((s) => ({ ...s, currency: currencyOverride }))

    const setLocale = (lang: Lang, currency: string, countryCode: string) => {
      if (cancelled) return
      setState((s) => ({ ...s, lang: override ?? lang, currency: currencyOverride ?? currency, countryCode }))
    }

    // Instant, network-free signal: the browser timezone (e.g. Africa/Casablanca → MA).
    // This reflects the visitor's real physical location, so it is authoritative.
    const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined
    const tzCountry = countryFromTimezone(tz)

    if (tzCountry) {
      const base = localeForCountry(tzCountry)
      setLocale(base.lang, base.currency, tzCountry)
    } else {
      // Background: only refine via IP lookup when the timezone gives no country.
      void (async () => {
        const countryCode = await detectCountryCode()
        if (!countryCode) return
        const base = localeForCountry(countryCode)
        setLocale(base.lang, base.currency, countryCode)
      })()
    }

    return () => {
      cancelled = true
    }
  }, [])

  const setLang = useCallback((lang: Lang) => {
    try {
      globalThis.localStorage?.setItem(OVERRIDE_KEY, lang)
      document.cookie = `${OVERRIDE_KEY}=${lang}; path=/; max-age=31536000; samesite=lax`
    } catch {
      // ignore storage errors
    }
    setState((s) => ({ ...s, lang }))
  }, [])

  const setCurrency = useCallback((currency: string) => {
    try {
      globalThis.localStorage?.setItem('ff_locale_currency', currency)
    } catch {
      // ignore storage errors
    }
    setState((s) => ({ ...s, currency }))
  }, [])

  const value = useMemo<LocaleValue>(() => {
    return {
      status: state.status,
      lang: state.lang,
      dir: dirOf(state.lang),
      currency: state.currency,
      countryCode: state.countryCode,
      t: (key, vars) => translate(state.lang, key, vars),
      formatPrice: (usd) => formatLocalPrice(usd, state.lang, state.currency),
      setLang,
      setCurrency,
    }
  }, [state, setLang, setCurrency])

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
}

export function useLocale(): LocaleValue {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error('useLocale must be used within <GeoLocaleProvider>')
  return ctx
}
