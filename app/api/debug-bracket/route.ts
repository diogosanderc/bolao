import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { GROUPS, GROUP_MATCHES } from '@/lib/copa2026'
import { computeBracketFromResults } from '@/lib/bracket'
import { THIRD_PLACE_TABLE } from '@/lib/thirdPlaceTable'
import { MatchResult } from '@/lib/types'

// Temporary diagnostic endpoint — safe to remove after the simulator bracket issue is resolved.
export async function GET() {
  const db = await readDB()
  const liveStates: Record<string, any> = (db as any).liveMatchStates ?? {}

  const koResults = db.results.filter(r => !r.matchId.startsWith('G'))
  const groupResultCount = db.results.filter(r => r.matchId.startsWith('G')).length

  const liveSummary = Object.fromEntries(
    Object.entries(liveStates).map(([id, st]) => [id, {
      status: st?.status,
      score1: st?.score1,
      score2: st?.score2,
      winnerTeamId: st?.winnerTeamId,
      regulationScore1: st?.regulationScore1,
      regulationScore2: st?.regulationScore2,
    }])
  )

  // Third-place diagnostics: replicate computeBracketFromResults' qualKey computation
  const rMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
  const thirdPlace: { group: string; teamId: string; p: number; gp: number; sg: number }[] = []
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
    if (sorted.length >= 3) {
      const t = sorted[2]
      thirdPlace.push({ group: group.id, teamId: t, p: s[t].p, gp: s[t].gp, sg: s[t].gp - s[t].gc })
    }
  }
  const best8 = [...thirdPlace].sort((a, b) => b.p - a.p || b.sg - a.sg || b.gp - a.gp).slice(0, 8)
  const qualKey = best8.map(t => t.group).sort().join('')
  const qualKeyInTable = Boolean(THIRD_PLACE_TABLE[qualKey])

  // Bracket from confirmed results only (what /palpites uses)
  const bracketOfficial = computeBracketFromResults(db.results)

  // Bracket from merged (what copa-standings/simulate use now)
  const officialIds = new Set(db.results.map(r => r.matchId))
  const merged: MatchResult[] = [...db.results]
  for (const [matchId, st] of Object.entries(liveStates)) {
    if (officialIds.has(matchId) || !st) continue
    if (st.status !== 'completed') continue
    const advancing = st.advancingTeamId ?? st.winnerTeamId
    merged.push({ matchId, score1: st.score1, score2: st.score2, ...(advancing ? { advancingTeamId: advancing } : {}) })
  }
  const bracketMerged = computeBracketFromResults(merged)

  const pick = (b: Record<string, { team1Id: string; team2Id: string }>) =>
    Object.fromEntries(
      [...Array.from({ length: 16 }, (_, i) => `R32_${i + 1}`), ...Array.from({ length: 8 }, (_, i) => `R16_${i + 1}`)]
        .map(id => [id, b[id] ? `${b[id].team1Id} vs ${b[id].team2Id}` : 'MISSING'])
    )

  return NextResponse.json({
    version: 'debug-1',
    groupResultCount,
    koResults,
    liveSummary,
    thirdPlace,
    best8Groups: best8.map(t => t.group),
    qualKey,
    qualKeyInTable,
    bracketOfficial: pick(bracketOfficial),
    bracketMerged: pick(bracketMerged),
  })
}
