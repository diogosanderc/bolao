import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'

export async function GET() {
  try {
    const db = await readDB()
    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) {
      predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    }
    const validParticipants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)
    return NextResponse.json({
      participants: validParticipants.map(p => ({ id: p.id, name: p.name })),
      matchPredictions: db.matchPredictions,
    })
  } catch (err) {
    console.error('[predictions/all]', err)
    return NextResponse.json({ participants: [], matchPredictions: [] }, { status: 200 })
  }
}
