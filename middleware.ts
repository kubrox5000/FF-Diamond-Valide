import { NextResponse, type NextRequest } from 'next/server'

// Tag the visitor's country from the edge geo data (Cloudflare Workers / Vercel)
// into a cookie, so server components can pick the correct locale immediately
// without waiting for a client-side IP lookup.
export function middleware(request: NextRequest) {
  // Cloudflare Workers expose the visitor's country as the "cf-ipcountry" header.
  const country = request.headers.get('cf-ipcountry') || undefined

  if (!country) return NextResponse.next()

  const res = NextResponse.next()
  res.cookies.set('ff_country', country.toUpperCase(), {
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
