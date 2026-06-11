import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { MatchPrediction, GroupPrediction } from '@/lib/types'

export const dynamic = 'force-dynamic'

// GET /api/predictions?token=xxx
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const db = await readDB()

  const participant = db.participants.find(p => p.token === token)
  if (!participant) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  }

  const matchPredictions = db.matchPredictions.filter(p => p.participantId === participant.id)
  const groupPredictions = db.groupPredictions.filter(p => p.participantId === participant.id)

  return NextResponse.json({ participant, matchPredictions, groupPredictions })
}

// POST /api/predictions — upsert match prediction
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, matchId, score1, score2, advancingTeamId } = body

  const db = await readDB()
  const participant = db.participants.find(p => p.token === token)
  if (!participant) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  }

  const prediction: MatchPrediction = {
    participantId: participant.id,
    matchId,
    score1: Number(score1),
    score2: Number(score2),
    ...(advancingTeamId ? { advancingTeamId } : {}),
  }

  await updateDB(db => ({
    ...db,
    matchPredictions: [
      ...db.matchPredictions.filter(
        p => !(p.participantId === participant.id && p.matchId === matchId)
      ),
      prediction,
    ],
  }))

  return NextResponse.json({ ok: true })
}
