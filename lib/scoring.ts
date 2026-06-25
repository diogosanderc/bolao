import {
  Match,
  MatchResult,
  MatchPrediction,
  GroupPrediction,
  Participant,
  LeaderboardEntry,
} from './types'
import { GROUPS, ALL_MATCHES, GROUP_MATCHES, matchById } from './copa2026'

function getResult(score1: number, score2: number): 'home' | 'draw' | 'away' {
  if (score1 > score2) return 'home'
  if (score2 > score1) return 'away'
  return 'draw'
}

// Scoring per match:
//   Group stage:   +1 correct result  +  +1 exact score  (max 2)
//   Knockout:      +1 correct result only                 (max 1)
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
  const correctResult =
    getResult(prediction.score1, prediction.score2) ===
    getResult(result.score1, result.score2)
  const correctScore =
    prediction.score1 === result.score1 && prediction.score2 === result.score2
  const correctAdvancing =
    match.phase !== 'group' &&
    result.score1 === result.score2 &&
    !!result.advancingTeamId &&
    prediction.advancingTeamId === result.advancingTeamId

  let total = 0
  if (match.phase === 'group') {
    if (correctResult) total += 1
    if (correctScore) total += 1
  } else {
    if (correctResult) total += 1
  }

  return {
    total,
    correctResult,
    correctScore,
    correctGoals: [false, false],
    highScoreBonus: false,
    correctAdvancing,
  }
}

const CHAMPION_POINTS = 6

export function computeLeaderboard(
  participants: Participant[],
  matchPredictions: MatchPrediction[],
  groupPredictions: GroupPrediction[],
  results: MatchResult[]
): LeaderboardEntry[] {
  const resultMap = Object.fromEntries(results.map(r => [r.matchId, r]))
  const lastResult = results.length > 0 ? results[results.length - 1] : null

  // Group standings from group results (for group order bonus)
  const { standings: groupStandings } = computeGroupStandingsWithStats(results)

  return participants.map(participant => {
    const myPreds = matchPredictions.filter(p => p.participantId === participant.id)
    const myGroupPreds = groupPredictions.filter(p => p.participantId === participant.id)

    let matchPoints = 0
    let correctResults = 0
    let correctScores = 0

    for (const pred of myPreds) {
      const res = resultMap[pred.matchId]
      if (!res) continue
      const match = matchById[pred.matchId]
      if (!match) continue
      const s = scoreMatch(pred, res, match)
      matchPoints += s.total
      if (s.correctResult) correctResults++
      if (s.correctScore) correctScores++
    }

    // Champion bonus: +6 for predicting the correct champion (winner of final)
    let championPoints = 0
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
        if (predictedChampion === champion) championPoints = CHAMPION_POINTS
      }
    }

    // Group order bonus: +2 per group where all 4 positions match exactly
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

    const phasePoints = groupOrderPoints + championPoints

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
        correctGoals: 0,
        highScoreBonus: 0,
        groupOrderPoints,
        advancementPoints: { champion: championPoints },
      },
    }
  }).sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints
    return a.participant.name.localeCompare(b.participant.name, 'pt')
  })
}

type ThirdPlaceStat = { teamId: string; groupId: string; pts: number; gd: number; gf: number }

function computeGroupStandingsWithStats(results: MatchResult[]): {
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
