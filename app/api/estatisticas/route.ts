import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { matchById, teamById, ALL_MATCHES } from '@/lib/copa2026'
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

    // ── Extra stats (zebra, phase split, Brazil bias, near misses, title race,
    //    rare exact scores, current hot streak) ─────────────────────────────────
    const predIndex = new Map<string, (typeof db.matchPredictions)[number]>()
    for (const mp of db.matchPredictions) predIndex.set(`${mp.participantId}|${mp.matchId}`, mp)

    // Per-match: correct-result rate + exact-score hitters
    const matchInfo = new Map<string, { correctPct: number; exactPids: string[] }>()
    for (const result of sortedResults) {
      const match = matchById[result.matchId]
      if (!match) continue
      let correct = 0, n = 0
      const exactPids: string[] = []
      for (const p of participants) {
        const pred = predIndex.get(`${p.id}|${result.matchId}`)
        if (!pred) continue
        n++
        const sc = scoreMatch(pred, result, match)
        if (sc.correctResult) correct++
        if (sc.correctScore) exactPids.push(p.id)
      }
      if (n > 0) matchInfo.set(result.matchId, { correctPct: correct / n, exactPids })
    }

    const zebraAcc: Record<string, { pts: number; games: number }> = {}
    const phaseAcc: Record<string, { gHit: number; gN: number; kHit: number; kN: number }> = {}
    const braAcc: Record<string, { braPts: number; braN: number; otherPts: number; otherN: number }> = {}
    const nearAcc: Record<string, { count: number; ptsLost: number }> = {}
    const rareAcc: Record<string, { count: number; examples: string[] }> = {}
    const streakAcc: Record<string, number> = {}

    for (const p of participants) {
      zebraAcc[p.id] = { pts: 0, games: 0 }
      phaseAcc[p.id] = { gHit: 0, gN: 0, kHit: 0, kN: 0 }
      braAcc[p.id] = { braPts: 0, braN: 0, otherPts: 0, otherN: 0 }
      nearAcc[p.id] = { count: 0, ptsLost: 0 }
      rareAcc[p.id] = { count: 0, examples: [] }
      let streak = 0
      for (let i = sortedResults.length - 1; i >= 0; i--) {
        const result = sortedResults[i]
        const match = matchById[result.matchId]
        const pred = predIndex.get(`${p.id}|${result.matchId}`)
        if (!match || !pred) break
        if (scoreMatch(pred, result, match).correctResult) streak++
        else break
      }
      streakAcc[p.id] = streak
    }

    for (const result of sortedResults) {
      const match = matchById[result.matchId]
      if (!match) continue
      const info = matchInfo.get(result.matchId)
      const rs1 = result.regulationScore1 ?? result.score1
      const rs2 = result.regulationScore2 ?? result.score2
      const isBra = (matchLabel(result.matchId, 0, 0).includes('Brasil'))
      for (const p of participants) {
        const pred = predIndex.get(`${p.id}|${result.matchId}`)
        if (!pred) continue
        const sc = scoreMatch(pred, result, match)
        // 1. Zebra: points earned in games where less than half hit the result
        if (info && info.correctPct < 0.5) {
          zebraAcc[p.id].pts += sc.total
          zebraAcc[p.id].games++
        }
        // 2. Phase split
        if (match.phase === 'group') { phaseAcc[p.id].gN++; if (sc.correctResult) phaseAcc[p.id].gHit++ }
        else { phaseAcc[p.id].kN++; if (sc.correctResult) phaseAcc[p.id].kHit++ }
        // 3. Brazil bias
        if (isBra) { braAcc[p.id].braPts += sc.total; braAcc[p.id].braN++ }
        else { braAcc[p.id].otherPts += sc.total; braAcc[p.id].otherN++ }
        // 4. Near miss: correct result but exact score off by a single goal
        if (sc.correctResult && !sc.correctScore) {
          const off = Math.abs(pred.score1 - rs1) + Math.abs(pred.score2 - rs2)
          if (off === 1) { nearAcc[p.id].count++; nearAcc[p.id].ptsLost += 3 }
        }
        // 6. Rare exact scores: hit shared with at most 2 other participants
        if (sc.correctScore && info && info.exactPids.length <= 3) {
          rareAcc[p.id].count++
          if (rareAcc[p.id].examples.length < 3) {
            rareAcc[p.id].examples.push(matchLabel(result.matchId, rs1, rs2))
          }
        }
      }
    }

    // 5. Title race — same formula as the home page (remaining non-TBD games × 8)
    const playedIds = new Set(db.results.map(r => r.matchId))
    const remainingMatches = ALL_MATCHES.filter(m => {
      if (playedIds.has(m.id)) return false
      const t1 = m.team1Id !== 'TBD' ? m.team1Id : resolvedBracket[m.id]?.team1Id
      const t2 = m.team2Id !== 'TBD' ? m.team2Id : resolvedBracket[m.id]?.team2Id
      return t1 && t2 && t1 !== 'TBD' && t2 !== 'TBD'
    }).length
    const leaderPts = finalLb[0]?.totalPoints ?? 0
    const titleRace = finalLb.map(e => {
      const maxPossible = e.totalPoints + remainingMatches * 8
      return {
        id: e.participant.id, name: e.participant.name,
        points: e.totalPoints, gap: leaderPts - e.totalPoints,
        maxPossible, canReach: maxPossible >= leaderPts,
      }
    })

    // Red zone dispute: the bottom 7 (zona) plus the 2 above (alerta), with the
    // gap each needs to close to escape (points of the first participant outside the zone)
    const N = finalLb.length
    const escapeTargetPts = N > 7 ? finalLb[N - 8].totalPoints : 0
    const redZone = finalLb.slice(Math.max(0, N - 9)).map((e, i, arr) => {
      const pos = N - arr.length + i + 1
      const inZone = pos > N - 7
      return {
        id: e.participant.id, name: e.participant.name,
        pos, points: e.totalPoints,
        status: inZone ? 'zona' : 'alerta',
        gapToEscape: inZone ? Math.max(0, escapeTargetPts - e.totalPoints + 1) : 0,
      }
    })

    const top = <T,>(obj: Record<string, T>, val: (v: T) => number, n = 10) =>
      Object.entries(obj)
        .map(([id, v]) => ({ id, name: nameById[id], v }))
        .filter(x => val(x.v as T) > 0)
        .sort((a, b) => val(b.v as T) - val(a.v as T))
        .slice(0, n)

    const extraStats = {
      zebra: top(zebraAcc, v => v.pts).map(x => ({ id: x.id, name: x.name, pts: (x.v as any).pts, games: (x.v as any).games })),
      hardGames: [...matchInfo.values()].filter(i => i.correctPct < 0.5).length,
      phaseSplit: Object.entries(phaseAcc)
        .filter(([, v]) => v.kN > 0)
        .map(([id, v]) => ({
          id, name: nameById[id],
          groupPct: v.gN > 0 ? Math.round((v.gHit / v.gN) * 100) : 0,
          koPct: Math.round((v.kHit / v.kN) * 100),
          koGames: v.kN,
        }))
        .sort((a, b) => b.koPct - a.koPct)
        .slice(0, 10),
      brazil: Object.entries(braAcc)
        .filter(([, v]) => v.braN > 0 && v.otherN > 0)
        .map(([id, v]) => ({
          id, name: nameById[id],
          braAvg: Math.round((v.braPts / v.braN) * 10) / 10,
          otherAvg: Math.round((v.otherPts / v.otherN) * 10) / 10,
          diff: Math.round((v.braPts / v.braN - v.otherPts / v.otherN) * 10) / 10,
          braGames: v.braN,
        }))
        .sort((a, b) => b.diff - a.diff),
      nearMiss: top(nearAcc, v => v.count).map(x => ({ id: x.id, name: x.name, count: (x.v as any).count, ptsLost: (x.v as any).ptsLost })),
      titleRace,
      redZone,
      remainingMatches,
      boldHits: top(rareAcc, v => v.count, 5).map(x => ({ id: x.id, name: x.name, count: (x.v as any).count, examples: (x.v as any).examples })),
      hotStreak: top(streakAcc as any, (v: any) => v, 5).map(x => ({ id: x.id, name: x.name, streak: x.v as unknown as number })),
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
      championProjection,
      extraStats,
    })
  } catch (err) {
    console.error('[estatisticas]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
