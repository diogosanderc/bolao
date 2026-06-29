import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard, scoreMatch, computeGroupStandingsWithStats } from '@/lib/scoring'
import { ALL_MATCHES, matchById, teamById } from '@/lib/copa2026'
import { computeBracketFromResults } from '@/lib/bracket'

export async function GET() {
  try {
    const db = await readDB()
    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) {
      predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    }
    const validParticipants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)

    // Sort results by match date so "last result" is chronologically last
    const matchDates = db.matchDates ?? {}
    const sortedResults = [...db.results].sort((a, b) => {
      const dateA = matchDates[a.matchId]?.date ?? ''
      const dateB = matchDates[b.matchId]?.date ?? ''
      return dateA.localeCompare(dateB)
    })

    // Inject live match scores as provisional results so the leaderboard
    // reflects in-progress matches in real time.
    const liveStates: Record<string, any> = (db as any).liveMatchStates ?? {}
    const playedMatchIds = new Set(db.results.map(r => r.matchId))
    const provisionalResults: { matchId: string; score1: number; score2: number }[] = []
    let hasLive = false
    const now = Date.now()
    for (const [matchId, state] of Object.entries(liveStates)) {
      if (playedMatchIds.has(matchId)) continue
      const inProgressStatuses = ['in', 'halftime', 'extratime', 'et_halftime', 'penalties']
      if (inProgressStatuses.includes(state.status) || state.status === 'completed') {
        provisionalResults.push({ matchId, score1: state.score1, score2: state.score2 })
        // Only mark as live if match isn't stale (started > 3h ago means it likely ended)
        if (inProgressStatuses.includes(state.status)) {
          const matchDate = matchDates[matchId]?.date
          const stale = matchDate && (now - new Date(matchDate).getTime()) > 3 * 3_600_000
          if (!stale) hasLive = true
        }
      }
    }
    const allResults = [...sortedResults, ...provisionalResults]

    const leaderboard = computeLeaderboard(
      validParticipants,
      db.matchPredictions,
      db.groupPredictions,
      allResults,
      db.r32TeamPicks,
      db.knockoutPhasePicks
    )

    // Compute previous leaderboard (all results except the last) for position change arrows
    // Compute last-N-matches points per participant
    const last4Results = sortedResults.slice(-4)
    const last4PointsMap = new Map<string, number>()
    // Individual breakdown for last 2 matches: [secondLast, last]
    const secondLastResult = sortedResults.length >= 2 ? sortedResults[sortedResults.length - 2] : null
    const lastResult = sortedResults.length >= 1 ? sortedResults[sortedResults.length - 1] : null
    const secondLastPtsMap = new Map<string, number>()
    const lastPtsMap = new Map<string, number>()
    const lastPredMap = new Map<string, { score1: number; score2: number }>()
    for (const participant of validParticipants) {
      let pts4 = 0
      for (const result of last4Results) {
        const match = matchById[result.matchId]
        if (!match) continue
        const pred = db.matchPredictions.find(
          p => p.participantId === participant.id && p.matchId === result.matchId
        )
        if (pred) {
          const s = scoreMatch(pred, result, match).total
          pts4 += s
          if (secondLastResult && result.matchId === secondLastResult.matchId) secondLastPtsMap.set(participant.id, s)
          if (lastResult && result.matchId === lastResult.matchId) {
            lastPtsMap.set(participant.id, s)
            lastPredMap.set(participant.id, { score1: pred.score1, score2: pred.score2 })
          }
        }
      }
      last4PointsMap.set(participant.id, pts4)
    }

    // Last completed group bonus: bonus earned from the most recently closed group only
    const { standings: groupStandings } = computeGroupStandingsWithStats(allResults)
    // Find the group whose last match was played most recently
    let lastGroupId: string | null = null
    for (let i = sortedResults.length - 1; i >= 0; i--) {
      const match = matchById[sortedResults[i].matchId]
      if (match?.phase === 'group' && match.groupId && groupStandings[match.groupId]) {
        lastGroupId = match.groupId
        break
      }
    }
    const lastGroupBonusMap = new Map<string, number>()
    if (lastGroupId) {
      const actualOrder = groupStandings[lastGroupId] ?? []
      // Teams that qualified to R32 from this group (top 2 once the group is closed)
      const qualifiedFromGroup = [actualOrder[0], actualOrder[1]].filter(Boolean)
      for (const participant of validParticipants) {
        // +3 per qualified team that the participant explicitly picked for the R32 bracket
        const r32 = db.r32TeamPicks?.find(p => p.participantId === participant.id)
        const r32Set = r32 ? new Set(r32.teamIds) : null
        let bonus = 0
        for (const teamId of qualifiedFromGroup) {
          if (r32Set ? r32Set.has(teamId) : false) bonus += 3
        }
        // +2 for predicting the full group order exactly
        const gp = db.groupPredictions.find(p => p.participantId === participant.id && p.groupId === lastGroupId)
        if (gp && actualOrder.length > 0 && JSON.stringify(gp.order) === JSON.stringify(actualOrder)) bonus += 2
        lastGroupBonusMap.set(participant.id, bonus)
      }
    }

    // --- Last knockout game contribution: X (result pts) + Y (mata-mata rule) ---
    const KO_ADV: Record<string, number> = { round_of_32: 3, round_of_16: 4, quarterfinal: 6, semifinal: 8, final: 10 }
    const CHAMP_PTS = 12
    const KO_CHAIN = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']
    const nextKoPhase = (p: string) => { const i = KO_CHAIN.indexOf(p); return i >= 0 && i < KO_CHAIN.length - 1 ? KO_CHAIN[i + 1] : null }
    const resolvedKO = computeBracketFromResults(db.results)
    // Most recent knockout match (advancement chain) with a result
    let lastKo: { res: typeof sortedResults[0]; phase: string } | null = null
    for (let i = sortedResults.length - 1; i >= 0; i--) {
      const m = matchById[sortedResults[i].matchId]
      if (m && KO_CHAIN.includes(m.phase)) { lastKo = { res: sortedResults[i], phase: m.phase }; break }
    }
    const lastKoResultMap = new Map<string, number>()
    const lastKoRuleMap = new Map<string, number>()
    if (lastKo) {
      const m = matchById[lastKo.res.matchId]!
      const rk = resolvedKO[lastKo.res.matchId]
      const t1 = m.team1Id !== 'TBD' ? m.team1Id : rk?.team1Id
      const t2 = m.team2Id !== 'TBD' ? m.team2Id : rk?.team2Id
      const r = lastKo.res
      const winner = r.score1 > r.score2 ? t1 : r.score2 > r.score1 ? t2 : r.advancingTeamId
      const np = nextKoPhase(lastKo.phase)
      for (const participant of validParticipants) {
        const pred = db.matchPredictions.find(p => p.participantId === participant.id && p.matchId === r.matchId)
        const x = pred ? scoreMatch(pred, r, m).total : 0
        let y = 0
        const ko = db.knockoutPhasePicks?.find(p => p.participantId === participant.id)
        if (ko && winner && winner !== 'TBD') {
          const picks: Record<string, string[]> = { round_of_16: ko.r16, quarterfinal: ko.qf, semifinal: ko.sf, final: ko.finalists }
          if (np && picks[np]?.includes(winner)) y += KO_ADV[np]
          if (lastKo.phase === 'final' && ko.champion === winner) y += CHAMP_PTS
        }
        lastKoResultMap.set(participant.id, x)
        lastKoRuleMap.set(participant.id, y)
      }
    }

    // Remaining matches (non-TBD only — group stage matches we can predict)
    const allPlayedIds = new Set(allResults.map(r => r.matchId))
    const remainingMatches = ALL_MATCHES.filter(
      m => !allPlayedIds.has(m.id) && m.team1Id !== 'TBD' && m.team2Id !== 'TBD'
    ).length
    const maxPerMatch = 8

    // Top 7 threshold: points of the participant currently in 7th position
    const top7Score = leaderboard.length >= 7 ? leaderboard[6].totalPoints : 0
    const firstScore = leaderboard[0]?.totalPoints ?? 0

    let leaderboardWithChanges: (typeof leaderboard[0] & {
      positionChange?: number
      last4Points?: number
      lastMatchPts?: number
      secondLastMatchPts?: number
      lastMatchPred?: { score1: number; score2: number } | null
      groupBonus?: number
      lastKoResultPts?: number
      lastKoRulePts?: number
      maxPossiblePoints?: number
      pointsToFirst?: number
      pointsToTop7?: number
      canReachFirst?: boolean
      canReachTop7?: boolean
      isInTop7?: boolean
    })[] = leaderboard.map((entry, idx) => {
      const rank = leaderboard.filter(e => e.totalPoints > entry.totalPoints).length + 1
      const maxPossiblePoints = entry.totalPoints + remainingMatches * maxPerMatch
      return {
        ...entry,
        last4Points: last4PointsMap.get(entry.participant.id) ?? 0,
        lastMatchPts: lastPtsMap.get(entry.participant.id) ?? 0,
        secondLastMatchPts: secondLastPtsMap.get(entry.participant.id) ?? 0,
        lastMatchPred: lastPredMap.get(entry.participant.id) ?? null,
        groupBonus: lastGroupBonusMap.get(entry.participant.id) ?? 0,
        lastKoResultPts: lastKoResultMap.get(entry.participant.id) ?? 0,
        lastKoRulePts: lastKoRuleMap.get(entry.participant.id) ?? 0,
        maxPossiblePoints,
        pointsToFirst: Math.max(0, firstScore - entry.totalPoints),
        pointsToTop7: Math.max(0, top7Score - entry.totalPoints),
        canReachFirst: maxPossiblePoints >= firstScore,
        canReachTop7: leaderboard.length < 7 || maxPossiblePoints >= top7Score,
        isInTop7: rank <= 7,
      }
    })
    // Position change + livePoints (points gained exclusively from current live matches)
    const baseForComparison = hasLive ? sortedResults : sortedResults.slice(0, -1)
    if (hasLive || sortedResults.length > 1) {
      const prevLeaderboard = computeLeaderboard(
        validParticipants,
        db.matchPredictions,
        db.groupPredictions,
        baseForComparison,
        db.r32TeamPicks,
        db.knockoutPhasePicks
      )
      const prevPointsMap = new Map<string, number>()
      const prevRankMap = new Map<string, number>()
      for (const entry of prevLeaderboard) {
        const prevRank = prevLeaderboard.filter(e => e.totalPoints > entry.totalPoints).length + 1
        prevRankMap.set(entry.participant.id, prevRank)
        prevPointsMap.set(entry.participant.id, entry.totalPoints)
      }
      leaderboardWithChanges = leaderboardWithChanges.map(entry => {
        const currentRank = leaderboard.filter(e => e.totalPoints > entry.totalPoints).length + 1
        const prevRank = prevRankMap.get(entry.participant.id)
        const positionChange = prevRank !== undefined ? prevRank - currentRank : undefined
        const prevPts = prevPointsMap.get(entry.participant.id) ?? entry.totalPoints
        const livePoints = hasLive ? Math.max(0, entry.totalPoints - prevPts) : 0
        return { ...entry, positionChange, livePoints }
      })
    }

    // Resolve knockout teams (TBD slots) from the bracket for display
    const resolvedKnockout = computeBracketFromResults(db.results)
    const teamRef = (m: { id: string; team1Id: string; team2Id: string }) => {
      const rk = resolvedKnockout[m.id]
      const t1 = m.team1Id !== 'TBD' ? m.team1Id : (rk?.team1Id ?? 'TBD')
      const t2 = m.team2Id !== 'TBD' ? m.team2Id : (rk?.team2Id ?? 'TBD')
      return {
        team1: { id: t1, name: teamById[t1]?.name ?? t1, flag: teamById[t1]?.flag ?? '🏳' },
        team2: { id: t2, name: teamById[t2]?.name ?? t2, flag: teamById[t2]?.flag ?? '🏳' },
      }
    }

    // Last 4 played matches, most recent first
    const recentMatches = sortedResults
      .slice(-4)
      .reverse()
      .map(r => {
        const match = matchById[r.matchId]
        if (!match) return null
        return { matchId: r.matchId, score1: r.score1, score2: r.score2, ...teamRef(match) }
      })
      .filter(Boolean)

    const lastMatch = recentMatches[0] ?? null

    return NextResponse.json({ leaderboard: leaderboardWithChanges, lastMatch, recentMatches, remainingMatches, hasLive })
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json({ leaderboard: [], lastMatch: null }, { status: 200 })
  }
}
