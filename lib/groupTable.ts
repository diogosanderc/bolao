import { GROUPS, GROUP_MATCHES } from './copa2026'

export type GroupRow = {
  teamId: string
  pos: number
  p: number   // pontos
  j: number   // jogos
  v: number   // vitórias
  e: number   // empates
  d: number   // derrotas
  gp: number  // gols pró
  gc: number  // gols contra
  sg: number  // saldo de gols
}

type SimpleResult = { matchId: string; score1: number; score2: number }

// Compute a single group's standings table from a flat list of results
// (official results, optionally merged with live/provisional scores).
export function computeGroupTable(groupId: string, results: SimpleResult[]): GroupRow[] {
  const group = GROUPS.find(g => g.id === groupId)
  if (!group) return []

  const rMap = new Map(results.map(r => [r.matchId, r]))
  const stats: Record<string, Omit<GroupRow, 'teamId' | 'pos' | 'sg'>> = Object.fromEntries(
    group.teamIds.map(id => [id, { p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }])
  )

  for (const m of GROUP_MATCHES.filter(m => m.groupId === groupId)) {
    const res = rMap.get(m.id)
    if (!res) continue
    const { score1, score2 } = res
    const s1 = stats[m.team1Id]
    const s2 = stats[m.team2Id]
    if (!s1 || !s2) continue
    s1.j++; s2.j++
    s1.gp += score1; s1.gc += score2
    s2.gp += score2; s2.gc += score1
    if (score1 > score2) { s1.p += 3; s1.v++; s2.d++ }
    else if (score2 > score1) { s2.p += 3; s2.v++; s1.d++ }
    else { s1.p++; s1.e++; s2.p++; s2.e++ }
  }

  return group.teamIds
    .slice()
    .sort((a, b) => {
      if (stats[b].p !== stats[a].p) return stats[b].p - stats[a].p
      const sgA = stats[a].gp - stats[a].gc
      const sgB = stats[b].gp - stats[b].gc
      if (sgB !== sgA) return sgB - sgA
      if (stats[b].gp !== stats[a].gp) return stats[b].gp - stats[a].gp
      return a.localeCompare(b)
    })
    .map((id, idx) => ({ teamId: id, pos: idx + 1, sg: stats[id].gp - stats[id].gc, ...stats[id] }))
}
