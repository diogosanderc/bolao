import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const VISITS_PATH = path.join(
  process.env.DATA_DIR || path.join(process.cwd(), 'data'),
  'visits.json'
)

function dateBRT(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function labelBRT(offsetDays = 0): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' })
}

export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key') ?? ''
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let visits: Record<string, number> = {}
  try {
    visits = JSON.parse(await fs.readFile(VISITS_PATH, 'utf-8'))
  } catch {}

  const today = dateBRT()

  const days: { date: string; label: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const iso = dateBRT(i)
    const label = labelBRT(i)
    days.push({ date: iso, label, count: visits[iso] ?? 0 })
  }

  const total = Object.values(visits).reduce((s, v) => s + v, 0)

  return NextResponse.json({ today: visits[today] ?? 0, total, days })
}
