import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { Participant } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const { name } = await req.json()
  if (!name?.trim()) {
    return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })
  }

  const nameCleaned = name.trim().toUpperCase()
  const db = await readDB()

  const existing = db.participants.find(
    p => p.name.toUpperCase() === nameCleaned
  )
  if (existing) {
    return NextResponse.json({ token: existing.token, created: false })
  }

  const participant: Participant = {
    id: randomUUID(),
    name: nameCleaned,
    email: '',
    passwordHash: '',
    token: randomUUID().replace(/-/g, '').slice(0, 16),
    createdAt: new Date().toISOString(),
  }

  await updateDB(db => ({ ...db, participants: [...db.participants, participant] }))

  return NextResponse.json({ token: participant.token, created: true })
}
