import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { matchById, teamById } from '@/lib/copa2026'

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

    let lastMatch = null
    if (db.results.length > 0) {
      const last = db.results[db.results.length - 1]
      const match = matchById[last.matchId]
      if (match) {
        lastMatch = {
          matchId: last.matchId,
          score1: last.score1,
          score2: last.score2,
          team1: { id: match.team1Id, name: teamById[match.team1Id]?.name ?? match.team1Id, flag: teamById[match.team1Id]?.flag ?? '🏳' },
          team2: { id: match.team2Id, name: teamById[match.team2Id]?.name ?? match.team2Id, flag: teamById[match.team2Id]?.flag ?? '🏳' },
        }
      }
    }

    return NextResponse.json({ leaderboard, lastMatch })
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json({ leaderboard: [], lastMatch: null }, { status: 200 })
  }
}
