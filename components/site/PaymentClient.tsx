'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Copy, Check, Clock, Upload, Loader2, ShieldCheck, ArrowRight, AlertTriangle, Wifi, Banknote, Send } from 'lucide-react'
import { PAYMENT_METHODS } from '@/lib/orders'
import { QRCodeSVG } from 'qrcode.react'
import { CryptoIcon } from '@/components/site/CryptoIcon'
import { coinForMethod, cryptoAmount } from '@/lib/crypto-rates'
import { useCryptoRates } from '@/lib/use-crypto-rates'
import { useLocale } from '@/components/geo/GeoLocaleProvider'
import type { PublicOrder } from '@/lib/types'

export function PaymentClient({ order }: { order: PublicOrder }) {
  const router = useRouter()
  const { t } = useLocale()
  const [methods, setMethods] = useState<{ id: string; label: string; network: string; cat: string }[]>(
    PAYMENT_METHODS.map((m) => ({ id: m.id, label: m.label, network: m.network, cat: m.cat })),
  )
  const [copied, setCopied] = useState<'addr' | 'amt' | null>(null)
  const [txId, setTxId] = useState(order.txId ?? '')
  const [proof, setProof] = useState<string | null>(order.proofUrl ?? null)
  const [proofName, setProofName] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Load live payment methods from the DB (falls back to static defaults).
  useEffect(() => {
    fetch('/api/payment-methods')
      .then((r) => r.json())
      .then((data: { methods?: { key: string; label: string; network: string; cat: string }[] }) => {
        if (data.methods?.length) {
          setMethods(data.methods.map((m) => ({ id: m.key, label: m.label, network: m.network, cat: m.cat })))
        }
      })
      .catch(() => {})
  }, [])

  const method = methods.find((m) => m.id === order.paymentMethod)
  const isWallet = method?.cat === 'wallet'

  // Exact amount to send in the selected coin (falls back to USDT).
  const coin = coinForMethod(order.paymentMethod)
  const rates = useCryptoRates(!!coin && !coin.stable)
  const usdtAmount = parseFloat(order.amountUsdt).toFixed(2)
  const coinTotal = cryptoAmount(parseFloat(order.amountUsdt), order.paymentMethod, rates)
  const exactAmount = coinTotal?.amount ?? usdtAmount
  const exactSymbol = coinTotal?.symbol ?? 'USDT'
  const waitingRate = !!coin && !coin.stable && !coinTotal
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    const deadline = new Date(order.createdAt).getTime() + 30 * 60 * 1000
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()))
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [order.createdAt])

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const expired = remaining <= 0

  const alreadySubmitted = order.status === 'payment_review' || order.status === 'paid'

  async function copy(text: string, which: 'addr' | 'amt') {
    await navigator.clipboard.writeText(text)
    setCopied(which)
    toast.success(t('pay_copied'))
    setTimeout(() => setCopied(null), 1500)
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 3 * 1024 * 1024) return toast.error(t('pay_under3'))
    if (!file.type.startsWith('image/')) return toast.error(t('err_failed'))

    const reader = new FileReader()
    reader.onload = () => {
      const raw = reader.result as string
      const img = new Image()
      img.onload = () => {
        const MAX = 1200
        let { width, height } = img
        if (width > MAX || height > MAX) {
          const scale = MAX / Math.max(width, height)
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return setProof(raw)
        ctx.drawImage(img, 0, 0, width, height)
        setProof(canvas.toDataURL('image/jpeg', 0.72))
        setProofName(file.name)
      }
      img.onerror = () => {
        setProof(raw)
        setProofName(file.name)
      }
      img.src = raw
    }
    reader.readAsDataURL(file)
  }

  async function submit() {
    if (txId.trim().length < 4) return toast.error(t('err_tx'))
    setSubmitting(true)
    try {
      const res = await fetch(`/api/orders/${order.orderNumber}/proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txId, proofUrl: proof, cryptoAmount: coinTotal ? `${coinTotal.amount} ${coinTotal.symbol}` : null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('err_failed'))
      toast.success(t('pay_submitted_toast'))
      router.push(`/payment/confirmed?order=${order.orderNumber}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('err_generic'))
      setSubmitting(false)
    }
  }

  const qrValue = order.walletAddress || ''

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      {/* Left: payment instructions */}
      <div>
        <div className="glass rounded-2xl border p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground">{t('pay_order')}</p>
              <p className="font-mono text-lg font-bold" translate="no">{order.orderNumber}</p>
            </div>
            <div
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                expired && !alreadySubmitted
                  ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  : 'border-gold/30 bg-gold/10 text-gold'
              }`}
              translate="no"
            >
              <Clock className="h-4 w-4" />
              {alreadySubmitted ? t('pay_submitted') : expired ? t('pay_expired') : `${mins}:${String(secs).padStart(2, '0')}`}
            </div>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
            {/* Payment instructions card */}
            <div className="mx-auto w-[168px] shrink-0 rounded-2xl border border-border bg-secondary/40 p-4">
              <div className="mb-3 flex items-center gap-2">
                <CryptoIcon id={order.paymentMethod} className="h-8 w-8" />
                <div>
                  <p className="text-xs font-bold text-foreground" translate="no">{method?.label ?? 'USDT'}</p>
                  <p className="text-[10px] text-muted-foreground" translate="no">{method?.network ?? ''}</p>
                </div>
              </div>
              <div className="space-y-2.5">
                <Step icon={<Send className="h-3 w-3" />} num="1" text={t('pay_step1')} />
                <Step icon={<Wifi className="h-3 w-3" />} num="2" text={t('pay_step2')} />
                <Step icon={<Banknote className="h-3 w-3" />} num="3" text={t('pay_step3')} />
                <Step icon={<ShieldCheck className="h-3 w-3" />} num="4" text={t('pay_step4')} />
              </div>
              <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-500/10 p-2">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                <p className="text-[10px] font-medium leading-tight text-amber-300">{t('pay_step_warn')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <Info label={t('pay_send', { method: method?.label ?? 'USDT' })}>
                {qrValue && !isWallet && (
                  <div className="mb-3 flex flex-col items-center gap-2">
                    <div className="rounded-xl bg-white p-3 shadow">
                      <QRCodeSVG value={qrValue} size={168} level="M" marginSize={0} aria-label={qrValue} />
                    </div>
                    <p className="text-xs text-muted-foreground">{t('pay_scan_qr')}</p>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <code className="flex-1 break-all rounded-lg border px-3 py-2 text-xs" translate="no">
                    {order.walletAddress || t('pay_notconfig')}
                  </code>
                  <button
                    onClick={() => copy(order.walletAddress ?? '', 'addr')}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border hover:bg-secondary"
                    aria-label={t('pay_track')}
                  >
                    {copied === 'addr' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('pay_network', { net: method?.network ?? '' })}</p>
              </Info>

              <Info label={t('pay_exact')}>
                <div className="flex items-center gap-2">
                  <CryptoIcon id={order.paymentMethod} className="h-8 w-8" />
                  <code className="flex-1 text-base font-bold text-gold" translate="no">
                    {waitingRate ? <Loader2 className="inline h-4 w-4 animate-spin" /> : `${exactAmount} ${exactSymbol}`}
                  </code>
                  <button
                    onClick={() => copy(exactAmount, 'amt')}
                    disabled={waitingRate}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-border hover:bg-secondary"
                    aria-label={t('pay_track')}
                  >
                    {copied === 'amt' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </Info>
            </div>
          </div>

          <div className="mt-6 flex items-start gap-2 rounded-lg p-3 text-xs text-amber-200/90">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <p>{t('pay_warning')}</p>
          </div>
        </div>
      </div>

      {/* Right: confirm payment */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-2xl border border-border bg-card/90 p-6">
          <h3 className="text-lg font-bold">{t('pay_confirm')}</h3>

          {alreadySubmitted ? (
            <div className="mt-4 rounded-lg p-4 text-sm text-emerald-200">{t('pay_already')}</div>
          ) : (
            <>
              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {isWallet ? t('pay_tx_wallet') : t('pay_tx')}
                </label>
                <input
                  value={txId}
                  onChange={(e) => setTxId(e.target.value)}
                  placeholder={isWallet ? t('pay_tx_wallet_ph') : t('pay_tx_ph')}
                  translate="no"
                  className="input-base"
                />
              </div>

              <div className="mt-4">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('pay_proof')}</label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed py-3 text-sm text-muted-foreground hover:border-primary/50">
                  <Upload className="h-4 w-4" />
                  <span className="truncate">{proofName || t('pay_upload')}</span>
                  <input type="file" accept="image/*" className="hidden" onChange={onFile} />
                </label>
                {proof && (
                  <img src={proof} alt={t('pay_alt')} className="mt-2 max-h-32 rounded-md border border-border object-contain" />
                )}
              </div>

              <button
                onClick={submit}
                disabled={submitting}
                className="btn-shimmer glow-primary mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold text-white transition-transform hover:scale-[1.02] disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {submitting ? t('pay_submitting') : t('pay_verify')}
              </button>
            </>
          )}

          <button
            onClick={() => router.push(`/track?q=${order.orderNumber}`)}
            className="mt-3 w-full rounded-xl border border-border bg-secondary/50 px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
          >
            {t('pay_track')}
          </button>
        </div>
      </aside>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  )
}

function Step({ icon, num, text }: { icon: React.ReactNode; num: string; text: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
        {num}
      </span>
      <p className="text-[10px] leading-snug text-muted-foreground">{text}</p>
    </div>
  )
}