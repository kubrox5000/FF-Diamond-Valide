/**
 * يكشف تلقائياً إعدادات SSL المناسبة بناءً على مزود قاعدة البيانات.
 *
 * Neon     — neon.tech / ep-*.aws  → ssl: 'require'
 * Supabase — supabase.com / supabase.co / pooler.supabase → ssl: 'require'
 * Railway  — railway.app / railway.internal               → ssl: 'require'
 * localhost / 127.0.0.1                                   → ssl: false
 * sslmode=require في URL                                  → ssl: 'require'
 * أي مزود آخر                                             → ssl: 'prefer'
 */
export function detectSsl(databaseUrl: string): 'require' | 'prefer' | false {
  const url = databaseUrl.toLowerCase()

  // إذا كان الـ URL نفسه يحتوي على sslmode=require أو sslmode=verify-full
  if (url.includes('sslmode=require') || url.includes('sslmode=verify-full')) return 'require'

  // بيئة محلية — بدون SSL
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('@db:')) return false

  // مزودون يشترطون SSL
  const sslRequired = [
    'neon.tech',
    '.aws.neon',          // Neon pooler: ep-*.aws.neon.tech
    'supabase.com',
    'supabase.co',
    'pooler.supabase',
    'railway.app',
    'railway.internal',
    'render.com',
    'cockroachlabs.cloud',
    'planetscale.com',
    'upstash.io',
    'aiven.io',
    'tembo.io',
  ]
  if (sslRequired.some((host) => url.includes(host))) return 'require'

  // الافتراضي: حاول SSL إن أمكن
  return 'prefer'
}
