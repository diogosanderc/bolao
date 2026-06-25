import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { scoreMatch } from '@/lib/scoring'
import { ALL_MATCHES, GROUP_MATCHES, matchById, teamById, GROUPS } from '@/lib/copa2026'
import { MatchPrediction } from '@/lib/types'

function deriveGroupStandings(myPreds: MatchPrediction[]): Record<string, string[]> {
  const predMap = Object.fromEntries(myPreds.map(p => [p.matchId, p]))
  const standings: Record<string, string[]> = {}
  for (const group of GROUPS) {
    const pts: Record<string, number> = {}
    const gd: Record<string, number> = {}
    const gf: Record<string, number> = {}
    for (const id of group.teamIds) { pts[id] = 0; gd[id] = 0; gf[id] = 0 }
    let hasAny = false
    for (const m of GROUP_MATCHES.filter(mm => mm.groupId === group.id)) {
      const pred = predMap[m.id]; if (!pred) continue
      hasAny = true
      gf[m.team1Id] += pred.score1; gf[m.team2Id] += pred.score2
      gd[m.team1Id] += pred.score1 - pred.score2; gd[m.team2Id] += pred.score2 - pred.score1
      if (pred.score1 > pred.score2) pts[m.team1Id] += 3
      else if (pred.score2 > pred.score1) pts[m.team2Id] += 3
      else { pts[m.team1Id]++; pts[m.team2Id]++ }
    }
    if (!hasAny) continue
    standings[group.id] = [...group.teamIds].sort((a, b) =>
      pts[b] !== pts[a] ? pts[b] - pts[a] : gd[b] !== gd[a] ? gd[b] - gd[a] : gf[b] - gf[a]
    )
  }
  return standings
}

// GET /api/debug/scoring?name=IVERSON  (or ?all=1 for everyone)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const nameFilter = searchParams.get('name')?.toUpperCase()
  const showAll = searchParams.get('all') === '1'

  const db = await readDB()
  const matchDates = db.matchDates ?? {}

  const sortedResults = [...db.results].sort((a, b) => {
    const dateA = matchDates[a.matchId]?.date ?? ''
    const dateB = matchDates[b.matchId]?.date ?? ''
    return dateA.localeCompare(dateB)
  })
  const resultMap = Object.fromEntries(sortedResults.map(r => [r.matchId, r]))

  // Compute actual group standings (only complete groups)
  const groupStandings: Record<string, string[]> = {}
  const thirdPlaceStats: { teamId: string; groupId: string; pts: number; gd: number; gf: number }[] = []
  for (const group of GROUPS) {
    const pts: Record<string, number> = {}
    const gd: Record<string, number> = {}
    const gf: Record<string, number> = {}
    for (const id of group.teamIds) { pts[id] = 0; gd[id] = 0; gf[id] = 0 }
    const groupMatches = ALL_MATCHES.filter(m => m.groupId === group.id)
    let allPlayed = true
    for (const m of groupMatches) {
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
    if (sorted[2]) thirdPlaceStats.push({ teamId: sorted[2], groupId: group.id, pts: pts[sorted[2]], gd: gd[sorted[2]], gf: gf[sorted[2]] })
  }

  // round_of_32 qualified: top-2 from each completed group always qualify
  // best-8 thirds only determined once ALL 12 groups are complete
  const qualifiedR32 = new Set<string>()
  for (const s of Object.values(groupStandings)) {
    if (s[0]) qualifiedR32.add(s[0])
    if (s[1]) qualifiedR32.add(s[1])
  }
  if (Object.keys(groupStandings).length === GROUPS.length) {
    const best8Third = [...thirdPlaceStats]
      .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.gd !== a.gd ? b.gd - a.gd : b.gf - a.gf)
      .slice(0, 8)
    for (const t of best8Third) qualifiedR32.add(t.teamId)
  }

  const participants = db.participants.filter(p =>
    showAll || (nameFilter && p.name.toUpperCase().includes(nameFilter))
  )

  if (participants.length === 0) {
    return NextResponse.json({ error: 'Nenhum participante encontrado. Use ?name=NOME ou ?all=1' })
  }

  const output = participants.map(participant => {
    const myPreds = db.matchPredictions.filter(p => p.participantId === participant.id)
    const myGroupPreds = db.groupPredictions.filter(p => p.participantId === participant.id)

    // --- Match points ---
    let matchPoints = 0
    const matchDetail: any[] = []
    for (const pred of myPreds) {
      const res = resultMap[pred.matchId]
      if (!res) continue
      const match = matchById[pred.matchId]
      if (!match) continue
      const s = scoreMatch(pred, res, match)
      matchPoints += s.total
      if (s.total > 0) {
        matchDetail.push({
          match: `${teamById[match.team1Id]?.name ?? match.team1Id} ${res.score1}×${res.score2} ${teamById[match.team2Id]?.name ?? match.team2Id}`,
          pred: `${pred.score1}×${pred.score2}`,
          pts: s.total,
          flags: [s.correctResult && 'resultado', s.correctScore && 'placar_exato', s.highScoreBonus && 'highscore'].filter(Boolean),
        })
      }
    }

    // Use stored groupPredictions when available (authoritative), otherwise derive from match preds
    const myGroupPredsMap = Object.fromEntries(myGroupPreds.map(p => [p.groupId, p.order]))
    const hasStoredGroupPreds = myGroupPreds.length > 0
    const predictedStandings = hasStoredGroupPreds ? myGroupPredsMap : deriveGroupStandings(myPreds)

    // --- Group order bonus ---
    let groupOrderPoints = 0
    const groupDetail: any[] = []
    for (const [groupId, predicted] of Object.entries(predictedStandings)) {
      const actual = groupStandings[groupId]
      if (!actual) {
        groupDetail.push({ group: groupId, status: 'incompleto', predicted: predicted.map(id => teamById[id]?.name ?? id), actual: null, pts: 0 })
        continue
      }
      const match = JSON.stringify(predicted) === JSON.stringify(actual)
      if (match) groupOrderPoints += 2
      groupDetail.push({
        group: groupId,
        status: match ? 'ACERTOU' : 'errou',
        predicted: predicted.map(id => teamById[id]?.name ?? id),
        actual: actual.map(id => teamById[id]?.name ?? id),
        pts: match ? 2 : 0,
      })
    }

    // --- Round of 32 advancement ---
    // Give +3 for teams predicted 1st or 2nd that actually qualified to r32.
    // Predicted 3rd only earns bonus once ALL 12 groups are complete (best-8 3rds determined).
    const allGroupsDone = Object.keys(groupStandings).length === GROUPS.length
    let r32Points = 0
    const r32Detail: any[] = []
    for (const [groupId, predicted] of Object.entries(predictedStandings)) {
      const candidates = allGroupsDone
        ? [predicted[0], predicted[1], predicted[2]].filter(Boolean)
        : [predicted[0], predicted[1]].filter(Boolean)
      for (const teamId of candidates) {
        if (qualifiedR32.has(teamId)) {
          r32Points += 3
          r32Detail.push({ team: teamById[teamId]?.name ?? teamId, group: groupId, pts: 3 })
        }
      }
    }

    const total = matchPoints + groupOrderPoints + r32Points

    return {
      name: participant.name,
      total,
      matchPoints,
      groupOrderPoints,
      r32Points,
      phasePoints: groupOrderPoints + r32Points,
      completedGroups: Object.keys(groupStandings),
      qualifiedR32teams: Array.from(qualifiedR32).map(id => teamById[id]?.name ?? id),
      matchDetail,
      groupDetail,
      r32Detail,
      usingDerivedGroupPreds: myGroupPreds.length === 0,
    }
  }).sort((a, b) => b.total - a.total)

  return NextResponse.json({
    completedGroups: Object.keys(groupStandings),
    qualifiedR32count: qualifiedR32.size,
    participants: output,
  })
}
