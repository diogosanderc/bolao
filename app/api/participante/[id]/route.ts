import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { matchById, teamById } from '@/lib/copa2026'
import { scoreMatch } from '@/lib/scoring'
import { ALL_MATCHES } from '@/lib/copa2026'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const db = await readDB()
    const participant = db.participants.find(p => p.id === id)
    if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const matchDates = db.matchDates ?? {}
    const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    const myPreds = Object.fromEntries(
      db.matchPredictions.filter(p => p.participantId === id).map(p => [p.matchId, p])
    )

    const sortedMatches = [...ALL_MATCHES].sort((a, b) => {
      const dateA = matchDates[a.id]?.date ?? ''
      const dateB = matchDates[b.id]?.date ?? ''
      return dateA.localeCompare(dateB) || a.matchNumber - b.matchNumber
    })

    const predictions = sortedMatches
      .filter(m => myPreds[m.id] || resultMap[m.id])
      .map(m => {
        const pred = myPreds[m.id]
        const result = resultMap[m.id]
        const match = matchById[m.id]!
        let points: number | undefined
        let correctResult: boolean | undefined
        let correctScore: boolean | undefined
        let correctGoals: [boolean, boolean] | undefined

        if (pred && result && match) {
          const sc = scoreMatch(pred, result, match)
          points = sc.total
          correctResult = sc.correctResult
          correctScore = sc.correctScore
          correctGoals = sc.correctGoals
        }

        return {
          matchId: m.id,
          matchNumber: m.matchNumber,
          phase: m.phase,
          groupId: m.groupId,
          team1: { id: m.team1Id, name: teamById[m.team1Id]?.name ?? m.team1Id, flag: teamById[m.team1Id]?.flag ?? '🏳' },
          team2: { id: m.team2Id, name: teamById[m.team2Id]?.name ?? m.team2Id, flag: teamById[m.team2Id]?.flag ?? '🏳' },
          dateBRT: matchDates[m.id]?.dateBRT ?? null,
          prediction: pred ? { score1: pred.score1, score2: pred.score2 } : null,
          result: result ? { score1: result.score1, score2: result.score2 } : null,
          points,
          correctResult,
          correctScore,
          correctGoals,
        }
      })

    const played = predictions.filter(p => p.result !== null)
    const totalPoints = played.reduce((sum, p) => sum + (p.points ?? 0), 0)
    const correctResults = played.filter(p => p.correctResult).length
    const correctScores = played.filter(p => p.correctScore).length

    return NextResponse.json({
      participant: { id: participant.id, name: participant.name },
      predictions,
      summary: { totalPoints, correctResults, correctScores, matchesPlayed: played.length },
    })
  } catch (err) {
    console.error('[participante]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
