import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { generateToken, RESET_DURATION_MS } from '@/lib/auth'
import { sendResetEmail } from '@/lib/email'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 })

  const db = await readDB()
  const participant = db.participants.find(p => p.email?.toLowerCase() === email.toLowerCase())

  // Sempre retorna sucesso para não vazar se o email existe
  if (!participant) return NextResponse.json({ ok: true })

  const resetToken = generateToken()
  const resetExpiry = new Date(Date.now() + RESET_DURATION_MS).toISOString()

  await updateDB(db => ({
    ...db,
    participants: db.participants.map(p =>
      p.id === participant.id ? { ...p, resetToken, resetExpiry } : p
    ),
  }))

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `http://localhost:3000`
  const resetLink = `${baseUrl}/resetar-senha?token=${resetToken}`

  await sendResetEmail(participant.email, participant.name, resetLink)

  return NextResponse.json({ ok: true })
}
