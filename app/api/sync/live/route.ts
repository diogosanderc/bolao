import { NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { ALL_MATCHES, teamById } from '@/lib/copa2026'
import { resolveTeam } from '@/lib/espn'
import { sendPushToAll } from '@/lib/push'

// In-memory state persists between requests on Railway's single instance
type MatchState = {
  status: 'pre' | 'in' | 'halftime' | 'completed'
  score1: number
  score2: number
}
const matchStates = new Map<string, MatchState>()

let lastRunAt = 0

export async function POST() {
  const now = Date.now()
  if (now - lastRunAt < 28_000) {
    return NextResponse.json({ ok: true, skipped: true })
  }
  lastRunAt = now

  let espnData: any
  try {
    const res = await fetch(
      // Today endpoint — real-time, no cache
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bolao-sync/1.0)' }, cache: 'no-store' }
    )
    if (!res.ok) return NextResponse.json({ ok: false, error: `ESPN ${res.status}` })
    espnData = await res.json()
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message })
  }

  const db = await readDB()
  const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
  const dbUpdates: { matchId: string; score1: number; score2: number }[] = []
  const pushQueue: { title: string; body: string }[] = []

  for (const event of espnData.events ?? []) {
    const competition = event.competitions?.[0]
    if (!competition) continue

    const status = competition.status ?? event.status
    const typeName: string = status?.type?.name ?? ''
    const completed = status?.type?.completed === true || typeName === 'STATUS_FINAL'
    const halftime = typeName === 'STATUS_HALFTIME'
    const inProgress = !completed && (
      status?.type?.state === 'in' ||
      typeName === 'STATUS_IN_PROGRESS' ||
      typeName === 'STATUS_SECOND_HALF' ||
      typeName === 'STATUS_EXTRA_TIME' ||
      typeName === 'STATUS_PENALTY' ||
      halftime
    )

    const competitors: any[] = competition.competitors ?? []
    if (competitors.length !== 2) continue

    const c1 = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
    const c2 = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]
    const id1 = resolveTeam(c1.team?.abbreviation ?? '', c1.team?.displayName ?? '')
    const id2 = resolveTeam(c2.team?.abbreviation ?? '', c2.team?.displayName ?? '')
    if (!id1 || !id2) continue

    const match = ALL_MATCHES.find(m =>
      (m.team1Id === id1 && m.team2Id === id2) ||
      (m.team1Id === id2 && m.team2Id === id1)
    )
    if (!match) continue

    const flipped = match.team1Id === id2
    const rawS1 = parseInt(c1.score ?? '0', 10)
    const rawS2 = parseInt(c2.score ?? '0', 10)
    const score1 = flipped ? rawS2 : rawS1
    const score2 = flipped ? rawS1 : rawS2
    const t1 = teamById[match.team1Id]?.name ?? match.team1Id
    const t2 = teamById[match.team2Id]?.name ?? match.team2Id
    const scoreStr = `${t1} ${score1}×${score2} ${t2}`
    const clock: string = halftime ? 'Intervalo' : (status?.displayClock ?? '')

    const prev = matchStates.get(match.id)
    const newStatus: MatchState['status'] = completed ? 'completed' : halftime ? 'halftime' : inProgress ? 'in' : 'pre'

    if (!prev) {
      // First time we see this match — just record state, no push (avoid noise on server restart)
      matchStates.set(match.id, { status: newStatus, score1, score2 })
      continue
    }

    // Detect transitions
    if (prev.status === 'pre' && newStatus === 'in') {
      pushQueue.push({ title: '🟢 Jogo começou!', body: `${t1} vs ${t2}` })
    }

    if ((prev.status === 'in' || prev.status === 'pre') && newStatus === 'halftime') {
      pushQueue.push({ title: '⏸ Intervalo', body: `${scoreStr}` })
    }

    if (newStatus === 'in' || newStatus === 'halftime' || newStatus === 'completed') {
      const prevTotal = prev.score1 + prev.score2
      const newTotal = score1 + score2
      const goalCount = newTotal - prevTotal
      if (goalCount > 0) {
        const goalLabel = goalCount === 1 ? 'Gol!' : `${goalCount} gols!`
        const clockLabel = clock ? ` · ${clock}` : ''
        pushQueue.push({ title: `⚽ ${goalLabel}${clockLabel}`, body: scoreStr })
      }
    }

    if (prev.status !== 'completed' && newStatus === 'completed') {
      pushQueue.push({ title: '🏁 Resultado final', body: scoreStr })
      // Save to DB
      const current = resultMap[match.id]
      if (!current || current.score1 !== score1 || current.score2 !== score2) {
        dbUpdates.push({ matchId: match.id, score1, score2 })
      }
    }

    matchStates.set(match.id, { status: newStatus, score1, score2 })
  }

  if (dbUpdates.length > 0) {
    await updateDB(db => {
      const map = Object.fromEntries(db.results.map(r => [r.matchId, r]))
      for (const u of dbUpdates) map[u.matchId] = u
      return { ...db, results: Object.values(map) }
    })
  }

  for (const p of pushQueue) {
    sendPushToAll({ ...p, icon: '/icon-192.png' }).catch(() => {})
  }

  if (pushQueue.length > 0) {
    console.log(`[sync/live] pushed ${pushQueue.length} notification(s):`, pushQueue.map(p => p.title))
  }

  return NextResponse.json({ ok: true, notifications: pushQueue.length, dbUpdates: dbUpdates.length })
}
