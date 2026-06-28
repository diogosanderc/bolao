import { NextRequest, NextResponse } from 'next/server'
import { updateDB } from '@/lib/db'

// POST — associate (or clear) the "sou eu" participant for an existing subscription
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const endpoint: string | undefined = body?.endpoint
  if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 })
  const participantId: string | null = typeof body.participantId === 'string' ? body.participantId : null

  await updateDB(db => ({
    ...db,
    pushSubscriptions: (db.pushSubscriptions ?? []).map(s =>
      s.endpoint === endpoint
        ? (participantId ? { ...s, participantId } : (() => { const { participantId: _omit, ...rest } = s; return rest })())
        : s
    ),
  }))

  return NextResponse.json({ ok: true })
}
