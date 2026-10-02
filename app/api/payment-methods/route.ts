import { NextResponse } from 'next/server'
import { db } from '@/db'
import { paymentMethods } from '@/db/schemas'
import { eq, asc } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

// Public: active payment methods shown on the store & payment page.
export async function GET() {
  const rows = await db
    .select()
    .from(paymentMethods)
    .where(eq(paymentMethods.active, true))
    .orderBy(asc(paymentMethods.sortOrder))
  return NextResponse.json({
    methods: rows.map((m) => ({
      key: m.key,
      label: m.label,
      network: m.network,
      cat: m.cat,
      icon: m.icon,
    })),
  })
}
