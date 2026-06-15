import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'

export async function GET() {
  try {
    const db = await readDB()
    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) {
      predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    }
    const validParticipants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)
    const leaderboard = computeLeaderboard(
      validParticipants,
      db.matchPredictions,
      db.groupPredictions,
      db.results
    )
    return NextResponse.json(leaderboard)
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json([], { status: 200 })
  }
}
