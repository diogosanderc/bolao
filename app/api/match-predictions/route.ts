import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'

// Returns prediction distribution per match: { [matchId]: { [score]: count } }
export async function GET() {
  try {
    const db = await readDB()
    const dist: Record<string, Record<string, number>> = {}
    for (const p of db.matchPredictions) {
      const key = `${p.score1}-${p.score2}`
      if (!dist[p.matchId]) dist[p.matchId] = {}
      dist[p.matchId][key] = (dist[p.matchId][key] ?? 0) + 1
    }
    return NextResponse.json(dist)
  } catch {
    return NextResponse.json({})
  }
}
