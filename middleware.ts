import { NextResponse, type NextRequest } from 'next/server'

export const COUNTRY_HEADER = 'x-ff-country'

/** Read the visitor's country from the edge geo data (Netlify, Cloudflare). */
function geoCountry(request: NextRequest): string | undefined {
  // Netlify: base64-encoded JSON, e.g. {"country":{"code":"MA",...},...}
  const nfGeo = request.headers.get('x-nf-geo')
  if (nfGeo) {
    try {
      const code = JSON.parse(atob(nfGeo))?.country?.code
      if (typeof code === 'string' && code) return code.toUpperCase()
    } catch {
      // fall through
    }
  }
  const code = request.headers.get('x-country') || request.headers.get('cf-ipcountry')
  return code && code !== 'XX' ? code.toUpperCase() : undefined
}

// Tag the visitor's IP country so server components pick the correct locale
// immediately, without waiting for a client-side IP lookup.
export function middleware(request: NextRequest) {
  const country = geoCountry(request)
  if (!country) return NextResponse.next()

  // Forward to this request (the cookie below only reaches the next one).
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(COUNTRY_HEADER, country)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.cookies.set('ff_country', country, {
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
  })
  return res
}

export const config = {
  // Run on page navigations only (skip API, static assets and files with extensions).
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
}
