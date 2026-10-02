import { NextResponse } from 'next/server'
import { db } from '@/db'
import { packages } from '@/db/schemas'
import { eq, asc } from 'drizzle-orm'

export async function GET() {
  const rows = await db
    .select()
    .from(packages)
    .where(eq(packages.active, true))
    .orderBy(asc(packages.diamonds), asc(packages.id))
  return NextResponse.json({ packages: rows })
}
