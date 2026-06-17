import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { matchById, teamById } from '@/lib/copa2026'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const db = await readDB()

  const match = matchById[matchId]
  if (!match) return NextResponse.json({ error: 'Match not found' }, { status: 404 })

  const participantMap = Object.fromEntries(db.participants.map(p => [p.id, p.name]))
  const predictions = db.matchPredictions
    .filter(p => p.matchId === matchId)
    .map(p => ({ name: participantMap[p.participantId] ?? '?', score1: p.score1, score2: p.score2 }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const result = db.results.find(r => r.matchId === matchId)

  return NextResponse.json({
    matchId,
    team1: { id: match.team1Id, name: teamById[match.team1Id]?.name ?? match.team1Id },
    team2: { id: match.team2Id, name: teamById[match.team2Id]?.name ?? match.team2Id },
    predictions,
    result: result ?? null,
  })
}
