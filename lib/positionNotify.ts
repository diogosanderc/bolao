import { updateDB } from './db'
import { computeLeaderboard } from './scoring'
import { sendPushToParticipant } from './push'
import { positionMessage } from './positionMessage'

/**
 * After a live sync, push a position-change alert to each device that follows a
 * participant ("sou eu"), comparing the current live standing to the last
 * notified rank stored in the DB.
 *
 * lastRanks is updated atomically inside updateDB (which holds the file lock)
 * BEFORE any push is sent. This prevents duplicate notifications when the
 * poller fires again before the previous push network call completes.
 */
export async function notifyPositionChanges(): Promise<number> {
  type Alert = { participantId: string; prev: number; next: number; total: number }

  // Compute ranks and atomically claim notifications inside the DB lock.
  // If another concurrent call already updated lastRanks, the alerts list
  // will be empty and nothing is sent.
  let alerts: Alert[] = []

  await updateDB(db => {
    const subs = db.pushSubscriptions ?? []
    const meIds = new Set(subs.map(s => s.participantId).filter(Boolean) as string[])

    if (meIds.size === 0) return db

    const liveStates = db.liveMatchStates ?? {}
    const played = new Set(db.results.map(r => r.matchId))
    const provisional: { matchId: string; score1: number; score2: number }[] = []
    for (const [matchId, st] of Object.entries(liveStates)) {
      if (played.has(matchId)) continue
      if (st.status === 'in' || st.status === 'halftime' || st.status === 'completed') {
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

    const prevRanks = (db as any).lastRanks ?? {} as Record<string, number>
    const hadBaseline = Object.keys(prevRanks).length > 0

    // Collect who needs a notification — only computed once per lock acquisition
    alerts = []
    for (const id of meIds) {
      const rank = rankOf.get(id)
      if (rank === undefined) continue
      const prev = prevRanks[id]
      if (!hadBaseline || prev === undefined || prev === rank) continue
      alerts.push({ participantId: id, prev, next: rank, total: lb.length })
    }

    // Persist new baseline atomically — subsequent calls will see no change
    const newRanks: Record<string, number> = {}
    rankOf.forEach((r, id) => { newRanks[id] = r })
    return { ...db, lastRanks: newRanks } as any
  })

  // Send pushes AFTER the lock is released (network I/O outside the critical section)
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
