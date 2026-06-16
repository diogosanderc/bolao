import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { matchById, teamById } from '@/lib/copa2026'
import { scoreMatch } from '@/lib/scoring'

function matchLabel(matchId: string, score1: number, score2: number): string {
  const match = matchById[matchId]
  if (!match) return matchId
  const t1 = teamById[match.team1Id]?.name ?? match.team1Id
  const t2 = teamById[match.team2Id]?.name ?? match.team2Id
  return `${t1} ${score1}×${score2} ${t2}`
}

export async function GET() {
  try {
    const db = await readDB()

    // Only participants with predictions
    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) {
      predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    }
    const participants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)

    // Sort results chronologically
    const matchDates = db.matchDates ?? {}
    const sortedResults = [...db.results].sort((a, b) => {
      const dateA = matchDates[a.matchId]?.date ?? ''
      const dateB = matchDates[b.matchId]?.date ?? ''
      return dateA.localeCompare(dateB)
    })

    // Build evolution: cumulative points per participant after each match
    const snapshots: {
      matchId: string
      label: string
      dateBRT: string
      points: Record<string, number>  // participantId → cumulative points
    }[] = []

    for (let i = 0; i < sortedResults.length; i++) {
      const slice = sortedResults.slice(0, i + 1)
      const lb = computeLeaderboard(participants, db.matchPredictions, db.groupPredictions, slice)
      const r = sortedResults[i]
      const pts: Record<string, number> = {}
      for (const entry of lb) pts[entry.participant.id] = entry.totalPoints
      snapshots.push({
        matchId: r.matchId,
        label: matchLabel(r.matchId, r.score1, r.score2),
        dateBRT: matchDates[r.matchId]?.dateBRT ?? '',
        points: pts,
      })
    }

    // Per-participant statistics
    const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    const stats: Record<string, {
      id: string; name: string
      correctResults: number; correctScores: number
      correctGoals: number; pointsPerMatch: number
      totalPoints: number
    }> = {}

    for (const p of participants) {
      stats[p.id] = { id: p.id, name: p.name, correctResults: 0, correctScores: 0, correctGoals: 0, pointsPerMatch: 0, totalPoints: 0 }
    }

    let matchesPlayed = 0
    for (const result of db.results) {
      const match = matchById[result.matchId]
      if (!match) continue
      matchesPlayed++
      for (const pred of db.matchPredictions.filter(p => p.matchId === result.matchId)) {
        const s = stats[pred.participantId]
        if (!s) continue
        const sc = scoreMatch(pred, result, match)
        if (sc.correctResult) s.correctResults++
        if (sc.correctScore) s.correctScores++
        if (sc.correctGoals[0] || sc.correctGoals[1]) s.correctGoals++
        s.totalPoints += sc.total
      }
    }

    const finalLb = computeLeaderboard(participants, db.matchPredictions, db.groupPredictions, sortedResults)
    for (const entry of finalLb) {
      if (stats[entry.participant.id]) {
        stats[entry.participant.id].totalPoints = entry.totalPoints
        stats[entry.participant.id].pointsPerMatch = matchesPlayed > 0
          ? Math.round((entry.matchPoints / matchesPlayed) * 10) / 10
          : 0
      }
    }

    // Most popular prediction per played match
    const popularPredictions: {
      matchId: string; label: string; dateBRT: string
      topPrediction: string; count: number; totalPredictions: number
      resultScore: string
    }[] = []

    for (const result of sortedResults) {
      const predsForMatch = db.matchPredictions.filter(p => p.matchId === result.matchId)
      if (predsForMatch.length === 0) continue
      const freq: Record<string, number> = {}
      for (const p of predsForMatch) {
        const key = `${p.score1}×${p.score2}`
        freq[key] = (freq[key] ?? 0) + 1
      }
      const top = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]
      popularPredictions.push({
        matchId: result.matchId,
        label: matchLabel(result.matchId, result.score1, result.score2),
        dateBRT: matchDates[result.matchId]?.dateBRT ?? '',
        topPrediction: top[0],
        count: top[1],
        totalPredictions: predsForMatch.length,
        resultScore: `${result.score1}×${result.score2}`,
      })
    }

    // Surprise matches: no one got the exact score
    const surprises = popularPredictions.filter(p => {
      const predsForMatch = db.matchPredictions.filter(mp => mp.matchId === p.matchId)
      const [rs1, rs2] = p.resultScore.split('×').map(Number)
      return !predsForMatch.some(mp => mp.score1 === rs1 && mp.score2 === rs2)
    })

    return NextResponse.json({
      participants: participants.map(p => ({ id: p.id, name: p.name })),
      snapshots,
      participantStats: Object.values(stats),
      popularPredictions,
      surprises: surprises.map(s => s.matchId),
      matchesPlayed,
    })
  } catch (err) {
    console.error('[estatisticas]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
