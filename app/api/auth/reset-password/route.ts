import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })

  const db = await readDB()
  const participant = db.participants.find(p => p.resetToken === token)

  if (!participant) return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 })
  if (participant.resetExpiry && new Date(participant.resetExpiry) < new Date()) {
    return NextResponse.json({ error: 'Link expirado. Solicite um novo.' }, { status: 400 })
  }

  const passwordHash = await hashPassword(password)
  await updateDB(db => ({
    ...db,
    participants: db.participants.map(p =>
      p.id === participant.id
        ? { ...p, passwordHash, resetToken: undefined, resetExpiry: undefined, sessionToken: undefined }
        : p
    ),
  }))

  return NextResponse.json({ ok: true })
}
