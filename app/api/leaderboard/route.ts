import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { matchById, teamById } from '@/lib/copa2026'

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

    const leaderboard = computeLeaderboard(
      validParticipants,
      db.matchPredictions,
      db.groupPredictions,
      sortedResults
    )

    // Compute previous leaderboard (all results except the last) for position change arrows
    let leaderboardWithChanges: (typeof leaderboard[0] & { positionChange?: number })[] = leaderboard
    if (sortedResults.length > 1) {
      const prevResults = sortedResults.slice(0, -1)
      const prevLeaderboard = computeLeaderboard(
        validParticipants,
        db.matchPredictions,
        db.groupPredictions,
        prevResults
      )
      const prevRankMap = new Map<string, number>()
      for (const entry of prevLeaderboard) {
        const prevRank = prevLeaderboard.filter(e => e.totalPoints > entry.totalPoints).length + 1
        prevRankMap.set(entry.participant.id, prevRank)
      }
      leaderboardWithChanges = leaderboard.map(entry => {
        const currentRank = leaderboard.filter(e => e.totalPoints > entry.totalPoints).length + 1
        const prevRank = prevRankMap.get(entry.participant.id)
        const positionChange = prevRank !== undefined ? prevRank - currentRank : undefined
        return { ...entry, positionChange }
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

    return NextResponse.json({ leaderboard: leaderboardWithChanges, lastMatch })
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json({ leaderboard: [], lastMatch: null }, { status: 200 })
  }
}
