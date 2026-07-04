import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { readDB } from '@/lib/db'

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
  // Daily average over days that actually recorded visits
  const trackedDays = Object.values(visits).filter(v => v > 0).length
  const dailyAvg = trackedDays > 0 ? Math.round((total / trackedDays) * 10) / 10 : 0

  // Who clicked "Sou eu": explicit identify log + participants tied to push subscriptions
  const db = await readDB()
  const nameOf = new Map(db.participants.map(p => [p.id, p.name]))
  const pushIds = new Set(
    (db.pushSubscriptions ?? []).map(s => (s as any).participantId).filter(Boolean) as string[]
  )
  const souEuLog = db.souEu ?? {}
  const allIds = new Set([...Object.keys(souEuLog), ...Array.from(pushIds)])
  const souEu = Array.from(allIds)
    .filter(id => nameOf.has(id))
    .map(id => ({
      participantId: id,
      name: nameOf.get(id)!,
      at: souEuLog[id]?.at ?? null,
      count: souEuLog[id]?.count ?? 0,
      push: pushIds.has(id),
    }))
    .sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))

  return NextResponse.json({ today: visits[today] ?? 0, total, dailyAvg, days, souEu })
}
