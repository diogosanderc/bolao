import { NextRequest, NextResponse } from 'next/server'
import { updateDB, readDB } from '@/lib/db'
import { GroupPrediction } from '@/lib/types'

// POST /api/group-predictions — upsert group order prediction
export async function POST(req: NextRequest) {
  const { token, groupId, order } = await req.json()

  const db = await readDB()
  const participant = db.participants.find(p => p.token === token)
  if (!participant) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 404 })
  }

  if (!Array.isArray(order) || order.length !== 4) {
    return NextResponse.json({ error: 'Ordem inválida' }, { status: 400 })
  }

  const gp: GroupPrediction = { participantId: participant.id, groupId, order }

  await updateDB(db => ({
    ...db,
    groupPredictions: [
      ...db.groupPredictions.filter(
        p => !(p.participantId === participant.id && p.groupId === groupId)
      ),
      gp,
    ],
  }))

  return NextResponse.json({ ok: true })
}
