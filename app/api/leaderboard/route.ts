import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'

export async function GET() {
  try {
    const db = await readDB()
    const leaderboard = computeLeaderboard(
      db.participants,
      db.matchPredictions,
      db.groupPredictions,
      db.results
    )
    return NextResponse.json(leaderboard)
  } catch (err) {
    console.error('[leaderboard]', err)
    return NextResponse.json([], { status: 200 })
  }
}
