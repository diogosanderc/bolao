import { NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { ALL_MATCHES, teamById } from '@/lib/copa2026'
import { resolveTeam } from '@/lib/espn'
import { sendPushToAll } from '@/lib/push'

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
  type Update = { matchId: string; score1: number; score2: number; label: string; wasNew: boolean; scoreDiff: number }
  const updates: Update[] = []

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

    const t1 = teamById[match.team1Id]?.name ?? match.team1Id
    const t2 = teamById[match.team2Id]?.name ?? match.team2Id
    const wasNew = !current
    const prevTotal = current ? current.score1 + current.score2 : 0
    const newTotal = ourScore1 + ourScore2
    updates.push({
      matchId: match.id,
      score1: ourScore1,
      score2: ourScore2,
      label: `${t1} ${ourScore1}×${ourScore2} ${t2}`,
      wasNew,
      scoreDiff: newTotal - prevTotal,
    })
  }

  if (updates.length > 0) {
    await updateDB(db => {
      const map = Object.fromEntries(db.results.map(r => [r.matchId, r]))
      for (const u of updates) map[u.matchId] = { matchId: u.matchId, score1: u.score1, score2: u.score2 }
      return { ...db, results: Object.values(map) }
    })

    // Send push notifications
    for (const u of updates) {
      if (u.wasNew) {
        // Full-time result
        sendPushToAll({
          title: '⚽ Resultado Final',
          body: u.label,
          icon: '/icon-192.png',
        }).catch(() => {})
      } else if (u.scoreDiff > 0) {
        // Score changed during a match — likely a goal correction or delayed update
        sendPushToAll({
          title: '⚽ Placar atualizado',
          body: u.label,
          icon: '/icon-192.png',
        }).catch(() => {})
      }
    }

    console.log(`[sync/live] ${updates.length} result(s) updated`)
  }

  return NextResponse.json({ ok: true, updated: updates.length })
}
