import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { matchById, teamById } from '@/lib/copa2026'
import { scoreMatch } from '@/lib/scoring'
import { computeBracketFromResults } from '@/lib/bracket'

// Resolved knockout slots — filled in per request before labels are built
let resolvedBracket: Record<string, { team1Id: string; team2Id: string }> = {}

function matchLabel(matchId: string, score1: number, score2: number): string {
  const match = matchById[matchId]
  if (!match) return matchId
  // Knockout matches have TBD slots — resolve teams from actual results
  const rk = resolvedBracket[matchId]
  const t1Id = match.team1Id !== 'TBD' ? match.team1Id : (rk?.team1Id ?? 'TBD')
  const t2Id = match.team2Id !== 'TBD' ? match.team2Id : (rk?.team2Id ?? 'TBD')
  const t1 = teamById[t1Id]?.name ?? t1Id
  const t2 = teamById[t2Id]?.name ?? t2Id
  return `${t1} ${score1}×${score2} ${t2}`
}

export async function GET() {
  try {
    const db = await readDB()
    resolvedBracket = computeBracketFromResults(db.results)

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

    // Time in Top 3 and in the red zone (bottom 7), measured across snapshots
    {
      const totalP = participants.length
      const top3Count: Record<string, number> = {}
      const redCount: Record<string, number> = {}
      for (const snap of snapshots) {
        const pts = participants.map(p => snap.points[p.id] ?? 0)
        for (const p of participants) {
          const myPts = snap.points[p.id] ?? 0
          const rank = pts.filter(v => v > myPts).length + 1
          if (rank <= 3) top3Count[p.id] = (top3Count[p.id] ?? 0) + 1
          if (rank > totalP - 7) redCount[p.id] = (redCount[p.id] ?? 0) + 1
        }
      }
      const topTop3 = Object.entries(top3Count).sort((a, b) => b[1] - a[1])[0]
      if (topTop3 && topTop3[1] > 0) {
        records.push({ icon: 'crown', title: 'Mais tempo no Top 3', value: nameById[topTop3[0]], subtitle: `${topTop3[1]} de ${snapshots.length} rodadas entre os 3 primeiros` })
      }
      const topRed = Object.entries(redCount).sort((a, b) => b[1] - a[1])[0]
      if (topRed && topRed[1] > 0) {
        records.push({ icon: 'alert', title: 'Mais tempo na zona vermelha', value: nameById[topRed[0]], subtitle: `${topRed[1]} de ${snapshots.length} rodadas entre os 7 últimos` })
      }
    }

    // Champion projection: which participants can still hit their champion pick
    const groupResultCount = db.results.filter(r => r.matchId.startsWith('G')).length
    const groupsComplete = groupResultCount >= 72
    const aliveSet = new Set<string>()
    if (groupsComplete) {
      for (let i = 1; i <= 16; i++) {
        const slot = resolvedBracket[`R32_${i}`]
        if (slot?.team1Id && slot.team1Id !== 'TBD') aliveSet.add(slot.team1Id)
        if (slot?.team2Id && slot.team2Id !== 'TBD') aliveSet.add(slot.team2Id)
      }
    } else {
      for (const tid of Object.keys(teamById)) aliveSet.add(tid)
    }
    for (const result of db.results) {
      if (result.matchId.startsWith('G') || result.matchId === 'TP_1') continue
      const slot = resolvedBracket[result.matchId]
      const t1 = slot?.team1Id, t2 = slot?.team2Id
      if (!t1 || !t2 || t1 === 'TBD' || t2 === 'TBD') continue
      const winner = result.advancingTeamId
        ?? (result.score1 > result.score2 ? t1 : result.score2 > result.score1 ? t2 : undefined)
      if (!winner) continue
      aliveSet.delete(winner === t1 ? t2 : t1)
    }
    const championProjection = participants
      .map(p => {
        const kp = db.knockoutPhasePicks?.find(k => k.participantId === p.id)
        if (!kp?.champion) return null
        return { participantId: p.id, name: p.name, teamId: kp.champion, alive: aliveSet.has(kp.champion) }
      })
      .filter((x): x is { participantId: string; name: string; teamId: string; alive: boolean } => x !== null)

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
      championProjection,
    })
  } catch (err) {
    console.error('[estatisticas]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
