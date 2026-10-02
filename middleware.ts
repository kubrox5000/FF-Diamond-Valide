import { NextResponse, type NextRequest } from 'next/server'

const COUNTRY_HEADER = 'x-ff-country'

// Netlify passes the visitor's geo data as base64-encoded JSON in "x-nf-geo".
function countryFromNetlifyGeo(raw: string | null): string | undefined {
  if (!raw) return undefined
  for (const candidate of [raw, (() => { try { return atob(raw) } catch { return '' } })()]) {
    try {
      const geo = JSON.parse(candidate) as { country?: { code?: string } }
      if (geo?.country?.code) return geo.country.code
    } catch {
      // try next encoding
    }
  }
  return undefined
}

// Resolve the visitor's country from the edge geo data (Netlify / Cloudflare /
// Vercel) and forward it to server components on the SAME request, so the very
// first render is already in the visitor's language and currency — no flash.
export function middleware(request: NextRequest) {
  const raw =
    countryFromNetlifyGeo(request.headers.get('x-nf-geo')) ||
    request.headers.get('x-country') ||
    request.headers.get('cf-ipcountry') ||
    request.headers.get('x-vercel-ip-country') ||
    undefined
  const country = raw && /^[A-Za-z]{2}$/.test(raw) ? raw.toUpperCase() : undefined

  if (!country) return NextResponse.next()

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(COUNTRY_HEADER, country)
  const res = NextResponse.next({ request: { headers: requestHeaders } })
  if (request.cookies.get('ff_country')?.value !== country) {
    res.cookies.set('ff_country', country, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
    })
  }
  return res
}

export const config = {
  // Run on page navigations only (skip API, static assets and files with extensions).
  matcher: ['/((?!api/|_next/|.*\\..*).*)'],
}
