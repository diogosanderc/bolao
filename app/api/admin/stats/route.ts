import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key') ?? ''
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = await readDB()
  const visits = db.visits ?? {}

  const today = new Date().toISOString().slice(0, 10)

  // Last 14 days
  const days: { date: string; label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().slice(0, 10)
    const label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
    days.push({ date: iso, label, count: visits[iso] ?? 0 })
  }

  const total = Object.values(visits).reduce((s, v) => s + v, 0)

  return NextResponse.json({
    today: visits[today] ?? 0,
    total,
    days,
  })
}
