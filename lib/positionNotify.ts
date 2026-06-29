import { updateDB } from './db'
import { computeLeaderboard } from './scoring'
import { sendPushToParticipant } from './push'
import { positionMessage } from './positionMessage'

// In-memory mutex — if a call is already in flight, skip rather than stack up.
let inFlight: Promise<number> | null = null

export function notifyPositionChanges(): Promise<number> {
  if (inFlight) return Promise.resolve(0)
  inFlight = _run().finally(() => { inFlight = null })
  return inFlight
}

async function _run(): Promise<number> {
  type Alert = { participantId: string; prev: number; next: number; total: number }

  let alerts: Alert[] = []

  await updateDB(db => {
    const subs = db.pushSubscriptions ?? []
    const meIds = new Set(subs.map(s => s.participantId).filter(Boolean) as string[])
    if (meIds.size === 0) return db

    const liveStates: Record<string, { status: string; score1: number; score2: number }> = (db as any).liveMatchStates ?? {}
    const played = new Set(db.results.map(r => r.matchId))
    const provisional: { matchId: string; score1: number; score2: number }[] = []
    for (const [matchId, st] of Object.entries(liveStates)) {
      if (played.has(matchId)) continue
      if (['in', 'halftime', 'extratime', 'et_halftime', 'penalties', 'completed'].includes(st.status)) {
        provisional.push({ matchId, score1: st.score1, score2: st.score2 })
      }
    }

    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    const participants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)

    const lb = computeLeaderboard(
      participants, db.matchPredictions, db.groupPredictions,
      [...db.results, ...provisional], db.r32TeamPicks, db.knockoutPhasePicks,
    )
    const rankOf = new Map<string, number>()
    for (const e of lb) rankOf.set(e.participant.id, lb.filter(x => x.totalPoints > e.totalPoints).length + 1)

    const prevRanks   = (db as any).lastRanks ?? {} as Record<string, number>
    const hadBaseline = Object.keys(prevRanks).length > 0

    alerts = []
    for (const id of meIds) {
      const rank = rankOf.get(id)
      if (rank === undefined) continue
      const prev = prevRanks[id]
      if (!hadBaseline || prev === undefined || prev === rank) continue
      alerts.push({ participantId: id, prev, next: rank, total: lb.length })
    }

    // Persist updated ranks atomically — next call sees no change for the same event
    const newRanks: Record<string, number> = {}
    rankOf.forEach((r, id) => { newRanks[id] = r })
    return { ...db, lastRanks: newRanks } as any
  })

  let sent = 0
  for (const { participantId, prev, next, total } of alerts) {
    const msg = positionMessage(prev, next, total)
    if (msg) {
      await sendPushToParticipant(participantId, { ...msg, icon: '/icon-192.png' }).catch(() => {})
      sent++
    }
  }
  return sent
}
