import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { hashPassword, generateToken } from '@/lib/auth'
import { Participant } from '@/lib/types'
import { randomUUID } from 'crypto'

export async function POST(req: NextRequest) {
  const { name, email, password } = await req.json()

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: 'Todos os campos são obrigatórios' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const db = await readDB()
  if (db.participants.find(p => p.email.toLowerCase() === email.toLowerCase())) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const participant: Participant = {
    id: randomUUID(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: await hashPassword(password),
    token: generateToken().slice(0, 16),
    createdAt: new Date().toISOString(),
  }

  await updateDB(db => ({ ...db, participants: [...db.participants, participant] }))

  return NextResponse.json({ ok: true })
}
