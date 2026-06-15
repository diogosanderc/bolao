import {
  Match,
  MatchResult,
  MatchPrediction,
  GroupPrediction,
  Participant,
  LeaderboardEntry,
  Phase,
} from './types'
import { GROUPS, ALL_MATCHES, matchById } from './copa2026'

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
const GROUP_ORDER_BONUS = 6 // bonus for getting ALL classified in any phase

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

  // Group stage qualified (round_of_32 entrants) — derived from matches with known teams
  for (const match of ALL_MATCHES.filter(m => m.phase === 'round_of_32')) {
    if (match.team1Id !== 'TBD') qualifiedByPhase.round_of_32.add(match.team1Id)
    if (match.team2Id !== 'TBD') qualifiedByPhase.round_of_32.add(match.team2Id)
  }

  // Group standings from group results (for group order bonus)
  const groupStandings = computeGroupStandings(results)

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

      // Predicted teams for this phase: from participant's match predictions for prior phase
      const predictedForPhase = predictedTeamsForPhase(phase, myPreds)
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

    // Group order bonus
    let groupOrderPoints = 0
    for (const gp of myGroupPreds) {
      const actual = groupStandings[gp.groupId]
      if (!actual) continue
      if (JSON.stringify(gp.order) === JSON.stringify(actual)) {
        groupOrderPoints += 2
      }
    }

    // Bonus for all classified in any phase
    for (const phase of phases) {
      const qualified = qualifiedByPhase[phase]
      if (qualified.size === 0) continue
      const predicted = predictedTeamsForPhase(phase, myPreds)
      if (predicted.size >= qualified.size && [...qualified].every(t => predicted.has(t))) {
        phasePoints += GROUP_ORDER_BONUS
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
  }).sort((a, b) => b.totalPoints - a.totalPoints)
}

function nextPhaseOf(phase: Phase): Phase | null {
  const order: Phase[] = ['group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']
  const idx = order.indexOf(phase)
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null
}

function predictedTeamsForPhase(phase: Phase, myPreds: MatchPrediction[]): Set<string> {
  // Teams predicted to reach this phase = winners of previous phase matches
  const priorPhase = priorPhaseOf(phase)
  if (!priorPhase) return new Set()

  const priorMatches = ALL_MATCHES.filter(m => m.phase === priorPhase)
  const teams = new Set<string>()

  for (const match of priorMatches) {
    if (match.team1Id === 'TBD' || match.team2Id === 'TBD') continue
    const pred = myPreds.find(p => p.matchId === match.id)
    if (!pred) continue
    if (pred.score1 > pred.score2) teams.add(match.team1Id)
    else if (pred.score2 > pred.score1) teams.add(match.team2Id)
    else if (pred.advancingTeamId) teams.add(pred.advancingTeamId)
  }
  return teams
}

function priorPhaseOf(phase: Phase): Phase | null {
  const order: Phase[] = ['group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']
  const idx = order.indexOf(phase)
  return idx > 0 ? order[idx - 1] : null
}

function computeGroupStandings(results: MatchResult[]): Record<string, string[]> {
  const standings: Record<string, string[]> = {}
  const resultMap = Object.fromEntries(results.map(r => [r.matchId, r]))

  for (const group of GROUPS) {
    const points: Record<string, number> = {}
    const gd: Record<string, number> = {}
    const gf: Record<string, number> = {}
    for (const id of group.teamIds) { points[id] = 0; gd[id] = 0; gf[id] = 0 }

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
      if (score1 > score2) { points[match.team1Id] += 3 }
      else if (score2 > score1) { points[match.team2Id] += 3 }
      else { points[match.team1Id] += 1; points[match.team2Id] += 1 }
    }

    if (!allPlayed) continue

    standings[group.id] = [...group.teamIds].sort((a, b) => {
      if (points[b] !== points[a]) return points[b] - points[a]
      if (gd[b] !== gd[a]) return gd[b] - gd[a]
      return gf[b] - gf[a]
    })
  }
  return standings
}
