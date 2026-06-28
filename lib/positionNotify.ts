import { readDB, updateDB } from './db'
import { computeLeaderboard } from './scoring'
import { sendPushToParticipant } from './push'
import { positionMessage } from './positionMessage'

/**
 * After a live sync, push a position-change alert to each device that follows a
 * participant ("sou eu"), comparing the current live standing to the last
 * notified rank stored in the DB.
 */
export async function notifyPositionChanges(): Promise<number> {
  const db = await readDB()
  const subs = db.pushSubscriptions ?? []
  const meIds = new Set(subs.map(s => s.participantId).filter(Boolean) as string[])
  if (meIds.size === 0) return 0

  // Live standings: real results + provisional live scores (same as the board)
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

  const prevRanks = db.lastRanks ?? {}
  const hadBaseline = Object.keys(prevRanks).length > 0

  let sent = 0
  for (const id of meIds) {
    const rank = rankOf.get(id)
    if (rank === undefined) continue
    const prev = prevRanks[id]
    if (!hadBaseline || prev === undefined || prev === rank) continue
    const msg = positionMessage(prev, rank, lb.length)
    if (msg) { await sendPushToParticipant(id, { ...msg, icon: '/icon-192.png' }).catch(() => {}); sent++ }
  }

  // Persist the new baseline for every participant
  const newRanks: Record<string, number> = {}
  rankOf.forEach((r, id) => { newRanks[id] = r })
  await updateDB(d => ({ ...d, lastRanks: newRanks } as any))

  return sent
}
