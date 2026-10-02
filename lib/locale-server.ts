// Server-side locale resolution so the first render already matches the visitor.
// Imported only from server components (App Router) — never from client code.
import { headers, cookies } from 'next/headers'
import { localeForCountry, FALLBACK_LOCALE, CURRENCIES, type Lang } from './currencies'

export const OVERRIDE_COOKIE = 'ff_locale_lang'
export const COUNTRY_COOKIE = 'ff_country'
export const CURRENCY_COOKIE = 'ff_locale_currency'
export const COUNTRY_HEADER = 'x-ff-country'

export interface ServerLocale {
  lang: Lang
  currency: string
  countryCode?: string
}

/** Resolve the visitor's locale on the server, without any network call. */
export async function resolveServerLocale(): Promise<ServerLocale> {
  const [h, c] = await Promise.all([headers(), cookies()])

  // 1. Manual language override (persisted from the language switcher).
  const override = c.get(OVERRIDE_COOKIE)?.value
  const storedLang: Lang | undefined =
    override === 'en' || override === 'ar' || override === 'fr' || override === 'es' || override === 'pt'
      ? (override as Lang)
      : undefined

  // 2. Country: prefer the edge geo header forwarded by middleware on this very
  //    request, then the geo cookie from a previous visit, then the region in
  //    the Accept-Language header, e.g. "ar-SA" → SA.
  let country = h.get(COUNTRY_HEADER) ?? c.get(COUNTRY_COOKIE)?.value
  if (!country) {
    const acceptLanguage = h.get('accept-language') ?? ''
    const m = acceptLanguage.match(/(?:^|,)\s*([a-z]{2})-([A-Z]{2})/i)
    if (m) country = m[2].toUpperCase()
  }
  if (country) country = country.toUpperCase()

  // Default to Arabic + SAR when the country is unknown.
  const base = country ? localeForCountry(country) : FALLBACK_LOCALE
  const lang: Lang = storedLang ?? base.lang

  // 3. Manual currency override (persisted from the currency switcher).
  const storedCurrency = c.get(CURRENCY_COOKIE)?.value
  const currency = storedCurrency && CURRENCIES[storedCurrency] ? storedCurrency : base.currency

  return { lang, currency, countryCode: country }
}
