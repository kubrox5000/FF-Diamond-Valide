import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/admin-session'
import { z } from 'zod'

const schema = z.object({
  token:  z.string().min(10),
  chatId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'token and chatId are required' }, { status: 400 })
  }

  const { token, chatId } = parsed.data

  const text = [
    `🔔 <b>رسالة اختبار — لوحة التحكم</b>`,
    ``,
    `✅ تم ربط بوت تيليجرام بنجاح!`,
    `سيتلقى هذا الحساب إشعارات طلبات الدفع بالبطاقة البنكية.`,
    ``,
    `📅 ${new Date().toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}`,
  ].join('\n')

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.ok) {
      return NextResponse.json(
        { ok: false, error: data.description ?? 'Telegram API error' },
        { status: 400 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Network error'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
