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
/** Country the visitor was in when they picked a language/currency manually. */
const OVERRIDE_COUNTRY_KEY = 'ff_locale_country'

const isLang = (v: string | undefined): v is Lang =>
  v === 'en' || v === 'ar' || v === 'fr' || v === 'es' || v === 'pt'

function rememberOverrideCountry(countryCode: string | undefined) {
  if (!countryCode) return
  globalThis.localStorage?.setItem(OVERRIDE_COUNTRY_KEY, countryCode)
  document.cookie = `${OVERRIDE_COUNTRY_KEY}=${countryCode}; path=/; max-age=31536000; samesite=lax`
}

function clearOverrides() {
  try {
    for (const key of [OVERRIDE_KEY, CURRENCY_KEY, OVERRIDE_COUNTRY_KEY]) {
      globalThis.localStorage?.removeItem(key)
      document.cookie = `${key}=; path=/; max-age=0; samesite=lax`
    }
  } catch {
    // ignore storage errors
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
  const countryRef = useRef<string | undefined>(initialLocale?.countryCode)
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

  // Resolve the visitor's country (IP first, timezone as a fallback), then
  // apply any manual override made in that same country. Overrides made in a
  // different country are dropped so the site re-adapts to the new location.
  useEffect(() => {
    let cancelled = false

    const readStored = (key: string) => {
      try {
        return globalThis.localStorage?.getItem(key) ?? undefined
      } catch {
        return undefined
      }
    }

    // `final` marks the definitive country; only then are stale overrides cleared.
    const apply = (countryCode: string | undefined, final: boolean) => {
      if (cancelled) return
      const base = countryCode ? localeForCountry(countryCode) : undefined

      const overrideCountry = readStored(OVERRIDE_COUNTRY_KEY)
      const sameCountry = !countryCode || overrideCountry === countryCode
      if (!sameCountry && final) clearOverrides()

      const storedLang = sameCountry ? readStored(OVERRIDE_KEY) : undefined
      const lang = isLang(storedLang) ? storedLang : base?.lang
      const storedCurrency = sameCountry ? readStored(CURRENCY_KEY) : undefined
      const currency = storedCurrency && CURRENCIES[storedCurrency] ? storedCurrency : base?.currency

      if (countryCode) countryRef.current = countryCode
      setState((s) => ({
        ...s,
        status: 'ready',
        lang: lang ?? s.lang,
        currency: currency ?? s.currency,
        countryCode: countryCode ?? s.countryCode,
      }))
    }

    // The edge already resolved the IP country: authoritative, no lookup needed.
    if (seeded.current?.countryFromIp && seeded.current.countryCode) {
      apply(seeded.current.countryCode, true)
      return () => {
        cancelled = true
      }
    }

    // Otherwise apply the timezone guess instantly, then refine via IP lookup
    // (the IP reflects VPNs / travel, the timezone does not).
    const tz = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : undefined
    const guess = countryFromTimezone(tz) ?? seeded.current?.countryCode
    apply(guess, false)
    void (async () => {
      const countryCode = await detectCountryCode()
      apply(countryCode ?? guess, true)
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const setLang = useCallback((lang: Lang) => {
    try {
      globalThis.localStorage?.setItem(OVERRIDE_KEY, lang)
      document.cookie = `${OVERRIDE_KEY}=${lang}; path=/; max-age=31536000; samesite=lax`
      rememberOverrideCountry(countryRef.current)
    } catch {
      // ignore storage errors
    }
    setState((s) => ({ ...s, lang }))
  }, [])

  const setCurrency = useCallback((currency: string) => {
    try {
      globalThis.localStorage?.setItem(CURRENCY_KEY, currency)
      rememberOverrideCountry(countryRef.current)
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
