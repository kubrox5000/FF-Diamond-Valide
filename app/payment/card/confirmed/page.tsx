'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle2, Gem, Clock, Phone, Mail, Copy, Check,
  Loader2, ShieldCheck, ArrowRight, HeadphonesIcon,
} from 'lucide-react'
import { SiteNav } from '@/components/site/SiteNav'
import { SiteFooter } from '@/components/site/SiteFooter'
import { SEED_PACKAGES } from '@/lib/seed-data'
import { useLocale } from '@/components/geo/GeoLocaleProvider'

function ConfirmedContent() {
  const params      = useSearchParams()
  const { t, formatPrice, currency } = useLocale()
  const orderNumber = params.get('order') ?? ''
  const packageId   = Number(params.get('packageId') ?? 0)
  const uid         = params.get('uid') ?? ''
  const amountUsd   = params.get('amountUsd') ?? '0'
  const phone       = params.get('phone') ?? ''

  const pkg = SEED_PACKAGES.find((p) => p.id === packageId)
  const [copied, setCopied] = useState(false)

  // Confetti-like pulse on mount
  const [show, setShow] = useState(false)
  useEffect(() => { setTimeout(() => setShow(true), 50) }, [])

  function copyOrder() {
    navigator.clipboard.writeText(orderNumber).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">

      {/* Success icon with rings */}
      <div
        className={`mb-8 flex flex-col items-center text-center transition-all duration-700 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="relative mb-6">
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500/20" />
          <span className="absolute inset-3 animate-ping rounded-full bg-emerald-500/15 [animation-delay:0.25s]" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-xl shadow-emerald-500/30">
            <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
          </div>
        </div>

        <h1 className="text-3xl font-extrabold">{t('conf_title')}</h1>
        <p className="mt-3 text-base text-muted-foreground leading-relaxed">
          {t('conf_sub_card')}
        </p>
      </div>

      {/* Order summary card */}
      <div
        className={`mb-5 transition-all duration-700 delay-100 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-emerald-500/20 bg-emerald-500/10 px-5 py-4">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/20 text-emerald-400">
              <Gem className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-emerald-300">
                {pkg ? (pkg.diamonds + pkg.bonusDiamonds).toLocaleString() : '—'} 💎
              </p>
              <p className="text-xs text-muted-foreground">Free Fire Diamonds</p>
            </div>
            <p className="flex items-center gap-1 text-xl font-extrabold text-amber-400" translate="no">
              {formatPrice(Number(amountUsd))}
              <span className="text-xs font-medium text-muted-foreground">{currency}</span>
            </p>
          </div>

          {/* Details */}
          <div className="divide-y divide-border/50 px-5">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">{t('conf_order_no')}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{orderNumber}</span>
                <button
                  onClick={copyOrder}
                  className="grid h-7 w-7 place-items-center rounded-lg bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">{t('conf_uid')}</span>
              <span className="font-mono text-sm font-semibold">{uid}</span>
            </div>
            {phone && (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">{t('conf_phone')}</span>
                <span className="text-sm font-semibold" dir="ltr">{phone}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">{t('pay_method_label')}</span>
              <span className="text-sm font-semibold">{t('conf_bank_card')}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-muted-foreground">{t('conf_status')}</span>
              <span className="flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-semibold text-amber-300">
                <Clock className="h-3 w-3" /> {t('conf_pending')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info steps */}
      <div
        className={`mb-5 transition-all duration-700 delay-200 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="rounded-2xl border border-border bg-card/50 p-5 space-y-4">
          <p className="text-sm font-semibold text-muted-foreground">{t('conf_next')}</p>
          {[
            { icon: ShieldCheck, color: 'text-violet-400 bg-violet-500/10', text: t('conf_step_review') },
            { icon: Phone,       color: 'text-sky-400 bg-sky-500/10',       text: t('conf_step_phone', { phone: phone ? ` (${phone})` : '' }) },
            { icon: Gem,         color: 'text-emerald-400 bg-emerald-500/10', text: t('conf_step_add_min') },
          ].map(({ icon: Icon, color, text }, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${color}`}>
                <Icon className="h-4 w-4" />
              </span>
              <p className="text-sm leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Support note */}
      <div
        className={`mb-8 transition-all duration-700 delay-300 ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
          <HeadphonesIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>
            {t('conf_support_pre')} <span className="font-bold">{t('conf_24h')}</span>{t('conf_support_post')}{' '}
            <span className="font-mono font-bold">{orderNumber}</span>.
          </p>
        </div>
      </div>

      {/* CTA buttons */}
      <div
        className={`flex flex-col gap-3 transition-all duration-700 delay-[400ms] ${
          show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
        }`}
      >
        <Link
          href={`/track?q=${orderNumber}`}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-600 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02]"
        >
          <ArrowRight className="h-4 w-4" />
          {t('conf_track')}
        </Link>
        <Link
          href="/"
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
        >
          {t('conf_home')}
        </Link>
      </div>
    </div>
  )
}

export default function CardConfirmedPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Suspense fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <ConfirmedContent />
        </Suspense>
      </main>
      <SiteFooter settings={{} as never} />
    </>
  )
}
