import { NextResponse } from 'next/server'
import { updateDB } from '@/lib/db'

export async function POST() {
  try {
    const today = new Date().toISOString().slice(0, 10) // "YYYY-MM-DD"
    await updateDB(db => ({
      ...db,
      visits: { ...(db.visits ?? {}), [today]: ((db.visits ?? {})[today] ?? 0) + 1 },
    }))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
