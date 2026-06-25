import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { matchById } from '@/lib/copa2026'

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'admin123'

// POST /api/results/bulk — bulk upsert results (admin only)
// Body: { adminKey, results: [{ matchId, score1, score2 }] }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { adminKey, results } = body

  if (adminKey !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  if (!Array.isArray(results) || results.length === 0) {
    return NextResponse.json({ error: 'results deve ser array não-vazio' }, { status: 400 })
  }

  const invalid: string[] = []
  const valid: { matchId: string; score1: number; score2: number }[] = []

  for (const r of results) {
    const { matchId, score1, score2 } = r ?? {}
    if (!matchId || !matchById[matchId]) { invalid.push(matchId ?? '?'); continue }
    const s1 = Number(score1)
    const s2 = Number(score2)
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) { invalid.push(matchId); continue }
    valid.push({ matchId, score1: s1, score2: s2 })
  }

  await updateDB(db => {
    const map = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    for (const r of valid) map[r.matchId] = r
    return { ...db, results: Object.values(map) }
  })

  return NextResponse.json({ ok: true, saved: valid.length, invalid })
}
