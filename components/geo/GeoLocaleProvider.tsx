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
const CURRENCY_KEY = 'ff_locale_currency'

function writeCookie(name: string, value: string, maxAge = 31536000) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; samesite=lax`
  } catch {
    // ignore cookie errors
  }
}

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

  // The server already resolved language + currency from the edge geo data, so
  // the first paint is final. Only when the server could not tell the country
  // (no geo data) do we refine on the client, and we persist the result in a
  // cookie so every following page is rendered correctly on the server.
  useEffect(() => {
    let cancelled = false

    let override: Lang | undefined
    try {
      const stored = globalThis.localStorage?.getItem(OVERRIDE_KEY)
      override = (stored === 'en' || stored === 'ar' || stored === 'fr' || stored === 'es' || stored === 'pt') ? stored as Lang : undefined
    } catch {
      override = undefined
    }
    if (override && override !== seeded.current?.lang) {
      setState((s) => ({ ...s, lang: override }))
      writeCookie(OVERRIDE_KEY, override)
    }

    // A manually chosen currency survives page reloads and beats geo-detection.
    let currencyOverride: string | undefined
    try {
      const stored = globalThis.localStorage?.getItem(CURRENCY_KEY)
      currencyOverride = stored && CURRENCIES[stored] ? stored : undefined
    } catch {
      currencyOverride = undefined
    }
    if (currencyOverride && currencyOverride !== seeded.current?.currency) {
      setState((s) => ({ ...s, currency: currencyOverride }))
      writeCookie(CURRENCY_KEY, currencyOverride)
    }

    if (seeded.current?.countryCode) {
      setState((s) => (s.status === 'ready' ? s : { ...s, status: 'ready' }))
      return
    }

    const setLocale = (lang: Lang, currency: string, countryCode: string) => {
      if (cancelled) return
      writeCookie('ff_country', countryCode, 60 * 60 * 24 * 30)
      setState((s) => ({ ...s, status: 'ready', lang: override ?? lang, currency: currencyOverride ?? currency, countryCode }))
    }

    // Instant, network-free signal: the browser timezone (e.g. Africa/Casablanca → MA).
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
    } catch {
      // ignore storage errors
    }
    writeCookie(OVERRIDE_KEY, lang)
    setState((s) => ({ ...s, lang }))
  }, [])

  const setCurrency = useCallback((currency: string) => {
    try {
      globalThis.localStorage?.setItem(CURRENCY_KEY, currency)
    } catch {
      // ignore storage errors
    }
    writeCookie(CURRENCY_KEY, currency)
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
