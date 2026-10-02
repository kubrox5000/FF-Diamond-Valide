// Server-side locale resolution so the first render already matches the visitor.
// Imported only from server components (App Router) — never from client code.
import { headers, cookies } from 'next/headers'
import { localeForCountry, FALLBACK_LOCALE, type Lang } from './currencies'

export const OVERRIDE_COOKIE = 'ff_locale_lang'
/** Country the visitor was in when they picked a language manually. */
export const OVERRIDE_COUNTRY_COOKIE = 'ff_locale_country'
export const COUNTRY_COOKIE = 'ff_country'

export interface ServerLocale {
  lang: Lang
  currency: string
  countryCode?: string
  /** True when the country came from the visitor's IP (edge geo data). */
  countryFromIp?: boolean
}

/** Resolve the visitor's locale on the server, without any network call. */
export async function resolveServerLocale(): Promise<ServerLocale> {
  const [h, c] = await Promise.all([headers(), cookies()])

  // 1. Country: prefer the IP geo header set by middleware, then the geo
  //    cookie, then the region in the Accept-Language header ("ar-SA" → SA).
  let country = h.get('x-ff-country') ?? undefined
  const countryFromIp = !!country
  if (!country) country = c.get(COUNTRY_COOKIE)?.value
  if (!country) {
    const acceptLanguage = h.get('accept-language') ?? ''
    const m = acceptLanguage.match(/(?:^|,)\s*([a-z]{2})-([A-Z]{2})/i)
    if (m) country = m[2]
  }
  if (country) country = country.toUpperCase()

  // 2. Manual language override — only while the visitor stays in the same
  //    country; moving to another country re-enables auto-detection.
  const override = c.get(OVERRIDE_COOKIE)?.value
  const overrideCountry = c.get(OVERRIDE_COUNTRY_COOKIE)?.value
  const storedLang: Lang | undefined =
    (override === 'en' || override === 'ar' || override === 'fr' || override === 'es' || override === 'pt') &&
    (!country || overrideCountry === country)
      ? (override as Lang)
      : undefined

  const base = country ? localeForCountry(country) : FALLBACK_LOCALE
  const lang: Lang = storedLang ?? base.lang

  return { lang, currency: base.currency, countryCode: country, countryFromIp }
}
