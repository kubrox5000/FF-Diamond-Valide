'use client'

import { useEffect, useRef, useState } from 'react'
import { Coins, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/utils/cn'
import { useLocale } from './GeoLocaleProvider'

interface CurrencyOption {
  code: string
  symbol: string
  flag: string
  label: string
}

const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$',    flag: '🇺🇸', label: 'US Dollar' },
  { code: 'CAD', symbol: 'CA$',  flag: '🇨🇦', label: 'Canadian Dollar' },
  { code: 'EUR', symbol: '€',    flag: '🇪🇺', label: 'Euro' },
  { code: 'GBP', symbol: '£',    flag: '🇬🇧', label: 'Pound' },
  { code: 'SAR', symbol: 'ر.س', flag: '🇸🇦', label: 'Saudi Riyal' },
  { code: 'AED', symbol: 'د.إ', flag: '🇦🇪', label: 'Emirates Dirham' },
  { code: 'KWD', symbol: 'د.ك', flag: '🇰🇼', label: 'Kuwaiti Dinar' },
  { code: 'QAR', symbol: 'ر.ق', flag: '🇶🇦', label: 'Qatari Riyal' },
  { code: 'BHD', symbol: 'د.ب', flag: '🇧🇭', label: 'Bahrain Dinar' },
  { code: 'OMR', symbol: 'ر.ع', flag: '🇴🇲', label: 'Omani Rial' },
  // Latin America
  { code: 'MXN', symbol: 'MX$',  flag: '🇲🇽', label: 'Mexican Peso' },
  { code: 'GTQ', symbol: 'Q',    flag: '🇬🇹', label: 'Guatemalan Quetzal' },
  { code: 'HNL', symbol: 'L',    flag: '🇭🇳', label: 'Honduran Lempira' },
  { code: 'NIO', symbol: 'C$',   flag: '🇳🇮', label: 'Nicaraguan Córdoba' },
  { code: 'CRC', symbol: '₡',    flag: '🇨🇷', label: 'Costa Rican Colón' },
  { code: 'PAB', symbol: 'B/.',  flag: '🇵🇦', label: 'Panamanian Balboa' },
  { code: 'CUP', symbol: '$MN',  flag: '🇨🇺', label: 'Cuban Peso' },
  { code: 'DOP', symbol: 'RD$',  flag: '🇩🇴', label: 'Dominican Peso' },
  { code: 'HTG', symbol: 'G',    flag: '🇭🇹', label: 'Haitian Gourde' },
  { code: 'COP', symbol: 'COL$', flag: '🇨🇴', label: 'Colombian Peso' },
  { code: 'VES', symbol: 'Bs.',  flag: '🇻🇪', label: 'Venezuelan Bolívar' },
  { code: 'PEN', symbol: 'S/',   flag: '🇵🇪', label: 'Peruvian Sol' },
  { code: 'BOB', symbol: 'Bs',   flag: '🇧🇴', label: 'Bolivian Boliviano' },
  { code: 'BRL', symbol: 'R$',   flag: '🇧🇷', label: 'Brazilian Real' },
  { code: 'CLP', symbol: 'CLP$', flag: '🇨🇱', label: 'Chilean Peso' },
  { code: 'ARS', symbol: 'AR$',  flag: '🇦🇷', label: 'Argentine Peso' },
  { code: 'PYG', symbol: '₲',    flag: '🇵🇾', label: 'Paraguayan Guaraní' },
  { code: 'UYU', symbol: '$U',   flag: '🇺🇾', label: 'Uruguayan Peso' },
]

export function CurrencySwitch({ className }: { className?: string }) {
  const { currency, setCurrency } = useLocale()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const current = CURRENCIES.find((c) => c.code === currency) ?? {
    code: currency,
    symbol: currency,
    flag: '💱',
    label: currency,
  }

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Switch currency"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary/70 touch-manipulation"
        translate="no"
      >
        <Coins className="h-4 w-4 text-muted-foreground" />
        <span className="hidden sm:inline">{current.flag} {current.code}</span>
        <span className="sm:hidden">{current.flag}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 max-h-80 w-56 overflow-y-auto overscroll-contain rounded-xl border border-border bg-card shadow-xl">
          {CURRENCIES.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => { setCurrency(c.code); setOpen(false) }}
              className={cn(
                'flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-secondary/60 touch-manipulation',
                currency === c.code ? 'font-semibold text-primary' : 'text-foreground',
              )}
              translate="no"
            >
              <span className="text-base">{c.flag}</span>
              <span className="w-9 shrink-0 font-mono text-xs font-bold">{c.code}</span>
              <span className="flex-1 text-left text-xs text-muted-foreground">{c.label}</span>
              {currency === c.code && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
