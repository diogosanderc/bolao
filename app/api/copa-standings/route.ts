import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { GROUPS, GROUP_MATCHES, KNOCKOUT_MATCHES, teamById } from '@/lib/copa2026'
import { computeGroupTable } from '@/lib/groupTable'
import { computeBracketFromResults } from '@/lib/bracket'
import { Phase } from '@/lib/types'

type MatchInfo = {
  matchId: string
  matchNumber: number
  phase: Phase
  team1Id: string
  team2Id: string
  date: string | null
  venue: string | null
  score1: number | null
  score2: number | null
  advancingTeamId?: string
  status: 'played' | 'live' | 'upcoming'
  clock: string | null
  isPenalties?: boolean
  penaltyScore1?: number
  penaltyScore2?: number
}

function toBRTShort(iso: string): string | null {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return null
  }
}

function buildMatchInfo(
  m: { id: string; matchNumber: number; phase: Phase; date?: string; venue?: string },
  team1Id: string,
  team2Id: string,
  officialMap: Map<string, any>,
  liveStates: Record<string, any>,
  matchDates: Record<string, any>,
  hasLiveRef: { value: boolean },
): MatchInfo {
  const official = officialMap.get(m.id)
  const live = liveStates[m.id]
  const inProgressStatuses = ['in', 'halftime', 'extratime', 'et_halftime', 'penalties']
  const inProgress = !official && live && inProgressStatuses.includes(live.status)

  // Stale: no date info → never treat as live (avoids ghost indicators after game ends)
  const now = Date.now()
  const matchDate = matchDates[m.id]?.date
  const startedAt = live?.startedAt as string | undefined
  const dateToCheck = matchDate ?? startedAt
  const stale = !dateToCheck || (now - new Date(dateToCheck).getTime()) > 3 * 3_600_000
  const isLive = inProgress && !stale
  if (isLive) hasLiveRef.value = true

  let status: MatchInfo['status'] = 'upcoming'
  let score1: number | null = null
  let score2: number | null = null
  let clock: string | null = null
  let advancingTeamId: string | undefined = undefined

  if (official) {
    status = 'played'
    score1 = official.score1
    score2 = official.score2
    advancingTeamId = official.advancingTeamId
  } else if (live && (inProgressStatuses.includes(live.status) || live.status === 'completed')) {
    // Stale in-progress → show as played (game has ended, just not committed to db yet)
    status = (live.status === 'completed' || (inProgress && stale)) ? 'played' : 'live'
    score1 = live.score1
    score2 = live.score2
    clock = live.status === 'halftime' || live.status === 'et_halftime' ? 'Intervalo' : null
  }

  const isPenalties = live?.status === 'penalties'

  return {
    matchId: m.id,
    matchNumber: m.matchNumber,
    phase: m.phase,
    team1Id,
    team2Id,
    date: m.date ?? toBRTShort(matchDates[m.id]?.date ?? ''),
    venue: m.venue ?? null,
    score1,
    score2,
    advancingTeamId,
    status,
    clock,
    isPenalties,
    penaltyScore1: isPenalties ? (live?.penaltyScore1 ?? 0) : undefined,
    penaltyScore2: isPenalties ? (live?.penaltyScore2 ?? 0) : undefined,
  }
}

export async function GET() {
  try {
    const db = await readDB()
    const officialMap = new Map(db.results.map(r => [r.matchId, r]))
    const liveStates: Record<string, any> = (db as any).liveMatchStates ?? {}
    const matchDates: Record<string, any> = db.matchDates ?? {}
    const hasLiveRef = { value: false }

    // Merge official results with live scores for group table computation
    const inProgressStatuses = ['in', 'halftime', 'extratime', 'et_halftime', 'penalties']
    const now = Date.now()
    const merged: { matchId: string; score1: number; score2: number; advancingTeamId?: string }[] = [...db.results]
    for (const [matchId, st] of Object.entries(liveStates)) {
      if (officialMap.has(matchId)) continue
      if (!st) continue
      const isInProgress = inProgressStatuses.includes(st.status)
      const isCompleted = st.status === 'completed'
      const dateToCheck = matchDates[matchId]?.date ?? st.startedAt
      const stale = !dateToCheck || (now - new Date(dateToCheck).getTime()) > 3 * 3_600_000
      if (isCompleted || (isInProgress && !stale)) {
        const advancing = st.advancingTeamId ?? st.winnerTeamId
        merged.push({ matchId, score1: st.score1, score2: st.score2, ...(advancing ? { advancingTeamId: advancing } : {}) })
      }
    }

    // Group stage
    const groups = GROUPS.map(group => {
      const standings = computeGroupTable(group.id, merged)
      const matches = GROUP_MATCHES
        .filter(m => m.groupId === group.id)
        .sort((a, b) => a.matchNumber - b.matchNumber)
        .map(m => buildMatchInfo(m, m.team1Id, m.team2Id, officialMap, liveStates, matchDates, hasLiveRef))
      return { id: group.id, name: group.name, standings, matches }
    })

    // Resolve knockout bracket from official + completed live results
    const bracket = computeBracketFromResults(merged)

    const PHASE_LABELS_PT: Record<string, string> = {
      round_of_32: '16 avos de Final',
      round_of_16: 'Oitavas de Final',
      quarterfinal: 'Quartas de Final',
      semifinal: 'Semifinal',
      third_place: '3º Lugar',
      final: 'Final',
    }

    const knockoutPhases = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'] as const

    const knockout = knockoutPhases
      .map(phase => {
        const phaseMatches = KNOCKOUT_MATCHES
          .filter(m => m.phase === phase)
          .sort((a, b) => a.matchNumber - b.matchNumber)
          .map(m => {
            const resolved = bracket[m.id]
            const team1Id = resolved?.team1Id ?? 'TBD'
            const team2Id = resolved?.team2Id ?? 'TBD'
            return buildMatchInfo(m, team1Id, team2Id, officialMap, liveStates, matchDates, hasLiveRef)
          })
        return { phase, label: PHASE_LABELS_PT[phase] ?? phase, matches: phaseMatches }
      })

    return NextResponse.json({ groups, knockout, hasLive: hasLiveRef.value })
  } catch (err) {
    console.error('[copa-standings]', err)
    return NextResponse.json({ groups: [], knockout: [], hasLive: false }, { status: 200 })
  }
}
