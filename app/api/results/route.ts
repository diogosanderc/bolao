import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { MatchResult } from '@/lib/types'

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'admin123'

export async function GET() {
  const db = await readDB()
  return NextResponse.json(db.results)
}

// POST /api/results — upsert official match result (admin only)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { adminKey, matchId, score1, score2, advancingTeamId } = body

  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  await updateDB(db => {
    const existing = db.results.find(r => r.matchId === matchId) ?? {} as MatchResult
    const s1 = Number(score1)
    const s2 = Number(score2)
    const result: MatchResult = {
      ...existing,
      matchId,
      score1: s1,
      score2: s2,
      ...(advancingTeamId ? { advancingTeamId } : {}),
    }
    // Lock liveMatchStates to 'completed' so liveSync never overwrites an admin result
    const liveStates = (db as any).liveMatchStates ?? {}
    const newLiveStates = {
      ...liveStates,
      [matchId]: {
        ...liveStates[matchId],
        status: 'completed',
        score1: s1,
        score2: s2,
        sentStarted: true,
        sentFinal: true,
        sentGoals: s1 + s2,
      },
    }
    return {
      ...db,
      results: [...db.results.filter(r => r.matchId !== matchId), result],
      liveMatchStates: newLiveStates,
    }
  })

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { adminKey, matchId } = await req.json()
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await updateDB(db => {
    const liveStates = { ...((db as any).liveMatchStates ?? {}) }
    delete liveStates[matchId]
    return {
      ...db,
      results: db.results.filter(r => r.matchId !== matchId),
      liveMatchStates: liveStates,
    }
  })
  return NextResponse.json({ ok: true })
}
