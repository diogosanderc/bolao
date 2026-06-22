import { NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { GROUPS, GROUP_MATCHES } from '@/lib/copa2026'
import { computeGroupTable } from '@/lib/groupTable'

type MatchInfo = {
  matchId: string
  matchNumber: number
  team1Id: string
  team2Id: string
  date: string | null      // display string (e.g. "12/06 22:00")
  venue: string | null
  score1: number | null
  score2: number | null
  status: 'played' | 'live' | 'upcoming'
  clock: string | null
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

export async function GET() {
  try {
    const db = await readDB()
    const officialMap = new Map(db.results.map(r => [r.matchId, r]))
    const liveStates: Record<string, any> = (db as any).liveMatchStates ?? {}
    const matchDates: Record<string, any> = db.matchDates ?? {}

    // Merge official results with live (provisional) scores so the table reflects
    // in-progress matches. Official always wins over live for the same match.
    const merged: { matchId: string; score1: number; score2: number }[] = [...db.results]
    for (const [matchId, st] of Object.entries(liveStates)) {
      if (officialMap.has(matchId)) continue
      if (st && (st.status === 'in' || st.status === 'halftime' || st.status === 'completed')) {
        merged.push({ matchId, score1: st.score1, score2: st.score2 })
      }
    }

    let hasLive = false

    const groups = GROUPS.map(group => {
      const standings = computeGroupTable(group.id, merged)

      const matches: MatchInfo[] = GROUP_MATCHES
        .filter(m => m.groupId === group.id)
        .sort((a, b) => a.matchNumber - b.matchNumber)
        .map(m => {
          const official = officialMap.get(m.id)
          const live = liveStates[m.id]
          const isLive = !official && live && (live.status === 'in' || live.status === 'halftime')
          if (isLive) hasLive = true

          let status: MatchInfo['status'] = 'upcoming'
          let score1: number | null = null
          let score2: number | null = null
          let clock: string | null = null

          if (official) {
            status = 'played'
            score1 = official.score1
            score2 = official.score2
          } else if (live && (live.status === 'in' || live.status === 'halftime' || live.status === 'completed')) {
            status = live.status === 'completed' ? 'played' : 'live'
            score1 = live.score1
            score2 = live.score2
            clock = live.status === 'halftime' ? 'Intervalo' : null
          }

          return {
            matchId: m.id,
            matchNumber: m.matchNumber,
            team1Id: m.team1Id,
            team2Id: m.team2Id,
            date: m.date ?? toBRTShort(matchDates[m.id]?.date ?? ''),
            venue: m.venue ?? null,
            score1,
            score2,
            status,
            clock,
          }
        })

      return { id: group.id, name: group.name, standings, matches }
    })

    return NextResponse.json({ groups, hasLive })
  } catch (err) {
    console.error('[copa-standings]', err)
    return NextResponse.json({ groups: [], hasLive: false }, { status: 200 })
  }
}
