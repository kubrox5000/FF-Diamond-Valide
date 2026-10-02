import { NextResponse } from 'next/server'
import { VOLATILE_COINS, type CryptoRates } from '@/lib/crypto-rates'

export const dynamic = 'force-dynamic'

const COINGECKO_IDS: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  SOL: 'solana',
}

async function fromBinance(): Promise<CryptoRates> {
  const symbols = JSON.stringify(VOLATILE_COINS.map((s) => `${s}USDT`))
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`,
    { cache: 'no-store', signal: AbortSignal.timeout(4000) },
  )
  if (!res.ok) throw new Error(`binance ${res.status}`)
  const data = (await res.json()) as { symbol: string; price: string }[]
  const rates: CryptoRates = {}
  for (const row of data) rates[row.symbol.replace(/USDT$/, '')] = Number(row.price)
  return rates
}

async function fromCoinGecko(): Promise<CryptoRates> {
  const ids = VOLATILE_COINS.map((s) => COINGECKO_IDS[s]).join(',')
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
    { cache: 'no-store', signal: AbortSignal.timeout(4000) },
  )
  if (!res.ok) throw new Error(`coingecko ${res.status}`)
  const data = (await res.json()) as Record<string, { usd?: number }>
  const rates: CryptoRates = {}
  for (const s of VOLATILE_COINS) {
    const usd = data[COINGECKO_IDS[s]]?.usd
    if (usd) rates[s] = usd
  }
  return rates
}

async function fromCoinbase(): Promise<CryptoRates> {
  const res = await fetch('https://api.coinbase.com/v2/exchange-rates?currency=USD', {
    cache: 'no-store',
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) throw new Error(`coinbase ${res.status}`)
  const data = (await res.json()) as { data?: { rates?: Record<string, string> } }
  const rates: CryptoRates = {}
  for (const s of VOLATILE_COINS) {
    const perUsd = Number(data.data?.rates?.[s])
    if (perUsd > 0) rates[s] = 1 / perUsd
  }
  return rates
}

const complete = (r: CryptoRates) => VOLATILE_COINS.every((s) => r[s] > 0)

export async function GET() {
  let rates: CryptoRates = {}
  // Binance rejects some server regions, so it is the last resort.
  for (const source of [fromCoinGecko, fromCoinbase, fromBinance]) {
    try {
      rates = { ...(await source()), ...rates }
      if (complete(rates)) break
    } catch {
      // try the next source
    }
  }

  if (!Object.keys(rates).length) {
    return NextResponse.json({ error: 'Rates unavailable' }, { status: 503 })
  }
  return NextResponse.json(
    { rates, updatedAt: new Date().toISOString() },
    { headers: { 'Cache-Control': 'public, max-age=30', 'Netlify-CDN-Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' } },
  )
}
