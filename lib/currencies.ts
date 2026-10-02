// Client-safe country/locale/currency resolution.

export type Lang = 'en' | 'ar' | 'fr' | 'es' | 'pt'
export type Dir = 'ltr' | 'rtl'

export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  /** Fixed conversion rate: 1 USD = rate × local currency. */
  rate: number
}

export interface LocaleConfig {
  lang: Lang
  currency: string
}

export const dirOf = (lang: Lang): Dir => (lang === 'ar' ? 'rtl' : 'ltr')

// Fixed, editable conversion rates (USD → local). Prices shown to the visitor
// are computed as `priceUsd × rate` and never alter the real USDT/USD order amount.
export const CURRENCIES: Record<string, CurrencyInfo> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', rate: 1 },
  EGP: { code: 'EGP', name: 'Egyptian Pound', symbol: 'ج.م', rate: 48 },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', rate: 3.75 },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', rate: 3.67 },
  IQD: { code: 'IQD', name: 'Iraqi Dinar', symbol: 'د.ع', rate: 1480 },
  MAD: { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م', rate: 10.2 },
  DZD: { code: 'DZD', name: 'Algerian Dinar', symbol: 'د.ج', rate: 134 },
  TND: { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت', rate: 3.1 },
  JOD: { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.أ', rate: 0.71 },
  KWD: { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', rate: 0.31 },
  QAR: { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', rate: 3.64 },
  BHD: { code: 'BHD', name: 'Bahraini Dinar', symbol: 'د.ب', rate: 0.38 },
  OMR: { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع', rate: 0.386 },
  LYD: { code: 'LYD', name: 'Libyan Dinar', symbol: 'د.ل', rate: 4.85 },
  LBP: { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل', rate: 89000 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', rate: 0.92 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', rate: 0.79 },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', rate: 83.5 },
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', rate: 280 },
  IDR: { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', rate: 16200 },
  PHP: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', rate: 58 },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', rate: 5.1 },
  TRY: { code: 'TRY', name: 'Turkish Lira', symbol: '₺', rate: 34.5 },
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', rate: 1500 },
  THB: { code: 'THB', name: 'Thai Baht', symbol: '฿', rate: 34 },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', rate: 4.3 },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', rate: 1.38 },
  // Latin America
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', rate: 18.5 },
  GTQ: { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', rate: 7.7 },
  HNL: { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', rate: 26 },
  NIO: { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', rate: 36.7 },
  CRC: { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', rate: 505 },
  PAB: { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', rate: 1 },
  CUP: { code: 'CUP', name: 'Cuban Peso', symbol: '$MN', rate: 24 },
  DOP: { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', rate: 63 },
  HTG: { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', rate: 131 },
  COP: { code: 'COP', name: 'Colombian Peso', symbol: 'COL$', rate: 3900 },
  VES: { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.', rate: 200 },
  PEN: { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', rate: 3.5 },
  BOB: { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs', rate: 6.96 },
  CLP: { code: 'CLP', name: 'Chilean Peso', symbol: 'CLP$', rate: 950 },
  ARS: { code: 'ARS', name: 'Argentine Peso', symbol: 'AR$', rate: 1400 },
  PYG: { code: 'PYG', name: 'Paraguayan Guaraní', symbol: '₲', rate: 7300 },
  UYU: { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', rate: 40 },
}

// Country → language + currency, so the site adapts to the visitor's region.
const COUNTRY_LOCALE: Record<string, LocaleConfig> = {
  // MENA / Arabic-speaking
  SA: { lang: 'ar', currency: 'SAR' },
  AE: { lang: 'ar', currency: 'AED' },
  EG: { lang: 'ar', currency: 'EGP' },
  IQ: { lang: 'ar', currency: 'IQD' },
  MA: { lang: 'ar', currency: 'MAD' },
  DZ: { lang: 'ar', currency: 'DZD' },
  TN: { lang: 'ar', currency: 'TND' },
  JO: { lang: 'ar', currency: 'JOD' },
  KW: { lang: 'ar', currency: 'KWD' },
  QA: { lang: 'ar', currency: 'QAR' },
  BH: { lang: 'ar', currency: 'BHD' },
  OM: { lang: 'ar', currency: 'OMR' },
  LY: { lang: 'ar', currency: 'LYD' },
  LB: { lang: 'ar', currency: 'LBP' },
  SY: { lang: 'ar', currency: 'USD' },
  YE: { lang: 'ar', currency: 'USD' },
  PS: { lang: 'ar', currency: 'USD' },
  MR: { lang: 'ar', currency: 'USD' },
  SO: { lang: 'ar', currency: 'USD' },
  SD: { lang: 'ar', currency: 'USD' },
  DJ: { lang: 'ar', currency: 'USD' },
  // French-speaking countries
  CM: { lang: 'fr', currency: 'USD' },
  CI: { lang: 'fr', currency: 'USD' },
  SN: { lang: 'fr', currency: 'USD' },
  ML: { lang: 'fr', currency: 'USD' },
  // Latin America
  MX: { lang: 'es', currency: 'MXN' },
  GT: { lang: 'es', currency: 'GTQ' },
  HN: { lang: 'es', currency: 'HNL' },
  NI: { lang: 'es', currency: 'NIO' },
  CR: { lang: 'es', currency: 'CRC' },
  PA: { lang: 'es', currency: 'PAB' },
  CU: { lang: 'es', currency: 'CUP' },
  DO: { lang: 'es', currency: 'DOP' },
  HT: { lang: 'fr', currency: 'HTG' },
  CO: { lang: 'es', currency: 'COP' },
  VE: { lang: 'es', currency: 'VES' },
  PE: { lang: 'es', currency: 'PEN' },
  BO: { lang: 'es', currency: 'BOB' },
  CL: { lang: 'es', currency: 'CLP' },
  AR: { lang: 'es', currency: 'ARS' },
  PY: { lang: 'es', currency: 'PYG' },
  UY: { lang: 'es', currency: 'UYU' },
  EC: { lang: 'es', currency: 'USD' },
  SV: { lang: 'es', currency: 'USD' },
  PR: { lang: 'es', currency: 'USD' },
  // Non-Arabic regions with local currency
  US: { lang: 'en', currency: 'USD' },
  CA: { lang: 'en', currency: 'CAD' },
  GB: { lang: 'en', currency: 'GBP' },
  IN: { lang: 'en', currency: 'INR' },
  PK: { lang: 'en', currency: 'PKR' },
  ID: { lang: 'en', currency: 'IDR' },
  PH: { lang: 'en', currency: 'PHP' },
  BR: { lang: 'pt', currency: 'BRL' },
  TR: { lang: 'en', currency: 'TRY' },
  NG: { lang: 'en', currency: 'NGN' },
  TH: { lang: 'en', currency: 'THB' },
  MY: { lang: 'en', currency: 'MYR' },
  DE: { lang: 'en', currency: 'EUR' },
  FR: { lang: 'fr', currency: 'EUR' },
  ES: { lang: 'es', currency: 'EUR' },
  IT: { lang: 'en', currency: 'EUR' },
  NL: { lang: 'en', currency: 'EUR' },
  BE: { lang: 'en', currency: 'EUR' },
  PT: { lang: 'pt', currency: 'EUR' },
  AT: { lang: 'en', currency: 'EUR' },
  IE: { lang: 'en', currency: 'EUR' },
  FI: { lang: 'en', currency: 'EUR' },
  GR: { lang: 'en', currency: 'EUR' },
  RO: { lang: 'en', currency: 'EUR' },
  PL: { lang: 'en', currency: 'EUR' },
}

export const FALLBACK_LOCALE: LocaleConfig = { lang: 'ar', currency: 'SAR' }

// Timezone → country. A fast, network-free signal for the visitor's physical
// location (more reliable than browser language, which is often left in English).
const TIMEZONE_COUNTRY: Record<string, string> = {
  'Africa/Casablanca': 'MA',
  'Africa/El_Aaiun': 'MA',
  'Africa/Algiers': 'DZ',
  'Africa/Tunis': 'TN',
  'Africa/Tripoli': 'LY',
  'Africa/Cairo': 'EG',
  'Africa/Khartoum': 'SD',
  'Africa/Djibouti': 'DJ',
  'Africa/Mogadishu': 'SO',
  'Africa/Nouakchott': 'MR',
  'Asia/Riyadh': 'SA',
  'Asia/Qatar': 'QA',
  'Asia/Kuwait': 'KW',
  'Asia/Baghdad': 'IQ',
  'Asia/Dubai': 'AE',
  'Asia/Amman': 'JO',
  'Asia/Beirut': 'LB',
  'Asia/Damascus': 'SY',
  'Asia/Muscat': 'OM',
  'Asia/Bahrain': 'BH',
  'Asia/Jerusalem': 'PS',
  'Asia/Aden': 'YE',
  // Canada
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Montreal': 'CA',
  'America/Edmonton': 'CA',
  'America/Winnipeg': 'CA',
  'America/Halifax': 'CA',
  'America/Regina': 'CA',
  'America/St_Johns': 'CA',
  // Latin America
  'America/Mexico_City': 'MX',
  'America/Cancun': 'MX',
  'America/Monterrey': 'MX',
  'America/Tijuana': 'MX',
  'America/Guatemala': 'GT',
  'America/Tegucigalpa': 'HN',
  'America/Managua': 'NI',
  'America/Costa_Rica': 'CR',
  'America/Panama': 'PA',
  'America/Havana': 'CU',
  'America/Santo_Domingo': 'DO',
  'America/Port-au-Prince': 'HT',
  'America/Bogota': 'CO',
  'America/Caracas': 'VE',
  'America/Lima': 'PE',
  'America/La_Paz': 'BO',
  'America/Santiago': 'CL',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Buenos_Aires': 'AR',
  'America/Asuncion': 'PY',
  'America/Montevideo': 'UY',
  'America/Guayaquil': 'EC',
  'America/El_Salvador': 'SV',
  'America/Puerto_Rico': 'PR',
  'America/Sao_Paulo': 'BR',
}

/** Resolve a country code from the browser timezone, if one is known. */
export function countryFromTimezone(timeZone?: string): string | undefined {
  if (!timeZone) return undefined
  return TIMEZONE_COUNTRY[timeZone]
}

/**
 * Map an ISO country code to the visitor's language and currency. Unknown
 * visitors (no country at all) get Arabic + SAR; a detected country without a
 * specific mapping gets English + USD.
 */
export function localeForCountry(countryCode: string | undefined): LocaleConfig {
  const code = (countryCode ?? '').trim().toUpperCase()
  if (!code) return FALLBACK_LOCALE
  return COUNTRY_LOCALE[code] ?? { lang: 'en', currency: 'USD' }
}

/** A "generic" interface used by the provider before a final decision. */
export interface LocaleState {
  status: 'loading' | 'ready'
  lang: Lang
  dir: Dir
  currency: string
}

/** Format a number using Latin (Western) digits with standard grouping. */
export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)
}

/** Format a USD base price into the active display currency (whole number). */
export function formatLocalPrice(usd: number, lang: Lang, currency: string): string {
  const info = CURRENCIES[currency] ?? CURRENCIES.USD
  // Drop any fractional part so prices always show as whole numbers (203.9 → 203).
  const amount = Math.floor(usd * info.rate)
  // Keep Latin (Western) digits even in Arabic; only the currency symbol changes.
  const nf = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
  return `${nf.format(amount)} ${info.symbol}`
}