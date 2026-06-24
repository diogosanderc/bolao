import { NextRequest, NextResponse } from 'next/server'
import { fetchESPNEvents } from '@/lib/espn'
import { readDB, updateDB } from '@/lib/db'
import { teamById } from '@/lib/copa2026'

export const dynamic = 'force-dynamic' // never cache this route — live scores need fresh data

// Auto-save completed results found in ESPN that are missing from DB
async function autoSaveNewResults(events: Awaited<ReturnType<typeof fetchESPNEvents>>, db: Awaited<ReturnType<typeof readDB>>) {
  const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
  const newResults: { matchId: string; score1: number; score2: number }[] = []
  const newDates: Record<string, { date: string; dateBRT: string; venue: string }> = {}

  for (const e of events) {
    if (!e.completed) continue
    if (resultMap[e.matchId]) continue // already saved
    if (e.score1 === undefined || e.score2 === undefined) continue // no valid scores yet
    newResults.push({ matchId: e.matchId, score1: e.score1, score2: e.score2 })
    if (e.date) newDates[e.matchId] = { date: e.date, dateBRT: e.dateBRT, venue: e.venue }
  }

  // Also keep matchDates up to date for all events
  for (const e of events) {
    if (e.date && !newDates[e.matchId]) newDates[e.matchId] = { date: e.date, dateBRT: e.dateBRT, venue: e.venue }
  }

  if (newResults.length > 0 || Object.keys(newDates).length > 0) {
    await updateDB(db => {
      const map = Object.fromEntries(db.results.map(r => [r.matchId, r]))
      for (const r of newResults) map[r.matchId] = r
      return {
        ...db,
        results: Object.values(map),
        matchDates: { ...(db.matchDates ?? {}), ...newDates },
      }
    })
  }

  return newResults.length
}

// GET /api/schedule — returns next match + live + upcoming from ESPN
export async function GET() {
  try {
    const [events, db] = await Promise.all([fetchESPNEvents(), readDB()])

    // Silently auto-save any newly completed results found in ESPN
    autoSaveNewResults(events, db).catch(() => {})

    // Exclude matches already in DB results from upcoming (ESPN cache may lag)
    const savedMatchIds = new Set(db.results.map(r => r.matchId))

    const upcoming = events
      .filter(e => !e.completed && !savedMatchIds.has(e.matchId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const nextMatch = upcoming[0] ?? null
    // All matches starting at the same time as the first upcoming match
    const nextMatches = nextMatch
      ? upcoming.filter(e => e.date === nextMatch.date).map(e => ({
          ...e,
          team1: { id: e.team1Id, name: teamById[e.team1Id]?.name ?? e.team1Id, flag: teamById[e.team1Id]?.flag ?? '🏳' },
          team2: { id: e.team2Id, name: teamById[e.team2Id]?.name ?? e.team2Id, flag: teamById[e.team2Id]?.flag ?? '🏳' },
        }))
      : []
    const live = events.filter(e => e.inProgress || e.suspended)

    return NextResponse.json({
      nextMatch: nextMatch ? {
        ...nextMatch,
        team1: { id: nextMatch.team1Id, name: teamById[nextMatch.team1Id]?.name ?? nextMatch.team1Id, flag: teamById[nextMatch.team1Id]?.flag ?? '🏳' },
        team2: { id: nextMatch.team2Id, name: teamById[nextMatch.team2Id]?.name ?? nextMatch.team2Id, flag: teamById[nextMatch.team2Id]?.flag ?? '🏳' },
      } : null,
      nextMatches,
      live: live.map(e => ({
        ...e,
        team1: { id: e.team1Id, name: teamById[e.team1Id]?.name ?? e.team1Id },
        team2: { id: e.team2Id, name: teamById[e.team2Id]?.name ?? e.team2Id },
        liveScore1: e.liveScore1,
        liveScore2: e.liveScore2,
        clock: e.clock,
        suspended: e.suspended,
        goals: e.goals,
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
