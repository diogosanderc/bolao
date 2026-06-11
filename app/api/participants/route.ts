import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { Participant } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function GET() {
  const db = await readDB()
  return NextResponse.json(db.participants)
}

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  }

  const participant: Participant = {
    id: randomUUID(),
    name: name.trim(),
    email: '',
    passwordHash: '',
    token: randomUUID().replace(/-/g, '').slice(0, 12),
    createdAt: new Date().toISOString(),
  }

  await updateDB(db => ({
    ...db,
    participants: [...db.participants, participant],
  }))

  return NextResponse.json(participant)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  await updateDB(db => ({
    ...db,
    participants: db.participants.filter(p => p.id !== id),
    matchPredictions: db.matchPredictions.filter(p => p.participantId !== id),
    groupPredictions: db.groupPredictions.filter(p => p.participantId !== id),
  }))
  return NextResponse.json({ ok: true })
}
