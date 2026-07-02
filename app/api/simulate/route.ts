import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { computeLeaderboard } from '@/lib/scoring'
import { computeBracketFromResults } from '@/lib/bracket'
import { MatchResult } from '@/lib/types'

const IN_PROGRESS = ['in', 'halftime', 'extratime', 'et_halftime', 'penalties']

// Build the same merged results array that /api/copa-standings uses for its bracket.
// This is the source of truth: db.results + liveMatchStates completed/in-progress (non-stale).
function buildRealMerged(db: any): MatchResult[] {
  const liveStates: Record<string, any> = db.liveMatchStates ?? {}
  const matchDates: Record<string, any> = db.matchDates ?? {}
  const officialIds = new Set((db.results as MatchResult[]).map(r => r.matchId))
  const now = Date.now()
  const real: MatchResult[] = [...db.results]
  for (const [matchId, st] of Object.entries(liveStates)) {
    if (officialIds.has(matchId) || !st) continue
    const isCompleted = (st as any).status === 'completed'
    const isInProgress = IN_PROGRESS.includes((st as any).status)
    if (!isCompleted && !isInProgress) continue
    if (isInProgress) {
      const dateToCheck = matchDates[matchId]?.date ?? (st as any).startedAt
      const stale = !dateToCheck || (now - new Date(dateToCheck).getTime()) > 3 * 3_600_000
      if (stale) continue
    }
    const advancing = (st as any).advancingTeamId ?? (st as any).winnerTeamId
    real.push({
      matchId,
      score1: (st as any).score1,
      score2: (st as any).score2,
      ...(advancing ? { advancingTeamId: advancing } : {}),
      // 90-min score — prediction points are computed on this, not the ET-inclusive score
      ...((st as any).regulationScore1 !== undefined ? { regulationScore1: (st as any).regulationScore1 } : {}),
      ...((st as any).regulationScore2 !== undefined ? { regulationScore2: (st as any).regulationScore2 } : {}),
    })
  }
  return real
}

export async function POST(req: NextRequest) {
  try {
    const { overrides } = (await req.json()) as { overrides: MatchResult[] }
    const db = await readDB()

    // Real merged = same as copa-standings; gives correct bracket for played matches
    const realMerged = buildRealMerged(db)
    const realBracket = computeBracketFromResults(realMerged)

    const overrideMap = Object.fromEntries(overrides.map(r => [r.matchId, r]))
    const realMap = Object.fromEntries(realMerged.map(r => [r.matchId, r]))

    // Simulated merged = real base + user overrides. When the override score equals the
    // real final score, keep the real result's extra fields (regulationScore1/2 for
    // 90-min scoring, advancingTeamId) — the user hasn't changed anything for that match.
    const simMerged: MatchResult[] = [
      ...realMerged.filter(r => !overrideMap[r.matchId]),
      ...overrides.map(o => {
        const real = realMap[o.matchId] as MatchResult | undefined
        if (real && real.score1 === o.score1 && real.score2 === o.score2) {
          return { ...real, ...o }
        }
        return o
      }),
    ]
    const simBracket = computeBracketFromResults(simMerged)

    // Final bracket: prefer simulated non-TBD teams, fall back to real bracket.
    // This mirrors /tabela logic for already-played matches.
    const allMatchIds = new Set([...Object.keys(realBracket), ...Object.keys(simBracket)])
    const bracket: Record<string, { team1Id: string; team2Id: string }> = {}
    for (const id of allMatchIds) {
      const real = realBracket[id] ?? { team1Id: 'TBD', team2Id: 'TBD' }
      const sim = simBracket[id] ?? { team1Id: 'TBD', team2Id: 'TBD' }
      bracket[id] = {
        team1Id: sim.team1Id !== 'TBD' ? sim.team1Id : real.team1Id,
        team2Id: sim.team2Id !== 'TBD' ? sim.team2Id : real.team2Id,
      }
    }

    // Same participant filter and bonus picks as the main leaderboard route
    const predCount = new Map<string, number>()
    for (const p of db.matchPredictions) {
      predCount.set(p.participantId, (predCount.get(p.participantId) ?? 0) + 1)
    }
    const validParticipants = db.participants.filter(p => (predCount.get(p.id) ?? 0) > 0)

    const leaderboard = computeLeaderboard(
      validParticipants,
      db.matchPredictions,
      db.groupPredictions,
      simMerged,
      db.r32TeamPicks,
      db.knockoutPhasePicks
    )

    return NextResponse.json({ leaderboard, bracket })
  } catch (err) {
    console.error('[simulate]', err)
    return NextResponse.json({ leaderboard: [], bracket: {} }, { status: 500 })
  }
}
