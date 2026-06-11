import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  const sessionToken = req.cookies.get('session')?.value
  if (!sessionToken) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db = await readDB()
  const participant = db.participants.find(p => p.sessionToken === sessionToken)
  if (!participant) return NextResponse.json({ error: 'Sessão inválida' }, { status: 401 })
  if (participant.sessionExpiry && new Date(participant.sessionExpiry) < new Date()) {
    return NextResponse.json({ error: 'Sessão expirada' }, { status: 401 })
  }

  return NextResponse.json({
    id: participant.id,
    name: participant.name,
    email: participant.email,
    token: participant.token,
  })
}
