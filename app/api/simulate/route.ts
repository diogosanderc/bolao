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
    const merged: MatchResult[] = [
      ...db.results.filter(r => !overrideMap[r.matchId]),
      ...overrides,
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
