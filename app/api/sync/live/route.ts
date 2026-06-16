import { NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { ALL_MATCHES, teamById } from '@/lib/copa2026'
import { resolveTeam } from '@/lib/espn'
import { sendPushToAll } from '@/lib/push'

type MatchState = { status: 'pre' | 'in' | 'halftime' | 'completed'; score1: number; score2: number }

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
  // Load persisted states — source of truth across server restarts
  const persistedStates: Record<string, MatchState> = db.liveMatchStates ?? {}

  const newPersistedStates: Record<string, MatchState> = { ...persistedStates }
  const dbResultUpdates: { matchId: string; score1: number; score2: number }[] = []
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

    const newStatus: MatchState['status'] = completed ? 'completed' : halftime ? 'halftime' : inProgress ? 'in' : 'pre'
    const prev = persistedStates[match.id]

    if (!prev) {
      // Always initialize as pre/0-0 so ALL transitions are detected on the next poll
      // (even if we first see the match already in progress or with goals scored)
      newPersistedStates[match.id] = { status: 'pre', score1: 0, score2: 0 }
      continue
    }

    // Detect transitions and queue pushes
    if (prev.status === 'pre' && newStatus === 'in') {
      pushQueue.push({ title: '🟢 Jogo começou!', body: `${t1} vs ${t2}` })
    }

    if (prev.status !== 'halftime' && newStatus === 'halftime') {
      pushQueue.push({ title: '⏸ Intervalo', body: scoreStr })
    }

    if (newStatus !== 'pre') {
      const prevTotal = prev.score1 + prev.score2
      const newTotal = score1 + score2
      const goalCount = newTotal - prevTotal
      if (goalCount > 0) {
        const clockLabel = clock && clock !== 'Intervalo' ? ` · ${clock}` : ''
        pushQueue.push({ title: `⚽ Gol!${clockLabel}`, body: scoreStr })
      }
    }

    if (prev.status !== 'completed' && newStatus === 'completed') {
      pushQueue.push({ title: '🏁 Resultado final', body: scoreStr })
      const current = resultMap[match.id]
      if (!current || current.score1 !== score1 || current.score2 !== score2) {
        dbResultUpdates.push({ matchId: match.id, score1, score2 })
      }
    }

    newPersistedStates[match.id] = { status: newStatus, score1, score2 }
  }

  // Persist updated states + any new results in one DB write
  const hasStateChanges = JSON.stringify(newPersistedStates) !== JSON.stringify(persistedStates)
  if (dbResultUpdates.length > 0 || hasStateChanges) {
    await updateDB(db => {
      const map = Object.fromEntries(db.results.map(r => [r.matchId, r]))
      for (const u of dbResultUpdates) map[u.matchId] = u
      return { ...db, results: Object.values(map), liveMatchStates: newPersistedStates }
    })
  }

  for (const p of pushQueue) {
    sendPushToAll({ ...p, icon: '/icon-192.png' }).catch(() => {})
  }

  if (pushQueue.length > 0) {
    console.log(`[sync/live] ${pushQueue.length} notification(s):`, pushQueue.map(p => p.title))
  }

  return NextResponse.json({ ok: true, notifications: pushQueue.length, dbUpdates: dbResultUpdates.length })
}
