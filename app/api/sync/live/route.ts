import { NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { ALL_MATCHES, teamById } from '@/lib/copa2026'
import { resolveTeam } from '@/lib/espn'
import { sendPushToAll } from '@/lib/push'

type MatchState = {
  status: 'pre' | 'in' | 'halftime' | 'completed'
  score1: number
  score2: number
  sentStarted?: boolean
  sentHalftime?: boolean
  sentFinal?: boolean
  sentGoals?: number
  sentVARKeys?: string[]  // deduplication keys for VAR/cancelled events already notified
}

type ESPNProcessed = {
  matchId: string
  newStatus: MatchState['status']
  score1: number
  score2: number
  t1: string
  t2: string
  clock: string
  varKeys: string[]  // unique keys for VAR/cancelled events found in ESPN details
}

let lastRunAt = 0

export async function POST() {
  const now = Date.now()
  if (now - lastRunAt < 28_000) {
    return NextResponse.json({ ok: true, skipped: true })
  }
  lastRunAt = now

  // 1. Fetch ESPN data outside the lock (network call)
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

  // 2. Pre-process ESPN events into matchId-keyed data (no DB needed)
  const espnProcessed: ESPNProcessed[] = []
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
    const newStatus: MatchState['status'] = completed ? 'completed' : halftime ? 'halftime' : inProgress ? 'in' : 'pre'
    const clock: string = halftime ? 'Intervalo' : (status?.displayClock ?? '')

    // Collect VAR / goal-cancelled event keys from ESPN competition details
    const varKeys: string[] = []
    for (const detail of competition?.details ?? []) {
      const typeText: string = detail.type?.text ?? ''
      const typeLower = typeText.toLowerCase()
      if (
        typeLower.includes('var') ||
        typeLower.includes('review') ||
        typeLower.includes('cancel') ||
        typeLower.includes('disallow') ||
        typeLower.includes('offside - goal')
      ) {
        const minute = detail.clock?.displayValue ?? ''
        varKeys.push(`${typeText}|${minute}`)
      }
    }

    espnProcessed.push({
      matchId: match.id,
      newStatus,
      score1,
      score2,
      t1: teamById[match.team1Id]?.name ?? match.team1Id,
      t2: teamById[match.team2Id]?.name ?? match.team2Id,
      clock,
      varKeys,
    })
  }

  // 3. All state transitions and notification decisions happen atomically inside the DB lock.
  //    This prevents race conditions when multiple server processes call the endpoint simultaneously.
  const pushQueue: { title: string; body: string }[] = []

  await updateDB(db => {
    const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    const persistedStates: Record<string, MatchState> = (db as any).liveMatchStates ?? {}
    const newPersistedStates: Record<string, MatchState> = { ...persistedStates }
    const dbResultUpdates: { matchId: string; score1: number; score2: number }[] = []

    // Reset push queue so retries don't double-send
    pushQueue.length = 0

    for (const { matchId, newStatus, score1, score2, t1, t2, clock, varKeys } of espnProcessed) {
      const prev = persistedStates[matchId]

      if (prev?.status === 'completed') continue

      const matchDate = db.matchDates?.[matchId]?.date
      if (matchDate) {
        const hoursSince = (Date.now() - new Date(matchDate).getTime()) / 3_600_000
        if (hoursSince > 5) continue
      }

      const scoreStr = `${t1} ${score1}×${score2} ${t2}`
      const dbResult = resultMap[matchId]

      // Silently mark as completed if result already in DB
      if (newStatus === 'completed' && dbResult && dbResult.score1 === score1 && dbResult.score2 === score2) {
        newPersistedStates[matchId] = { ...prev, status: 'completed', score1, score2, sentStarted: true, sentFinal: true, sentGoals: score1 + score2 }
        continue
      }

      if (!prev) {
        if (newStatus === 'completed') {
          // Match already finished on first encounter — save result silently, no notification
          newPersistedStates[matchId] = { status: 'completed', score1, score2, sentStarted: true, sentFinal: true, sentGoals: score1 + score2 }
          if (!dbResult || dbResult.score1 !== score1 || dbResult.score2 !== score2) {
            dbResultUpdates.push({ matchId, score1, score2 })
          }
        } else {
          newPersistedStates[matchId] = { status: 'pre', score1: 0, score2: 0 }
        }
        continue
      }

      // Guard: ESPN sometimes briefly sends 'pre' for in-progress matches (stale data)
      if (prev.status !== 'pre' && newStatus === 'pre') continue

      // Score dropped → goal was cancelled (VAR) or ESPN sent stale data.
      // We notify only when we had already alerted users about more goals than ESPN now shows.
      if (score1 < prev.score1 || score2 < prev.score2) {
        const sentGoalsNow = prev.sentGoals ?? (prev.score1 + prev.score2)
        const currentGoals = score1 + score2
        if (newStatus !== 'pre' && !prev.sentFinal && currentGoals < sentGoalsNow) {
          const clockLabel = clock && clock !== 'Intervalo' ? ` · ${clock}` : ''
          pushQueue.push({
            title: '🔍 Gol anulado!',
            body: `${t1} ${score1}×${score2} ${t2}${clockLabel}`,
          })
          newPersistedStates[matchId] = {
            ...prev,
            score1,
            score2,
            sentGoals: currentGoals,
          }
        }
        continue
      }

      // Infer sent flags for backward compat with old DB entries
      const sentStarted = prev.sentStarted ?? (prev.status !== 'pre')
      const sentHalftime = prev.sentHalftime ?? false
      const sentGoals = prev.sentGoals ?? (prev.score1 + prev.score2)
      const sentFinal = prev.sentFinal ?? false

      const newState: MatchState = { status: newStatus, score1, score2, sentStarted, sentHalftime, sentGoals, sentFinal }

      if (newStatus === 'in' && !sentStarted) {
        pushQueue.push({ title: '🟢 Jogo começou!', body: `${t1} x ${t2}` })
        newState.sentStarted = true
      }

      if (newStatus === 'halftime' && !sentHalftime) {
        pushQueue.push({ title: '⏸ Intervalo', body: scoreStr })
        newState.sentHalftime = true
      }

      const currentGoals = score1 + score2
      if (newStatus !== 'pre' && currentGoals > sentGoals) {
        const alreadyFinal = dbResult && dbResult.score1 === score1 && dbResult.score2 === score2
        if (!alreadyFinal) {
          const clockLabel = clock && clock !== 'Intervalo' ? ` · ${clock}` : ''
          pushQueue.push({ title: `⚽ Gol!${clockLabel}`, body: scoreStr })
        }
        newState.sentGoals = currentGoals
      }

      if (newStatus === 'completed') {
        if (!sentFinal) {
          pushQueue.push({ title: '🏁 Resultado final', body: scoreStr })
          newState.sentFinal = true
        }
        // Always ensure result is persisted — covers case where sentFinal was set
        // but the DB write failed or the process was killed before it committed
        if (!dbResult || dbResult.score1 !== score1 || dbResult.score2 !== score2) {
          dbResultUpdates.push({ matchId, score1, score2 })
        }
      }

      // VAR in-progress: notify about new VAR/review events from ESPN details
      if (newStatus === 'in' && varKeys.length > 0) {
        const alreadySent = new Set(prev.sentVARKeys ?? [])
        const newVARKeys: string[] = []
        for (const key of varKeys) {
          if (!alreadySent.has(key)) newVARKeys.push(key)
        }
        if (newVARKeys.length > 0) {
          pushQueue.push({ title: '🔍 VAR em andamento', body: `${t1} x ${t2}` })
          newState.sentVARKeys = [...Array.from(alreadySent), ...newVARKeys]
        }
      }

      newPersistedStates[matchId] = newState
    }

    const map = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    for (const u of dbResultUpdates) map[u.matchId] = u
    return { ...db, results: Object.values(map), liveMatchStates: newPersistedStates } as any
  })

  // 4. Send notifications only after the DB write committed
  for (const p of pushQueue) {
    sendPushToAll({ ...p, icon: '/icon-192.png' }).catch(() => {})
  }

  if (pushQueue.length > 0) {
    console.log(`[sync/live] ${pushQueue.length} notification(s):`, pushQueue.map(p => p.title))
  }

  return NextResponse.json({ ok: true, notifications: pushQueue.length })
}
