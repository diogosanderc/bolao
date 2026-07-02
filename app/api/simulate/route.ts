import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { computeBracketFromResults } from '@/lib/bracket'
import { MatchResult } from '@/lib/types'

export async function POST(req: NextRequest) {
  try {
    const { overrides } = (await req.json()) as { overrides: MatchResult[] }
    const db = await readDB()

    const overrideMap = Object.fromEntries(overrides.map(r => [r.matchId, r]))

    // Include liveMatchStates completed results so bracket resolves TBD slots
    // for matches finished but not yet confirmed by admin
    const liveStates: Record<string, any> = (db as any).liveMatchStates ?? {}
    const matchDates: Record<string, any> = db.matchDates ?? {}
    const officialIds = new Set(db.results.map(r => r.matchId))
    const now = Date.now()
    const liveCompleted: MatchResult[] = []
    for (const [matchId, st] of Object.entries(liveStates)) {
      if (officialIds.has(matchId) || !st) continue
      const isCompleted = st.status === 'completed'
      const inProgressStatuses = ['in', 'halftime', 'extratime', 'et_halftime', 'penalties']
      const isInProgress = inProgressStatuses.includes(st.status)
      if (!isCompleted && !isInProgress) continue
      if (isInProgress) {
        const dateToCheck = matchDates[matchId]?.date ?? st.startedAt
        const stale = !dateToCheck || (now - new Date(dateToCheck).getTime()) > 3 * 3_600_000
        if (stale) continue
      }
      const advancing = st.advancingTeamId ?? st.winnerTeamId
      liveCompleted.push({ matchId, score1: st.score1, score2: st.score2, ...(advancing ? { advancingTeamId: advancing } : {}) })
    }

    const officialMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    const baseResults = [...db.results, ...liveCompleted.filter(r => !officialIds.has(r.matchId))]
    const merged: MatchResult[] = [
      ...baseResults.filter(r => !overrideMap[r.matchId]),
      // Preserve advancingTeamId from official result when user's score matches it
      ...overrides.map(o => {
        const official = officialMap[o.matchId]
        if (official?.advancingTeamId && official.score1 === o.score1 && official.score2 === o.score2) {
          return { ...o, advancingTeamId: official.advancingTeamId }
        }
        return o
      }),
    ]

    const leaderboard = computeLeaderboard(
      db.participants,
      db.matchPredictions,
      db.groupPredictions,
      merged
    )
    const bracket = computeBracketFromResults(merged)

    return NextResponse.json({ leaderboard, bracket })
  } catch (err) {
    console.error('[simulate]', err)
    return NextResponse.json({ leaderboard: [], bracket: {} }, { status: 500 })
  }
}
