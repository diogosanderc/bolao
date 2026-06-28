import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { matchById, teamById, ALL_MATCHES, GROUP_MATCHES, GROUPS } from '@/lib/copa2026'
import { scoreMatch, computeLeaderboard } from '@/lib/scoring'
import { computeBracketFromResults } from '@/lib/bracket'

// Build a map from teamId → groupId for lookup
const teamGroupMap: Record<string, string> = {}
for (const group of GROUPS) {
  for (const tid of group.teamIds) teamGroupMap[tid] = group.id
}

function deriveGroupStandings(predMap: Record<string, { score1: number; score2: number }>) {
  const standings: Record<string, string[]> = {}
  for (const group of GROUPS) {
    const pts: Record<string, number> = {}
    const gd: Record<string, number> = {}
    const gf: Record<string, number> = {}
    for (const id of group.teamIds) { pts[id] = 0; gd[id] = 0; gf[id] = 0 }
    let hasAny = false
    for (const m of GROUP_MATCHES.filter(mm => mm.groupId === group.id)) {
      const pred = predMap[m.id]
      if (!pred) continue
      hasAny = true
      gf[m.team1Id] += pred.score1; gf[m.team2Id] += pred.score2
      gd[m.team1Id] += pred.score1 - pred.score2; gd[m.team2Id] += pred.score2 - pred.score1
      if (pred.score1 > pred.score2) pts[m.team1Id] += 3
      else if (pred.score2 > pred.score1) pts[m.team2Id] += 3
      else { pts[m.team1Id] += 1; pts[m.team2Id] += 1 }
    }
    if (!hasAny) continue
    standings[group.id] = [...group.teamIds].sort((a, b) =>
      pts[b] !== pts[a] ? pts[b] - pts[a] : gd[b] !== gd[a] ? gd[b] - gd[a] : gf[b] - gf[a]
    )
  }
  return standings
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const db = await readDB()
    const participant = db.participants.find(p => p.id === id)
    if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Overall ranking position (consistent with the main leaderboard)
    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    const rankedParticipants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)
    const lb = computeLeaderboard(rankedParticipants, db.matchPredictions, db.groupPredictions, db.results, db.r32TeamPicks, db.knockoutPhasePicks)
    const lbIdx = lb.findIndex(e => e.participant.id === id)
    const rank = lbIdx >= 0 ? lbIdx + 1 : null
    const totalParticipants = lb.length

    const matchDates = db.matchDates ?? {}
    const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    const myPreds = Object.fromEntries(
      db.matchPredictions.filter(p => p.participantId === id).map(p => [p.matchId, p])
    )
    const myGroupPreds = Object.fromEntries(
      db.groupPredictions.filter(p => p.participantId === id).map(p => [p.groupId, p.order])
    )

    // Resolve knockout fixtures (stored as TBD) from the bracket so the modal
    // shows the real teams (e.g. África do Sul × Canadá) instead of TBD.
    const resolvedKnockout = computeBracketFromResults(db.results)
    const teamOf = (m: { id: string; team1Id: string; team2Id: string }) => {
      const r = resolvedKnockout[m.id]
      const t1 = m.team1Id !== 'TBD' ? m.team1Id : (r?.team1Id ?? 'TBD')
      const t2 = m.team2Id !== 'TBD' ? m.team2Id : (r?.team2Id ?? 'TBD')
      return [t1, t2] as const
    }

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

        const [t1, t2] = teamOf(m)
        return {
          matchId: m.id,
          matchNumber: m.matchNumber,
          phase: m.phase,
          groupId: m.groupId,
          team1: { id: t1, name: teamById[t1]?.name ?? t1, flag: teamById[t1]?.flag ?? '🏳' },
          team2: { id: t2, name: teamById[t2]?.name ?? t2, flag: teamById[t2]?.flag ?? '🏳' },
          date: matchDates[m.id]?.date ?? null,
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
    const matchPoints = played.reduce((sum, p) => sum + (p.points ?? 0), 0)
    const correctResults = played.filter(p => p.correctResult).length
    const correctScores = played.filter(p => p.correctScore).length

    // --- Group standings from actual results ---
    const groupStandings: Record<string, string[]> = {}
    const thirdPlaceStats: { teamId: string; pts: number; gd: number; gf: number }[] = []
    for (const group of GROUPS) {
      const pts: Record<string, number> = {}
      const gd: Record<string, number> = {}
      const gf: Record<string, number> = {}
      for (const id of group.teamIds) { pts[id] = 0; gd[id] = 0; gf[id] = 0 }
      const groupMatchList = GROUP_MATCHES.filter(m => m.groupId === group.id)
      let allPlayed = true
      for (const m of groupMatchList) {
        const res = resultMap[m.id]
        if (!res) { allPlayed = false; continue }
        gf[m.team1Id] += res.score1; gf[m.team2Id] += res.score2
        gd[m.team1Id] += res.score1 - res.score2; gd[m.team2Id] += res.score2 - res.score1
        if (res.score1 > res.score2) pts[m.team1Id] += 3
        else if (res.score2 > res.score1) pts[m.team2Id] += 3
        else { pts[m.team1Id] += 1; pts[m.team2Id] += 1 }
      }
      if (!allPlayed) continue
      const sorted = [...group.teamIds].sort((a, b) =>
        pts[b] !== pts[a] ? pts[b] - pts[a] : gd[b] !== gd[a] ? gd[b] - gd[a] : gf[b] - gf[a]
      )
      groupStandings[group.id] = sorted
      if (sorted[2]) thirdPlaceStats.push({ teamId: sorted[2], pts: pts[sorted[2]], gd: gd[sorted[2]], gf: gf[sorted[2]] })
    }

    const allGroupsDone = Object.keys(groupStandings).length === GROUPS.length
    const completedGroupIds = new Set(Object.keys(groupStandings))
    const qualifiedR32 = new Set<string>()
    for (const s of Object.values(groupStandings)) {
      if (s[0]) qualifiedR32.add(s[0])
      if (s[1]) qualifiedR32.add(s[1])
    }
    if (allGroupsDone) {
      const best8 = [...thirdPlaceStats]
        .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.gd !== a.gd ? b.gd - a.gd : b.gf - a.gf)
        .slice(0, 8)
      for (const t of best8) qualifiedR32.add(t.teamId)
    }

    // --- Predicted group standings ---
    // Use stored groupPredictions when available (authoritative), otherwise derive from match preds
    const hasStoredGroupPreds = Object.keys(myGroupPreds).length > 0
    const predictedStandings = hasStoredGroupPreds
      ? myGroupPreds
      : deriveGroupStandings(myPreds)

    // --- Group order bonus ---
    type TeamRef = { id: string; name: string; flag: string }
    const groupDetail: { groupId: string; predicted: TeamRef[]; actual: TeamRef[]; correct: boolean; pts: number }[] = []
    let groupOrderPoints = 0
    for (const [groupId, predicted] of Object.entries(predictedStandings)) {
      const actual = groupStandings[groupId]
      if (!actual) continue
      const correct = JSON.stringify(predicted) === JSON.stringify(actual)
      if (correct) groupOrderPoints += 2
      const toRef = (ids: string[]) => ids.map(tid => ({ id: tid, name: teamById[tid]?.name ?? tid, flag: teamById[tid]?.flag ?? '🏳' }))
      groupDetail.push({ groupId, predicted: toRef(predicted), actual: toRef(actual), correct, pts: correct ? 2 : 0 })
    }

    // --- R32 advancement bonus ---
    const r32Detail: { teamId: string; name: string; flag: string; groupId: string; pts: number }[] = []
    let r32Points = 0
    const myR32Picks = db.r32TeamPicks?.find(p => p.participantId === id)
    if (myR32Picks) {
      // Use explicit R32 bracket picks from aposta26.arq
      for (const teamId of myR32Picks.teamIds) {
        if (qualifiedR32.has(teamId)) {
          const groupId = teamGroupMap[teamId] ?? ''
          if (groupId && completedGroupIds.has(groupId)) {
            r32Points += 3
            r32Detail.push({ teamId, name: teamById[teamId]?.name ?? teamId, flag: teamById[teamId]?.flag ?? '🏳', groupId, pts: 3 })
          }
        }
      }
    } else {
      for (const [groupId, predicted] of Object.entries(predictedStandings)) {
        if (!completedGroupIds.has(groupId)) continue
        const candidates = [predicted[0], predicted[1], predicted[2]].filter(Boolean)
        for (const teamId of candidates) {
          if (qualifiedR32.has(teamId)) {
            r32Points += 3
            r32Detail.push({ teamId, name: teamById[teamId]?.name ?? teamId, flag: teamById[teamId]?.flag ?? '🏳', groupId, pts: 3 })
          }
        }
      }
    }

    const phasePoints = groupOrderPoints + r32Points
    const totalPoints = matchPoints + phasePoints

    // --- Group predictions for all 12 groups (for "Seleções" tab) ---
    const toRef = (tid: string) => ({ id: tid, name: teamById[tid]?.name ?? tid, flag: teamById[tid]?.flag ?? '🏳' })
    const r32PickSet = myR32Picks ? new Set(myR32Picks.teamIds) : null
    const groupPredictions = GROUPS.map(group => {
      const predicted = predictedStandings[group.id] ?? []
      const actual = groupStandings[group.id] ?? null
      return {
        groupId: group.id,
        predicted: predicted.map(toRef),
        actual: actual ? actual.map(toRef) : null,
        complete: !!actual,
        // r32Qualified: true when team is in explicit R32 picks (if available) AND actually qualified
        r32Qualified: predicted.map(tid =>
          r32PickSet ? (r32PickSet.has(tid) && qualifiedR32.has(tid)) : qualifiedR32.has(tid)
        ),
      }
    })

    return NextResponse.json({
      participant: { id: participant.id, name: participant.name },
      predictions,
      summary: { totalPoints, matchPoints, correctResults, correctScores, matchesPlayed: played.length, groupOrderPoints, r32Points, phasePoints, rank, totalParticipants },
      groupDetail,
      r32Detail,
      groupPredictions,
    })
  } catch (err) {
    console.error('[participante]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
