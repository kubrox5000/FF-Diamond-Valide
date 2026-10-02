'use client'

import { useEffect, useState } from 'react'
import type { CryptoRates } from './crypto-rates'

/** Live USDT prices for volatile coins, refreshed every minute. */
export function useCryptoRates(enabled = true): CryptoRates | undefined {
  const [rates, setRates] = useState<CryptoRates>()

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const load = () =>
      fetch('/api/crypto-rates')
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { rates?: CryptoRates } | null) => {
          if (!cancelled && data?.rates) setRates(data.rates)
        })
        .catch(() => {})
    void load()
    const id = setInterval(load, 60_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [enabled])

  return rates
}
