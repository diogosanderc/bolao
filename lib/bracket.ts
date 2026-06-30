import { GROUPS, GROUP_MATCHES, R32_BRACKET } from './copa2026'
import { THIRD_PLACE_TABLE } from './thirdPlaceTable'
import { MatchPrediction, MatchResult } from './types'

// R32 match ID → slot key (letter of the group whose 1st-place faces a best-3rd)
const SLOT_GROUP: Record<string, string> = {
  R32_2: 'E', R32_5: 'B', R32_7: 'A', R32_8:  'L',
  R32_9: 'G', R32_10: 'D', R32_14: 'I', R32_15: 'K',
}

// Bracket feed order (must be R16 → QF → SF → F for sequential winner resolution)
const BRACKET_TREE: [string, string, string][] = [
  ['R16_1', 'R32_2',  'R32_14'],
  ['R16_2', 'R32_1',  'R32_3'],
  ['R16_3', 'R32_4',  'R32_6'],
  ['R16_4', 'R32_7',  'R32_8'],
  ['R16_5', 'R32_11', 'R32_12'],
  ['R16_6', 'R32_10', 'R32_9'],
  ['R16_7', 'R32_13', 'R32_16'],
  ['R16_8', 'R32_5',  'R32_15'],
  ['QF_1',  'R16_1',  'R16_2'],
  ['QF_2',  'R16_3',  'R16_4'],
  ['QF_3',  'R16_5',  'R16_6'],
  ['QF_4',  'R16_7',  'R16_8'],
  ['SF_1',  'QF_1',   'QF_3'],
  ['SF_2',  'QF_2',   'QF_4'],
  ['F_1',   'SF_1',   'SF_2'],
]

export function computeGroupStandings(groupId: string, predMap: Record<string, MatchPrediction>) {
  const group = GROUPS.find(g => g.id === groupId)!
  const stats: Record<string, { p: number; j: number; v: number; e: number; d: number; gp: number; gc: number }> =
    Object.fromEntries(group.teamIds.map(id => [id, { p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }]))

  for (const m of GROUP_MATCHES.filter(m => m.groupId === groupId)) {
    const pred = predMap[m.id]
    if (!pred) continue
    const { score1, score2 } = pred
    stats[m.team1Id].j++; stats[m.team2Id].j++
    stats[m.team1Id].gp += score1; stats[m.team1Id].gc += score2
    stats[m.team2Id].gp += score2; stats[m.team2Id].gc += score1
    if (score1 > score2) { stats[m.team1Id].p += 3; stats[m.team1Id].v++; stats[m.team2Id].d++ }
    else if (score2 > score1) { stats[m.team2Id].p += 3; stats[m.team2Id].v++; stats[m.team1Id].d++ }
    else { stats[m.team1Id].p++; stats[m.team1Id].e++; stats[m.team2Id].p++; stats[m.team2Id].e++ }
  }

  return group.teamIds
    .slice()
    .sort((a, b) => {
      if (stats[b].p !== stats[a].p) return stats[b].p - stats[a].p
      const sgA = stats[a].gp - stats[a].gc, sgB = stats[b].gp - stats[b].gc
      if (sgB !== sgA) return sgB - sgA
      return stats[b].gp - stats[a].gp
    })
    .map((id, idx) => ({ teamId: id, pos: idx + 1, sg: stats[id].gp - stats[id].gc, ...stats[id] }))
}

function advance(
  matchId: string,
  teams: { team1Id: string; team2Id: string },
  predMap: Record<string, MatchPrediction>,
  side: 'winner' | 'loser'
): string {
  if (teams.team1Id === 'TBD' || teams.team2Id === 'TBD') return 'TBD'
  const pred = predMap[matchId]
  if (!pred) return 'TBD'
  let w: string, l: string
  if (pred.score1 > pred.score2) { w = teams.team1Id; l = teams.team2Id }
  else if (pred.score2 > pred.score1) { w = teams.team2Id; l = teams.team1Id }
  else {
    const adv = pred.advancingTeamId
    if (!adv) return 'TBD'
    w = adv; l = adv === teams.team1Id ? teams.team2Id : teams.team1Id
  }
  return side === 'winner' ? w : l
}

export function computeFullBracket(
  predMap: Record<string, MatchPrediction>
): Record<string, { team1Id: string; team2Id: string }> {
  const groupRanks: Record<string, string[]> = {}
  const thirdPlace: { group: string; teamId: string; p: number; gp: number; gc: number; sg: number }[] = []

  for (const group of GROUPS) {
    const rows = computeGroupStandings(group.id, predMap)
    groupRanks[group.id] = rows.map(r => r.teamId)
    if (rows.length >= 3) {
      const r = rows[2]
      thirdPlace.push({ group: group.id, teamId: r.teamId, p: r.p, gp: r.gp, gc: r.gc, sg: r.sg })
    }
  }

  const best8 = [...thirdPlace]
    .sort((a, b) => b.p - a.p || b.sg - a.sg || b.gp - a.gp)
    .slice(0, 8)

  const qualKey = best8.map(t => t.group).sort().join('')
  const slotMap = THIRD_PLACE_TABLE[qualKey] ?? {}
  const thirdByGroup = Object.fromEntries(thirdPlace.map(t => [t.group, t.teamId]))

  const getThird = (r32Id: string): string => {
    const srcGroup = slotMap[SLOT_GROUP[r32Id]]
    return srcGroup ? (thirdByGroup[srcGroup] ?? 'TBD') : 'TBD'
  }

  const result: Record<string, { team1Id: string; team2Id: string }> = {}

  for (const entry of R32_BRACKET) {
    const pick = (s: typeof entry.s1) =>
      s.type === 'rank' ? (groupRanks[s.group]?.[s.rank - 1] ?? 'TBD') : getThird(entry.id)
    result[entry.id] = { team1Id: pick(entry.s1), team2Id: pick(entry.s2) }
  }

  for (const [matchId, f1, f2] of BRACKET_TREE) {
    const t1 = result[f1] ?? { team1Id: 'TBD', team2Id: 'TBD' }
    const t2 = result[f2] ?? { team1Id: 'TBD', team2Id: 'TBD' }
    result[matchId] = {
      team1Id: advance(f1, t1, predMap, 'winner'),
      team2Id: advance(f2, t2, predMap, 'winner'),
    }
  }

  result['TP_1'] = {
    team1Id: advance('SF_1', result['SF_1'] ?? { team1Id: 'TBD', team2Id: 'TBD' }, predMap, 'loser'),
    team2Id: advance('SF_2', result['SF_2'] ?? { team1Id: 'TBD', team2Id: 'TBD' }, predMap, 'loser'),
  }

  return result
}

export function computeBracketFromResults(
  results: MatchResult[]
): Record<string, { team1Id: string; team2Id: string }> {
  const rMap = Object.fromEntries(results.map(r => [r.matchId, r]))

  const groupRanks: Record<string, string[]> = {}
  const thirdPlace: { group: string; teamId: string; p: number; gp: number; gc: number; sg: number }[] = []

  for (const group of GROUPS) {
    const s: Record<string, { p: number; gp: number; gc: number }> =
      Object.fromEntries(group.teamIds.map(id => [id, { p: 0, gp: 0, gc: 0 }]))

    for (const m of GROUP_MATCHES.filter(m => m.groupId === group.id)) {
      const res = rMap[m.id]
      if (!res) continue
      s[m.team1Id].gp += res.score1; s[m.team1Id].gc += res.score2
      s[m.team2Id].gp += res.score2; s[m.team2Id].gc += res.score1
      if (res.score1 > res.score2) s[m.team1Id].p += 3
      else if (res.score2 > res.score1) s[m.team2Id].p += 3
      else { s[m.team1Id].p++; s[m.team2Id].p++ }
    }

    const sorted = group.teamIds.slice().sort((a, b) => {
      if (s[b].p !== s[a].p) return s[b].p - s[a].p
      const sgA = s[a].gp - s[a].gc, sgB = s[b].gp - s[b].gc
      if (sgB !== sgA) return sgB - sgA
      return s[b].gp - s[a].gp
    })
    groupRanks[group.id] = sorted
    if (sorted.length >= 3) {
      const t = sorted[2]
      thirdPlace.push({ group: group.id, teamId: t, p: s[t].p, gp: s[t].gp, gc: s[t].gc, sg: s[t].gp - s[t].gc })
    }
  }

  const best8 = [...thirdPlace].sort((a, b) => b.p - a.p || b.sg - a.sg || b.gp - a.gp).slice(0, 8)
  const qualKey = best8.map(t => t.group).sort().join('')
  const slotMap = THIRD_PLACE_TABLE[qualKey] ?? {}
  const thirdByGroup = Object.fromEntries(thirdPlace.map(t => [t.group, t.teamId]))
  const getThird = (r32Id: string) => {
    const src = slotMap[SLOT_GROUP[r32Id]]
    return src ? (thirdByGroup[src] ?? 'TBD') : 'TBD'
  }

  const out: Record<string, { team1Id: string; team2Id: string }> = {}

  for (const entry of R32_BRACKET) {
    const pick = (sl: typeof entry.s1): string =>
      sl.type === 'rank' ? (groupRanks[sl.group]?.[sl.rank - 1] ?? 'TBD') : getThird(entry.id)
    out[entry.id] = { team1Id: pick(entry.s1), team2Id: pick(entry.s2) }
  }

  const winner = (matchId: string, teams: { team1Id: string; team2Id: string }): string => {
    const res = rMap[matchId]
    if (!res) return 'TBD'
    // Trust advancingTeamId even when one bracket slot is still TBD (e.g. best-3rd pending)
    if (res.advancingTeamId) return res.advancingTeamId
    if (teams.team1Id === 'TBD' || teams.team2Id === 'TBD') return 'TBD'
    if (res.score1 > res.score2) return teams.team1Id
    if (res.score2 > res.score1) return teams.team2Id
    return 'TBD'
  }

  const loser = (matchId: string, teams: { team1Id: string; team2Id: string }): string => {
    if (teams.team1Id === 'TBD' || teams.team2Id === 'TBD') return 'TBD'
    const res = rMap[matchId]
    if (!res) return 'TBD'
    const adv = winner(matchId, teams)
    if (adv === 'TBD') return 'TBD'
    return adv === teams.team1Id ? teams.team2Id : teams.team1Id
  }

  for (const [matchId, f1, f2] of BRACKET_TREE) {
    const t1 = out[f1] ?? { team1Id: 'TBD', team2Id: 'TBD' }
    const t2 = out[f2] ?? { team1Id: 'TBD', team2Id: 'TBD' }
    out[matchId] = { team1Id: winner(f1, t1), team2Id: winner(f2, t2) }
  }

  out['TP_1'] = {
    team1Id: loser('SF_1', out['SF_1'] ?? { team1Id: 'TBD', team2Id: 'TBD' }),
    team2Id: loser('SF_2', out['SF_2'] ?? { team1Id: 'TBD', team2Id: 'TBD' }),
  }

  return out
}
