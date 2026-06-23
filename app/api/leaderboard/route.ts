import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard, scoreMatch } from '@/lib/scoring'
import { ALL_MATCHES, matchById, teamById } from '@/lib/copa2026'

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
      if (state.status === 'in' || state.status === 'halftime' || state.status === 'completed') {
        provisionalResults.push({ matchId, score1: state.score1, score2: state.score2 })
        // Only mark as live if match isn't stale (started > 3h ago means it likely ended)
        if (state.status === 'in' || state.status === 'halftime') {
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
      allResults
    )

    // Compute previous leaderboard (all results except the last) for position change arrows
    // Compute last-4-matches points per participant
    const last4Results = sortedResults.slice(-4)
    const last4PointsMap = new Map<string, number>()
    for (const participant of validParticipants) {
      let pts = 0
      for (const result of last4Results) {
        const match = matchById[result.matchId]
        if (!match) continue
        const pred = db.matchPredictions.find(
          p => p.participantId === participant.id && p.matchId === result.matchId
        )
        if (pred) pts += scoreMatch(pred, result, match).total
      }
      last4PointsMap.set(participant.id, pts)
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
        baseForComparison
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

    let lastMatch = null
    if (sortedResults.length > 0) {
      const last = sortedResults[sortedResults.length - 1]
      const match = matchById[last.matchId]
      if (match) {
        lastMatch = {
          matchId: last.matchId,
          score1: last.score1,
          score2: last.score2,
          team1: { id: match.team1Id, name: teamById[match.team1Id]?.name ?? match.team1Id, flag: teamById[match.team1Id]?.flag ?? '🏳' },
          team2: { id: match.team2Id, name: teamById[match.team2Id]?.name ?? match.team2Id, flag: teamById[match.team2Id]?.flag ?? '🏳' },
        }
      }
    }

    return NextResponse.json({ leaderboard: leaderboardWithChanges, lastMatch, remainingMatches, hasLive })
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json({ leaderboard: [], lastMatch: null }, { status: 200 })
  }
}
