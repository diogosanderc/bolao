import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { computeBracketFromResults } from '@/lib/bracket'
import { teamById, ALL_MATCHES } from '@/lib/copa2026'

// Phase bonus values (team appearing in that phase)
const PTS = { r16: 4, qf: 6, sf: 8, finalists: 10, champion: 12 } as const

// GET /api/champion-scenario[?teamId=BRA]
// Returns alive teams and, when teamId is given, the projected score range of
// every participant under the scenario "teamId wins the World Cup".
export async function GET(req: NextRequest) {
  try {
    const teamId = req.nextUrl.searchParams.get('teamId')
    const db = await readDB()

    const bracket = computeBracketFromResults(db.results)

    // Teams already confirmed in each knockout phase
    const reached = { r16: new Set<string>(), qf: new Set<string>(), sf: new Set<string>(), finalists: new Set<string>() }
    const add = (set: Set<string>, ids: string[]) => ids.forEach(id => { if (id && id !== 'TBD') set.add(id) })
    for (let i = 1; i <= 8; i++) add(reached.r16, [bracket[`R16_${i}`]?.team1Id, bracket[`R16_${i}`]?.team2Id].filter(Boolean) as string[])
    for (let i = 1; i <= 4; i++) add(reached.qf, [bracket[`QF_${i}`]?.team1Id, bracket[`QF_${i}`]?.team2Id].filter(Boolean) as string[])
    for (let i = 1; i <= 2; i++) add(reached.sf, [bracket[`SF_${i}`]?.team1Id, bracket[`SF_${i}`]?.team2Id].filter(Boolean) as string[])
    add(reached.finalists, [bracket['F_1']?.team1Id, bracket['F_1']?.team2Id].filter(Boolean) as string[])

    // Alive teams: everyone still in the bracket (not knocked out)
    const groupResultCount = db.results.filter(r => r.matchId.startsWith('G')).length
    const aliveSet = new Set<string>()
    if (groupResultCount >= 72) {
      for (let i = 1; i <= 16; i++) {
        const slot = bracket[`R32_${i}`]
        if (slot?.team1Id && slot.team1Id !== 'TBD') aliveSet.add(slot.team1Id)
        if (slot?.team2Id && slot.team2Id !== 'TBD') aliveSet.add(slot.team2Id)
      }
    } else {
      for (const tid of Object.keys(teamById)) aliveSet.add(tid)
    }
    for (const result of db.results) {
      if (result.matchId.startsWith('G') || result.matchId === 'TP_1') continue
      const slot = bracket[result.matchId]
      const t1 = slot?.team1Id, t2 = slot?.team2Id
      if (!t1 || !t2 || t1 === 'TBD' || t2 === 'TBD') continue
      const winner = result.advancingTeamId
        ?? (result.score1 > result.score2 ? t1 : result.score2 > result.score1 ? t2 : undefined)
      if (winner) aliveSet.delete(winner === t1 ? t2 : t1)
    }
    const aliveTeams = [...aliveSet].sort()

    if (!teamId || !aliveSet.has(teamId)) {
      return NextResponse.json({ aliveTeams, rows: [] })
    }

    // Current standings
    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    const participants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)
    const lb = computeLeaderboard(participants, db.matchPredictions, db.groupPredictions, db.results, db.r32TeamPicks, db.knockoutPhasePicks)

    // Remaining matches (all of them — max assumes 8 pts each)
    const playedIds = new Set(db.results.map(r => r.matchId))
    const remaining = ALL_MATCHES.filter(m => !playedIds.has(m.id)).length

    const rows = lb.map(e => {
      const kp = db.knockoutPhasePicks?.find(k => k.participantId === e.participant.id)
      const lists: Record<keyof typeof PTS, string[]> = {
        r16: kp?.r16 ?? [], qf: kp?.qf ?? [], sf: kp?.sf ?? [],
        finalists: kp?.finalists ?? [], champion: kp?.champion ? [kp.champion] : [],
      }

      // Guaranteed: bonuses from the champion's mandatory path (phases not yet credited)
      let guaranteed = 0
      if (lists.r16.includes(teamId) && !reached.r16.has(teamId)) guaranteed += PTS.r16
      if (lists.qf.includes(teamId) && !reached.qf.has(teamId)) guaranteed += PTS.qf
      if (lists.sf.includes(teamId) && !reached.sf.has(teamId)) guaranteed += PTS.sf
      if (lists.finalists.includes(teamId) && !reached.finalists.has(teamId)) guaranteed += PTS.finalists
      if (lists.champion.includes(teamId)) guaranteed += PTS.champion

      // Possible extra bonuses from other picked teams still alive (theoretical max)
      let possible = 0
      for (const phase of ['r16', 'qf', 'sf'] as const) {
        for (const t of lists[phase]) {
          if (t === teamId) continue
          if (aliveSet.has(t) && !reached[phase].has(t)) possible += PTS[phase]
        }
      }
      // Only one non-champion finalist slot remains in this scenario
      const otherFinalists = lists.finalists.filter(t => t !== teamId && aliveSet.has(t) && !reached.finalists.has(t))
      if (otherFinalists.length > 0) possible += PTS.finalists

      return {
        id: e.participant.id,
        name: e.participant.name,
        current: e.totalPoints,
        min: e.totalPoints + guaranteed,
        max: e.totalPoints + guaranteed + possible + remaining * 8,
      }
    }).sort((a, b) => b.min - a.min || b.max - a.max)

    return NextResponse.json({ aliveTeams, remaining, rows })
  } catch (err) {
    console.error('[champion-scenario]', err)
    return NextResponse.json({ aliveTeams: [], rows: [] }, { status: 200 })
  }
}
