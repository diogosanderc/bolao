import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { matchById, teamById, ALL_MATCHES, GROUP_MATCHES, GROUPS } from '@/lib/copa2026'
import { scoreMatch } from '@/lib/scoring'

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

    const matchDates = db.matchDates ?? {}
    const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    const myPreds = Object.fromEntries(
      db.matchPredictions.filter(p => p.participantId === id).map(p => [p.matchId, p])
    )
    const myGroupPreds = Object.fromEntries(
      db.groupPredictions.filter(p => p.participantId === id).map(p => [p.groupId, p.order])
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

    const phasePoints = groupOrderPoints + r32Points
    const totalPoints = matchPoints + phasePoints

    // --- Group predictions for all 12 groups (for "Seleções" tab) ---
    const toRef = (tid: string) => ({ id: tid, name: teamById[tid]?.name ?? tid, flag: teamById[tid]?.flag ?? '🏳' })
    const groupPredictions = GROUPS.map(group => {
      const predicted = predictedStandings[group.id] ?? []
      const actual = groupStandings[group.id] ?? null
      return {
        groupId: group.id,
        predicted: predicted.map(toRef),
        actual: actual ? actual.map(toRef) : null,
        complete: !!actual,
        r32Qualified: predicted.map(tid => qualifiedR32.has(tid)),
      }
    })

    return NextResponse.json({
      participant: { id: participant.id, name: participant.name },
      predictions,
      summary: { totalPoints, matchPoints, correctResults, correctScores, matchesPlayed: played.length, groupOrderPoints, r32Points, phasePoints },
      groupDetail,
      r32Detail,
      groupPredictions,
    })
  } catch (err) {
    console.error('[participante]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
