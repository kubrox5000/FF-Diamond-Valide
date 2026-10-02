import { NextResponse } from 'next/server'
import { db } from '@/db'
import { reviews } from '@/db/schemas'
import { desc } from 'drizzle-orm'

export async function GET() {
  const rows = await db.select().from(reviews).orderBy(desc(reviews.createdAt)).limit(60)
  return NextResponse.json({ reviews: rows })
}
