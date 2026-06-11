import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { verifyPassword, generateToken, SESSION_DURATION_MS } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
  }

  const db = await readDB()
  const participant = db.participants.find(p => p.email?.toLowerCase() === email.toLowerCase())

  if (!participant || !participant.passwordHash) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
  }

  const valid = await verifyPassword(password, participant.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
  }

  const sessionToken = generateToken()
  const sessionExpiry = new Date(Date.now() + SESSION_DURATION_MS).toISOString()

  await updateDB(db => ({
    ...db,
    participants: db.participants.map(p =>
      p.id === participant.id ? { ...p, sessionToken, sessionExpiry } : p
    ),
  }))

  const res = NextResponse.json({ ok: true, name: participant.name, token: participant.token })
  res.cookies.set('session', sessionToken, {
    httpOnly: true,
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
    sameSite: 'lax',
  })
  return res
}
