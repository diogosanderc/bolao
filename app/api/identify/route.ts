import { NextRequest, NextResponse } from 'next/server'
import { updateDB } from '@/lib/db'

// POST — record who clicked "Sou eu" (participantId) or cleared it (prevId only).
// Used for the admin overview of which participants identified themselves.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const participantId: string | null = typeof body?.participantId === 'string' ? body.participantId : null
  const prevId: string | null = typeof body?.prevId === 'string' ? body.prevId : null
  if (!participantId && !prevId) return NextResponse.json({ ok: false }, { status: 400 })

  await updateDB(db => {
    const souEu = { ...(db.souEu ?? {}) }
    if (participantId) {
      const prev = souEu[participantId]
      souEu[participantId] = { at: new Date().toISOString(), count: (prev?.count ?? 0) + 1 }
    } else if (prevId) {
      delete souEu[prevId]
    }
    return { ...db, souEu }
  })

  return NextResponse.json({ ok: true })
}
