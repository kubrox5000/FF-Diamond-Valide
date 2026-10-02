// Converts the USDT order total into the coin the customer chose to pay with.
// Stablecoins are pegged 1:1 to USDT; volatile coins use live USDT prices
// served (and cached) by /api/crypto-rates.

export type CryptoRates = Record<string, number>

interface CoinInfo {
  symbol: string
  decimals: number
  stable?: boolean
}

const METHOD_COIN: Record<string, CoinInfo> = {
  USDT_TRC20: { symbol: 'USDT', decimals: 2, stable: true },
  USDT_BEP20: { symbol: 'USDT', decimals: 2, stable: true },
  USDC: { symbol: 'USDC', decimals: 2, stable: true },
  BTC: { symbol: 'BTC', decimals: 8 },
  ETH: { symbol: 'ETH', decimals: 6 },
  BNB: { symbol: 'BNB', decimals: 5 },
  SOL: { symbol: 'SOL', decimals: 4 },
}

/** Symbols that need a live price. */
export const VOLATILE_COINS = Object.values(METHOD_COIN)
  .filter((c) => !c.stable)
  .map((c) => c.symbol)

export function coinForMethod(method: string | undefined): CoinInfo | undefined {
  return method ? METHOD_COIN[method] : undefined
}

/**
 * Amount of the method's coin equal to `usdt`, or undefined when the method
 * is not a coin or its live price is not available yet.
 */
export function cryptoAmount(
  usdt: number,
  method: string | undefined,
  rates: CryptoRates | undefined,
): { amount: string; symbol: string } | undefined {
  const coin = coinForMethod(method)
  if (!coin) return undefined
  const rate = coin.stable ? 1 : rates?.[coin.symbol]
  if (!rate || !(rate > 0)) return undefined
  const factor = 10 ** coin.decimals
  // Round up so the customer never sends slightly less than the order total.
  const value = Math.ceil((usdt / rate) * factor) / factor
  return { amount: value.toFixed(coin.decimals), symbol: coin.symbol }
}
