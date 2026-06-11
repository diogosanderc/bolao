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

  const result: MatchResult = {
    matchId,
    score1: Number(score1),
    score2: Number(score2),
    ...(advancingTeamId ? { advancingTeamId } : {}),
  }

  await updateDB(db => ({
    ...db,
    results: [
      ...db.results.filter(r => r.matchId !== matchId),
      result,
    ],
  }))

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { adminKey, matchId } = await req.json()
  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  await updateDB(db => ({
    ...db,
    results: db.results.filter(r => r.matchId !== matchId),
  }))
  return NextResponse.json({ ok: true })
}
