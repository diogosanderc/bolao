import { NextRequest, NextResponse } from 'next/server'
import { fetchESPNEvents } from '@/lib/espn'
import { readDB, updateDB } from '@/lib/db'
import { teamById } from '@/lib/copa2026'

// GET /api/schedule — returns next match + all upcoming from ESPN (cached 30min)
export async function GET() {
  try {
    const [events, db] = await Promise.all([fetchESPNEvents(), readDB()])
    const now = new Date()

    const upcoming = events
      .filter(e => !e.completed)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const nextMatch = upcoming[0] ?? null
    const live = events.filter(e => e.inProgress)

    return NextResponse.json({
      nextMatch: nextMatch ? {
        ...nextMatch,
        team1: { id: nextMatch.team1Id, name: teamById[nextMatch.team1Id]?.name ?? nextMatch.team1Id, flag: teamById[nextMatch.team1Id]?.flag ?? '🏳' },
        team2: { id: nextMatch.team2Id, name: teamById[nextMatch.team2Id]?.name ?? nextMatch.team2Id, flag: teamById[nextMatch.team2Id]?.flag ?? '🏳' },
      } : null,
      live: live.map(e => ({
        ...e,
        team1: { id: e.team1Id, name: teamById[e.team1Id]?.name ?? e.team1Id },
        team2: { id: e.team2Id, name: teamById[e.team2Id]?.name ?? e.team2Id },
      })),
      upcoming: upcoming.slice(0, 20).map(e => ({
        ...e,
        team1: { id: e.team1Id, name: teamById[e.team1Id]?.name ?? e.team1Id },
        team2: { id: e.team2Id, name: teamById[e.team2Id]?.name ?? e.team2Id },
      })),
      syncedAt: db.matchDates ? Object.keys(db.matchDates).length : 0,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, nextMatch: null, upcoming: [], live: [] }, { status: 200 })
  }
}

// POST /api/schedule — admin: sync all dates from ESPN into DB
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const adminKey = body.adminKey ?? req.headers.get('x-admin-key') ?? ''
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const events = await fetchESPNEvents()
  const matchDates: Record<string, { date: string; dateBRT: string; venue: string }> = {}
  for (const e of events) {
    if (e.date) matchDates[e.matchId] = { date: e.date, dateBRT: e.dateBRT, venue: e.venue }
  }

  await updateDB(db => ({ ...db, matchDates }))

  return NextResponse.json({ ok: true, count: Object.keys(matchDates).length })
}
