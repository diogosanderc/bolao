import {
  Match,
  MatchResult,
  MatchPrediction,
  GroupPrediction,
  Participant,
  LeaderboardEntry,
  Phase,
} from './types'
import { GROUPS, ALL_MATCHES, GROUP_MATCHES, matchById } from './copa2026'
import { computeBracketFromResults } from './bracket'

function getResult(score1: number, score2: number): 'home' | 'draw' | 'away' {
  if (score1 > score2) return 'home'
  if (score2 > score1) return 'away'
  return 'draw'
}

export function scoreMatch(
  prediction: MatchPrediction,
  result: MatchResult,
  match: Match
): {
  total: number
  correctResult: boolean
  correctScore: boolean
  correctGoals: [boolean, boolean]
  highScoreBonus: boolean
  correctAdvancing: boolean
} {
  let total = 0
  const correctResult =
    getResult(prediction.score1, prediction.score2) ===
    getResult(result.score1, result.score2)
  const correctScore =
    prediction.score1 === result.score1 && prediction.score2 === result.score2
  const correctGoal1 = prediction.score1 === result.score1
  const correctGoal2 = prediction.score2 === result.score2
  // +2 bonus for correctly predicting a team's goal tally when they scored 4+
  const highScoreBonus1 = result.score1 >= 4 && correctGoal1
  const highScoreBonus2 = result.score2 >= 4 && correctGoal2
  const highScoreBonus = highScoreBonus1 || highScoreBonus2

  const isKnockout = match.phase !== 'group'
  const isDraw = result.score1 === result.score2
  const correctAdvancing =
    isKnockout &&
    isDraw &&
    !!result.advancingTeamId &&
    prediction.advancingTeamId === result.advancingTeamId

  if (correctResult) total += 4
  if (correctGoal1) total += 1
  if (correctGoal2) total += 1
  if (correctScore) total += 2
  if (highScoreBonus1) total += 2
  if (highScoreBonus2) total += 2

  // No extra points for predicting advancing team — it's a tiebreaker, not scored
  // (regulation interpretation: the "resultado" already covers who wins)

  return {
    total,
    correctResult,
    correctScore,
    correctGoals: [correctGoal1, correctGoal2],
    highScoreBonus,
    correctAdvancing,
  }
}

// PHASE ADVANCEMENT POINTS
const ADVANCEMENT_POINTS: Record<Phase, number> = {
  group: 0,
  round_of_32: 3,
  round_of_16: 4,
  quarterfinal: 6,
  semifinal: 8,
  third_place: 0,
  final: 10,
}

const CHAMPION_POINTS = 12

export function computeLeaderboard(
  participants: Participant[],
  matchPredictions: MatchPrediction[],
  groupPredictions: GroupPrediction[],
  results: MatchResult[]
): LeaderboardEntry[] {
  const resultMap = Object.fromEntries(results.map(r => [r.matchId, r]))
  const lastResult = results.length > 0 ? results[results.length - 1] : null

  // For each phase, collect which teams actually qualified
  const qualifiedByPhase: Record<Phase, Set<string>> = {
    group: new Set(),
    round_of_32: new Set(),
    round_of_16: new Set(),
    quarterfinal: new Set(),
    semifinal: new Set(),
    third_place: new Set(),
    final: new Set(),
  }

  // Teams in round_of_32 are top 2 per group + 8 best 3rd place
  // We derive from the group results which teams advanced
  for (const match of ALL_MATCHES) {
    const res = resultMap[match.id]
    if (!res) continue
    if (match.phase !== 'group') {
      // The teams that played in this phase are qualified for this phase
      if (match.team1Id !== 'TBD') qualifiedByPhase[match.phase].add(match.team1Id)
      if (match.team2Id !== 'TBD') qualifiedByPhase[match.phase].add(match.team2Id)
      // Winner advances to next phase (determined by admin result/advancing)
      const winner =
        res.score1 > res.score2
          ? match.team1Id
          : res.score2 > res.score1
          ? match.team2Id
          : res.advancingTeamId
      if (winner) {
        const nextPhase = nextPhaseOf(match.phase)
        if (nextPhase) qualifiedByPhase[nextPhase].add(winner)
      }
    }
  }

  // Group standings from group results (for group order bonus + round_of_32 qualified)
  const { standings: groupStandings, thirdPlaceStats } = computeGroupStandingsWithStats(results)
  const allGroupsComplete = Object.keys(groupStandings).length === GROUPS.length

  // Resolve actual teams for all knockout slots (needed for advancement scoring)
  const resolvedKnockoutTeams = computeBracketFromResults(results)

  // Top 2 from each completed group always qualify for round_of_32
  for (const standing of Object.values(groupStandings)) {
    if (standing[0]) qualifiedByPhase.round_of_32.add(standing[0])
    if (standing[1]) qualifiedByPhase.round_of_32.add(standing[1])
  }
  // Best-8 3rd-place finishers: only determined when ALL 12 groups are complete
  if (Object.keys(groupStandings).length === GROUPS.length) {
    const best8Third = [...thirdPlaceStats]
      .sort((a, b) => b.pts !== a.pts ? b.pts - a.pts : b.gd !== a.gd ? b.gd - a.gd : b.gf - a.gf)
      .slice(0, 8)
    for (const t of best8Third) qualifiedByPhase.round_of_32.add(t.teamId)
  }
  // Also keep any round_of_32 match teams already set by admin (non-TBD)
  for (const match of ALL_MATCHES.filter(m => m.phase === 'round_of_32')) {
    if (match.team1Id !== 'TBD') qualifiedByPhase.round_of_32.add(match.team1Id)
    if (match.team2Id !== 'TBD') qualifiedByPhase.round_of_32.add(match.team2Id)
  }

  return participants.map(participant => {
    const myPreds = matchPredictions.filter(p => p.participantId === participant.id)
    const myGroupPreds = groupPredictions.filter(p => p.participantId === participant.id)

    let matchPoints = 0
    let correctResults = 0
    let correctScores = 0
    let correctGoals = 0
    let highScoreBonus = 0

    for (const pred of myPreds) {
      const res = resultMap[pred.matchId]
      if (!res) continue
      const match = matchById[pred.matchId]
      if (!match) continue
      const s = scoreMatch(pred, res, match)
      matchPoints += s.total
      if (s.correctResult) correctResults++
      if (s.correctScore) correctScores++
      if (s.correctGoals[0] || s.correctGoals[1]) correctGoals++
      if (s.highScoreBonus) highScoreBonus++
    }

    // Advancement points: for each knockout phase, count predicted teams that qualified
    const advancementPoints: Record<string, number> = {}
    const phases: Phase[] = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']

    let phasePoints = 0
    for (const phase of phases) {
      const qualified = qualifiedByPhase[phase]
      if (qualified.size === 0) continue

      // For round_of_32: derive from group predictions or match predictions
      // For other phases: use match prediction winners from prior phase
      const predictedForPhase = phase === 'round_of_32'
        ? predictedTeamsForRoundOf32(myPreds, myGroupPreds, allGroupsComplete)
        : predictedTeamsForPhase(phase, myPreds, resolvedKnockoutTeams)
      let pts = 0
      for (const teamId of predictedForPhase) {
        if (qualified.has(teamId)) {
          const p = ADVANCEMENT_POINTS[phase]
          pts += p
        }
      }

      // Champion bonus
      if (phase === 'final') {
        const finalResult = results.find(r => {
          const m = matchById[r.matchId]
          return m?.phase === 'final'
        })
        if (finalResult) {
          const finalMatch = matchById[finalResult.matchId]
          const champion =
            finalResult.score1 > finalResult.score2
              ? finalMatch?.team1Id
              : finalResult.score2 > finalResult.score1
              ? finalMatch?.team2Id
              : finalResult.advancingTeamId
          const myFinalPred = myPreds.find(p => matchById[p.matchId]?.phase === 'final')
          if (myFinalPred && champion) {
            const predictedChampion =
              myFinalPred.score1 > myFinalPred.score2
                ? matchById[myFinalPred.matchId]?.team1Id
                : myFinalPred.score2 > myFinalPred.score1
                ? matchById[myFinalPred.matchId]?.team2Id
                : myFinalPred.advancingTeamId
            if (predictedChampion === champion) pts += CHAMPION_POINTS
          }
        }
      }

      advancementPoints[phase] = pts
      phasePoints += pts
    }

    // Group order bonus: compare predicted group order vs actual
    // Use DB group predictions if available; otherwise derive from match predictions
    let groupOrderPoints = 0
    if (myGroupPreds.length > 0) {
      for (const gp of myGroupPreds) {
        const actual = groupStandings[gp.groupId]
        if (!actual) continue
        if (JSON.stringify(gp.order) === JSON.stringify(actual)) groupOrderPoints += 2
      }
    } else {
      const { standings: predictedStandings } = computePredictedGroupStandings(myPreds)
      for (const [groupId, predicted] of Object.entries(predictedStandings)) {
        const actual = groupStandings[groupId]
        if (!actual) continue
        if (JSON.stringify(predicted) === JSON.stringify(actual)) groupOrderPoints += 2
      }
    }

    phasePoints += groupOrderPoints

    let lastMatchPoints = 0
    if (lastResult) {
      const lastMatch = matchById[lastResult.matchId]
      if (lastMatch) {
        const pred = myPreds.find(p => p.matchId === lastResult.matchId)
        if (pred) lastMatchPoints = scoreMatch(pred, lastResult, lastMatch).total
      }
    }

    return {
      participant,
      totalPoints: matchPoints + phasePoints,
      matchPoints,
      phasePoints,
      lastMatchPoints,
      breakdown: {
        correctResults,
        correctScores,
        correctGoals,
        highScoreBonus,
        groupOrderPoints,
        advancementPoints,
      },
    }
  }).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return a.participant.name.localeCompare(b.participant.name, 'pt')
  })
}

function nextPhaseOf(phase: Phase): Phase | null {
  const order: Phase[] = ['group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']
  const idx = order.indexOf(phase)
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null
}

function predictedTeamsForPhase(
  phase: Phase,
  myPreds: MatchPrediction[],
  resolvedTeams: Record<string, { team1Id: string; team2Id: string }>
): Set<string> {
  const priorPhase = priorPhaseOf(phase)
  if (!priorPhase) return new Set()

  const priorMatches = ALL_MATCHES.filter(m => m.phase === priorPhase)
  const teams = new Set<string>()

  for (const match of priorMatches) {
    const t = resolvedTeams[match.id]
    if (!t || t.team1Id === 'TBD' || t.team2Id === 'TBD') continue
    const pred = myPreds.find(p => p.matchId === match.id)
    if (!pred) continue
    if (pred.score1 > pred.score2) teams.add(t.team1Id)
    else if (pred.score2 > pred.score1) teams.add(t.team2Id)
    else if (pred.advancingTeamId) teams.add(pred.advancingTeamId)
  }
  return teams
}

function priorPhaseOf(phase: Phase): Phase | null {
  const order: Phase[] = ['group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']
  const idx = order.indexOf(phase)
  return idx > 0 ? order[idx - 1] : null
}

type ThirdPlaceStat = { teamId: string; groupId: string; pts: number; gd: number; gf: number }

export function computeGroupStandingsWithStats(results: MatchResult[]): {
  standings: Record<string, string[]>
  thirdPlaceStats: ThirdPlaceStat[]
} {
  const standings: Record<string, string[]> = {}
  const thirdPlaceStats: ThirdPlaceStat[] = []
  const resultMap = Object.fromEntries(results.map(r => [r.matchId, r]))

  for (const group of GROUPS) {
    const pts: Record<string, number> = {}
    const gd: Record<string, number> = {}
    const gf: Record<string, number> = {}
    for (const id of group.teamIds) { pts[id] = 0; gd[id] = 0; gf[id] = 0 }

    const groupMatchList = ALL_MATCHES.filter(m => m.groupId === group.id)
    let allPlayed = true
    for (const match of groupMatchList) {
      const res = resultMap[match.id]
      if (!res) { allPlayed = false; continue }
      const { score1, score2 } = res
      gf[match.team1Id] += score1
      gf[match.team2Id] += score2
      gd[match.team1Id] += score1 - score2
      gd[match.team2Id] += score2 - score1
      if (score1 > score2) { pts[match.team1Id] += 3 }
      else if (score2 > score1) { pts[match.team2Id] += 3 }
      else { pts[match.team1Id] += 1; pts[match.team2Id] += 1 }
    }

    if (!allPlayed) continue

    const sorted = [...group.teamIds].sort((a, b) => {
      if (pts[b] !== pts[a]) return pts[b] - pts[a]
      if (gd[b] !== gd[a]) return gd[b] - gd[a]
      return gf[b] - gf[a]
    })
    standings[group.id] = sorted
    if (sorted[2]) {
      thirdPlaceStats.push({ teamId: sorted[2], groupId: group.id, pts: pts[sorted[2]], gd: gd[sorted[2]], gf: gf[sorted[2]] })
    }
  }
  return { standings, thirdPlaceStats }
}

// Derive predicted group standings from a participant's match predictions
// (mirrors the computeGroupStandings logic in lib/bracket.ts)
function computePredictedGroupStandings(
  myPreds: MatchPrediction[]
): { standings: Record<string, string[]>; thirdPlaceStats: ThirdPlaceStat[] } {
  const predMap = Object.fromEntries(myPreds.map(p => [p.matchId, p]))
  const standings: Record<string, string[]> = {}
  const thirdPlaceStats: ThirdPlaceStat[] = []

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

    const sorted = [...group.teamIds].sort((a, b) => {
      if (pts[b] !== pts[a]) return pts[b] - pts[a]
      if (gd[b] !== gd[a]) return gd[b] - gd[a]
      return gf[b] - gf[a]
    })
    standings[group.id] = sorted
    if (sorted[2]) {
      thirdPlaceStats.push({ teamId: sorted[2], groupId: group.id, pts: pts[sorted[2]], gd: gd[sorted[2]], gf: gf[sorted[2]] })
    }
  }
  return { standings, thirdPlaceStats }
}

function predictedTeamsForRoundOf32(
  myPreds: MatchPrediction[],
  myGroupPreds: GroupPrediction[],
  _allGroupsComplete: boolean
): Set<string> {
  // If DB has explicit group predictions, use them; otherwise derive from match predictions.
  // A team predicted in any top-3 slot earns +3 if it actually qualifies for R32 by any means
  // (1st, 2nd, or best 3rd-place). The R32 qualification set handles the actual check.
  if (myGroupPreds.length > 0) {
    const teams = new Set<string>()
    for (const gp of myGroupPreds) {
      if (gp.order[0]) teams.add(gp.order[0])
      if (gp.order[1]) teams.add(gp.order[1])
      if (gp.order[2]) teams.add(gp.order[2])
    }
    return teams
  }

  const { standings } = computePredictedGroupStandings(myPreds)
  const teams = new Set<string>()
  for (const sorted of Object.values(standings)) {
    if (sorted[0]) teams.add(sorted[0])
    if (sorted[1]) teams.add(sorted[1])
    if (sorted[2]) teams.add(sorted[2])
  }
  return teams
}
