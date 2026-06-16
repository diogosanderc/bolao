import { NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { ALL_MATCHES, teamById } from '@/lib/copa2026'
import { resolveTeam } from '@/lib/espn'

// Module-level rate limit: only run once per 60 seconds
let lastRunAt = 0

export async function POST() {
  const now = Date.now()
  if (now - lastRunAt < 60_000) {
    return NextResponse.json({ ok: true, skipped: true, nextAllowedIn: Math.ceil((60_000 - (now - lastRunAt)) / 1000) })
  }
  lastRunAt = now

  let espnData: any
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260612-20260719&limit=200',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bolao-sync/1.0)' }, cache: 'no-store' }
    )
    if (!res.ok) return NextResponse.json({ ok: false, error: `ESPN ${res.status}` })
    espnData = await res.json()
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }

  const db = await readDB()
  const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))

  const events: any[] = espnData.events ?? []
  const updates: { matchId: string; score1: number; score2: number }[] = []

  for (const event of events) {
    const competition = event.competitions?.[0]
    if (!competition) continue
    const status = competition.status ?? event.status
    const completed = status?.type?.completed === true || status?.type?.name === 'STATUS_FINAL'
    if (!completed) continue

    const competitors: any[] = competition.competitors ?? []
    if (competitors.length !== 2) continue

    const c1 = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
    const c2 = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]
    const id1 = resolveTeam(c1.team?.abbreviation ?? '', c1.team?.displayName ?? '')
    const id2 = resolveTeam(c2.team?.abbreviation ?? '', c2.team?.displayName ?? '')
    if (!id1 || !id2) continue

    const espnScore1 = parseInt(c1.score ?? '0', 10)
    const espnScore2 = parseInt(c2.score ?? '0', 10)

    const match = ALL_MATCHES.find(m =>
      (m.team1Id === id1 && m.team2Id === id2) ||
      (m.team1Id === id2 && m.team2Id === id1)
    )
    if (!match) continue

    const flipped = match.team1Id === id2
    const ourScore1 = flipped ? espnScore2 : espnScore1
    const ourScore2 = flipped ? espnScore1 : espnScore2

    const current = resultMap[match.id]
    if (current && current.score1 === ourScore1 && current.score2 === ourScore2) continue

    updates.push({ matchId: match.id, score1: ourScore1, score2: ourScore2 })
  }

  if (updates.length > 0) {
    await updateDB(db => {
      const map = Object.fromEntries(db.results.map(r => [r.matchId, r]))
      for (const u of updates) map[u.matchId] = u
      return { ...db, results: Object.values(map) }
    })
    console.log(`[sync/live] ${updates.length} result(s) updated`)
  }

  return NextResponse.json({ ok: true, updated: updates.length })
}
