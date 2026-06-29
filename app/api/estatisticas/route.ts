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
      const lb = computeLeaderboard(participants, db.matchPredictions, db.groupPredictions, slice, db.r32TeamPicks, db.knockoutPhasePicks)
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

    const finalLb = computeLeaderboard(participants, db.matchPredictions, db.groupPredictions, sortedResults, db.r32TeamPicks, db.knockoutPhasePicks)
    for (const entry of finalLb) {
      if (stats[entry.participant.id]) {
        stats[entry.participant.id].totalPoints = entry.totalPoints
        stats[entry.participant.id].pointsPerMatch = matchesPlayed > 0
          ? Math.round((entry.matchPoints / matchesPlayed) * 10) / 10
          : 0
      }
    }

    // Classification bonus per participant: group order (+2/group) + qualified-team advancement points
    const classificationStats = finalLb.map(entry => {
      const groupOrderPoints = entry.breakdown.groupOrderPoints
      const adv = entry.breakdown.advancementPoints
      const r32Points = adv['round_of_32'] ?? 0
      const knockoutPoints = (adv['round_of_16'] ?? 0) + (adv['quarterfinal'] ?? 0)
        + (adv['semifinal'] ?? 0) + (adv['final'] ?? 0)
      return {
        id: entry.participant.id,
        name: entry.participant.name,
        groupOrderPoints,
        r32Points,
        knockoutPoints,
        total: groupOrderPoints + r32Points + knockoutPoints,
      }
    }).sort((a, b) => b.total - a.total)

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

    // ─── Records & curiosities ────────────────────────────────────────────
    const nameById = Object.fromEntries(participants.map(p => [p.id, p.name]))
    const records: { icon: string; title: string; value: string; subtitle: string }[] = []

    // Longest consecutive correct-result streak (chronological)
    {
      let best = { id: '', streak: 0 }
      for (const p of participants) {
        let cur = 0, max = 0
        for (const result of sortedResults) {
          const match = matchById[result.matchId]
          const pred = db.matchPredictions.find(mp => mp.participantId === p.id && mp.matchId === result.matchId)
          if (match && pred && scoreMatch(pred, result, match).correctResult) { cur++; if (cur > max) max = cur }
          else cur = 0
        }
        if (max > best.streak) best = { id: p.id, streak: max }
      }
      if (best.streak >= 2) records.push({ icon: 'flame', title: 'Maior sequência', value: nameById[best.id], subtitle: `${best.streak} resultados certos seguidos` })
    }

    // Most exact scores
    {
      const top = Object.values(stats).sort((a, b) => b.correctScores - a.correctScores)[0]
      if (top && top.correctScores > 0) records.push({ icon: 'target', title: 'Rei do placar exato', value: top.name, subtitle: `${top.correctScores} placares cravados` })
    }

    // Riskiest — highest average total goals predicted per played match
    {
      let best = { id: '', avg: 0 }
      for (const p of participants) {
        let sum = 0, n = 0
        for (const result of sortedResults) {
          const pred = db.matchPredictions.find(mp => mp.participantId === p.id && mp.matchId === result.matchId)
          if (pred) { sum += pred.score1 + pred.score2; n++ }
        }
        const avg = n > 0 ? sum / n : 0
        if (avg > best.avg) best = { id: p.id, avg }
      }
      if (best.id) records.push({ icon: 'rocket', title: 'Mais arrojado', value: nameById[best.id], subtitle: `média de ${best.avg.toFixed(1)} gols por palpite` })
    }

    // Per-match correctness, for "zebra", "unânime" and "freguês"
    const matchAcc: { matchId: string; correctPct: number; exactCount: number; total: number; label: string }[] = []
    for (const result of sortedResults) {
      const match = matchById[result.matchId]
      if (!match) continue
      const preds = db.matchPredictions.filter(mp => mp.matchId === result.matchId)
      if (preds.length === 0) continue
      let correct = 0, exact = 0
      for (const pred of preds) {
        const s = scoreMatch(pred, result, match)
        if (s.correctResult) correct++
        if (s.correctScore) exact++
      }
      matchAcc.push({ matchId: result.matchId, correctPct: correct / preds.length, exactCount: exact, total: preds.length, label: matchLabel(result.matchId, result.score1, result.score2) })
    }

    // Zebra — lowest correct-result rate
    {
      const z = [...matchAcc].sort((a, b) => a.correctPct - b.correctPct)[0]
      if (z) records.push({ icon: 'alert', title: 'Jogo zebra', value: z.label, subtitle: `só ${Math.round(z.correctPct * 100)}% acertaram o resultado` })
    }
    // Unânime — most exact-score hits
    {
      const u = [...matchAcc].sort((a, b) => b.exactCount - a.exactCount)[0]
      if (u && u.exactCount > 0) records.push({ icon: 'users', title: 'Palpite unânime', value: u.label, subtitle: `${u.exactCount} de ${u.total} cravaram o placar` })
    }
    // Freguês — team whose matches were most mispredicted (min 2 matches)
    {
      const teamWrong: Record<string, { wrong: number; n: number }> = {}
      for (const result of sortedResults) {
        const match = matchById[result.matchId]
        if (!match) continue
        const acc = matchAcc.find(m => m.matchId === result.matchId)
        if (!acc) continue
        for (const tid of [match.team1Id, match.team2Id]) {
          if (!teamWrong[tid]) teamWrong[tid] = { wrong: 0, n: 0 }
          teamWrong[tid].wrong += (1 - acc.correctPct)
          teamWrong[tid].n += 1
        }
      }
      const ranked = Object.entries(teamWrong)
        .filter(([, v]) => v.n >= 2)
        .map(([tid, v]) => ({ tid, rate: v.wrong / v.n }))
        .sort((a, b) => b.rate - a.rate)[0]
      if (ranked) records.push({ icon: 'ban', title: 'Freguês da galera', value: teamById[ranked.tid]?.name ?? ranked.tid, subtitle: `${Math.round(ranked.rate * 100)}% erraram os jogos dele` })
    }

    // Return participants sorted by current leaderboard ranking
    const lbOrder = new Map(finalLb.map((e, i) => [e.participant.id, i]))
    const sortedParticipants = [...participants].sort(
      (a, b) => (lbOrder.get(a.id) ?? 999) - (lbOrder.get(b.id) ?? 999)
    )

    return NextResponse.json({
      participants: sortedParticipants.map(p => ({ id: p.id, name: p.name })),
      snapshots,
      participantStats: Object.values(stats),
      classificationStats,
      records,
      popularPredictions,
      surprises: surprises.map(s => s.matchId),
      matchesPlayed,
    })
  } catch (err) {
    console.error('[estatisticas]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
