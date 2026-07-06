import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { computeBracketFromResults } from '@/lib/bracket'

// Monte Carlo simulation of the remaining knockout games: estimates each
// participant's probability of winning the bolão and of finishing in the
// red zone (bottom 7). Only available once the group stage is complete.

const N_SIMS = 3000
const CACHE_TTL = 5 * 60_000

// Goal distribution per team per match (roughly world-cup-like)
const GOAL_P = [0.26, 0.34, 0.22, 0.11, 0.05, 0.02]
function sampleGoals(): number {
  let r = Math.random()
  for (let g = 0; g < GOAL_P.length; g++) {
    r -= GOAL_P[g]
    if (r <= 0) return g
  }
  return 0
}

const KO_ORDER = [
  ...Array.from({ length: 16 }, (_, i) => `R32_${i + 1}`),
  ...Array.from({ length: 8 }, (_, i) => `R16_${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `QF_${i + 1}`),
  'SF_1', 'SF_2', 'TP_1', 'F_1',
]
const FEEDERS: Record<string, [string, string]> = {
  R16_1: ['R32_2', 'R32_5'], R16_2: ['R32_1', 'R32_3'], R16_3: ['R32_4', 'R32_6'], R16_4: ['R32_7', 'R32_8'],
  R16_5: ['R32_11', 'R32_12'], R16_6: ['R32_9', 'R32_10'], R16_7: ['R32_14', 'R32_16'], R16_8: ['R32_13', 'R32_15'],
  QF_1: ['R16_1', 'R16_2'], QF_2: ['R16_3', 'R16_4'], QF_3: ['R16_5', 'R16_6'], QF_4: ['R16_7', 'R16_8'],
  SF_1: ['QF_1', 'QF_3'], SF_2: ['QF_2', 'QF_4'], F_1: ['SF_1', 'SF_2'],
}
// Winning a match of phase X puts the team in the NEXT phase's pick list
const NEXT_PHASE: Record<string, { key: 'r16' | 'qf' | 'sf' | 'finalists' | 'champion'; pts: number } | undefined> = {
  R32: { key: 'r16', pts: 4 }, R16: { key: 'qf', pts: 6 }, QF: { key: 'sf', pts: 8 }, SF: { key: 'finalists', pts: 10 }, F_: { key: 'champion', pts: 12 },
}

let cache: { key: string; data: any } | null = null

export async function GET() {
  try {
    const db = await readDB()
    const groupCount = db.results.filter(r => r.matchId.startsWith('G')).length
    if (groupCount < 72) {
      return NextResponse.json({ ready: false })
    }

    const cacheKey = `${db.results.length}|${Math.floor(Date.now() / CACHE_TTL)}`
    if (cache?.key === cacheKey) return NextResponse.json(cache.data)

    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    const participants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)
    const P = participants.length

    const lb = computeLeaderboard(participants, db.matchPredictions, db.groupPredictions, db.results, db.r32TeamPicks, db.knockoutPhasePicks)
    const basePts = new Map(lb.map(e => [e.participant.id, e.totalPoints]))

    const bracket = computeBracketFromResults(db.results)
    const resultMap = new Map(db.results.map(r => [r.matchId, r]))

    // Teams already credited per phase (their bonuses are inside basePts)
    const credited: Record<string, Set<string>> = { r16: new Set(), qf: new Set(), sf: new Set(), finalists: new Set(), champion: new Set() }
    const collect = (ids: string[], set: Set<string>) => ids.forEach(t => { if (t && t !== 'TBD') set.add(t) })
    for (let i = 1; i <= 8; i++) collect([bracket[`R16_${i}`]?.team1Id, bracket[`R16_${i}`]?.team2Id] as string[], credited.r16)
    for (let i = 1; i <= 4; i++) collect([bracket[`QF_${i}`]?.team1Id, bracket[`QF_${i}`]?.team2Id] as string[], credited.qf)
    for (let i = 1; i <= 2; i++) collect([bracket[`SF_${i}`]?.team1Id, bracket[`SF_${i}`]?.team2Id] as string[], credited.sf)
    collect([bracket['F_1']?.team1Id, bracket['F_1']?.team2Id] as string[], credited.finalists)

    // Per-phase: teamId → [participantIdx...] who still get points if that team advances there
    const phasePickers: Record<string, Map<string, number[]>> = { r16: new Map(), qf: new Map(), sf: new Map(), finalists: new Map(), champion: new Map() }
    participants.forEach((p, idx) => {
      const kp = db.knockoutPhasePicks?.find(k => k.participantId === p.id)
      if (!kp) return
      const lists: Record<string, string[]> = { r16: kp.r16 ?? [], qf: kp.qf ?? [], sf: kp.sf ?? [], finalists: kp.finalists ?? [], champion: kp.champion ? [kp.champion] : [] }
      for (const [phase, teams] of Object.entries(lists)) {
        for (const t of teams) {
          if (credited[phase].has(t)) continue
          if (!phasePickers[phase].has(t)) phasePickers[phase].set(t, [])
          phasePickers[phase].get(t)!.push(idx)
        }
      }
    })

    // Remaining knockout matches + fast per-participant prediction lookup
    const remaining = KO_ORDER.filter(id => !resultMap.has(id))
    const pIdxById = new Map(participants.map((p, i) => [p.id, i]))
    const remainingSet = new Set(remaining)
    const predByMatch = new Map<string, (readonly [number, number, number])[]>() // matchId → [pIdx, s1, s2]
    for (const id of remaining) predByMatch.set(id, [])
    for (const mp of db.matchPredictions) {
      if (!remainingSet.has(mp.matchId)) continue
      const idx = pIdxById.get(mp.participantId)
      if (idx !== undefined) predByMatch.get(mp.matchId)!.push([idx, mp.score1, mp.score2] as const)
    }

    // Fixed winners/losers of already-played knockout games
    const fixedWinner = new Map<string, string>()
    const fixedLoser = new Map<string, string>()
    for (const id of KO_ORDER) {
      const r = resultMap.get(id)
      const slot = bracket[id]
      if (!r || !slot || slot.team1Id === 'TBD' || slot.team2Id === 'TBD') continue
      const w = r.advancingTeamId ?? (r.score1 > r.score2 ? slot.team1Id : r.score2 > r.score1 ? slot.team2Id : undefined)
      if (!w) continue
      fixedWinner.set(id, w)
      fixedLoser.set(id, w === slot.team1Id ? slot.team2Id : slot.team1Id)
    }

    const champCount = new Array(P).fill(0)
    const redCount = new Array(P).fill(0)
    const top7Count = new Array(P).fill(0)

    for (let sim = 0; sim < N_SIMS; sim++) {
      const pts = participants.map(p => basePts.get(p.id) ?? 0)
      const winner = new Map(fixedWinner)
      const loser = new Map(fixedLoser)

      for (const id of remaining) {
        // Resolve teams for this match
        let t1: string | undefined, t2: string | undefined
        const slot = bracket[id]
        if (slot && slot.team1Id !== 'TBD' && slot.team2Id !== 'TBD') {
          t1 = slot.team1Id; t2 = slot.team2Id
        } else if (id === 'TP_1') {
          t1 = loser.get('SF_1'); t2 = loser.get('SF_2')
        } else if (FEEDERS[id]) {
          t1 = slot?.team1Id !== 'TBD' && slot?.team1Id ? slot.team1Id : winner.get(FEEDERS[id][0])
          t2 = slot?.team2Id !== 'TBD' && slot?.team2Id ? slot.team2Id : winner.get(FEEDERS[id][1])
        }
        if (!t1 || !t2) continue

        const s1 = sampleGoals()
        const s2 = sampleGoals()
        const w = s1 > s2 ? t1 : s2 > s1 ? t2 : (Math.random() < 0.5 ? t1 : t2)
        winner.set(id, w)
        loser.set(id, w === t1 ? t2 : t1)

        // Match prediction points
        const res = s1 > s2 ? 1 : s2 > s1 ? -1 : 0
        for (const [idx, ps1, ps2] of predByMatch.get(id) ?? []) {
          const pres = ps1 > ps2 ? 1 : ps2 > ps1 ? -1 : 0
          let t = 0
          if (pres === res) t += 4
          if (ps1 === s1) t += 1 + (s1 >= 4 ? 2 : 0)
          if (ps2 === s2) t += 1 + (s2 >= 4 ? 2 : 0)
          if (ps1 === s1 && ps2 === s2) t += 2
          pts[idx] += t
        }

        // Advancement bonus for the winner reaching the next phase
        const phaseKey = id.startsWith('R32') ? 'R32' : id.startsWith('R16') ? 'R16' : id.startsWith('QF') ? 'QF' : id.startsWith('SF') ? 'SF' : id === 'F_1' ? 'F_' : ''
        const np = NEXT_PHASE[phaseKey]
        if (np && id !== 'TP_1') {
          const pickers = phasePickers[np.key].get(w)
          if (pickers) for (const idx of pickers) pts[idx] += np.pts
        }
      }

      // Champion of the bolão (ties split evenly) + red zone (bottom 7)
      let maxPts = -1
      for (let i = 0; i < P; i++) if (pts[i] > maxPts) maxPts = pts[i]
      const winners: number[] = []
      for (let i = 0; i < P; i++) if (pts[i] === maxPts) winners.push(i)
      for (const i of winners) champCount[i] += 1 / winners.length

      const order = pts.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
      for (let k = 0; k < Math.min(7, P); k++) redCount[order[k][1]]++
      for (let k = P - 1; k >= Math.max(0, P - 7); k--) top7Count[order[k][1]]++
    }

    const rows = participants.map((p, i) => ({
      id: p.id,
      name: p.name,
      championPct: Math.round((champCount[i] / N_SIMS) * 1000) / 10,
      redZonePct: Math.round((redCount[i] / N_SIMS) * 1000) / 10,
      top7Pct: Math.round((top7Count[i] / N_SIMS) * 1000) / 10,
    }))

    const data = { ready: true, sims: N_SIMS, remaining: remaining.length, rows }
    cache = { key: cacheKey, data }
    return NextResponse.json(data)
  } catch (err) {
    console.error('[odds]', err)
    return NextResponse.json({ ready: false }, { status: 200 })
  }
}
