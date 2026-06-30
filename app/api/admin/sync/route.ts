import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { ALL_MATCHES, teamById } from '@/lib/copa2026'
import { resolveTeam } from '@/lib/espn'
import { MatchResult } from '@/lib/types'
import { computeBracketFromResults } from '@/lib/bracket'

type SyncDiff = {
  matchId: string
  team1: { id: string; name: string; flag: string }
  team2: { id: string; name: string; flag: string }
  espnScore1: number
  espnScore2: number
  currentScore1?: number
  currentScore2?: number
  isNew: boolean
  isDivergent: boolean
  date?: string
  dateBRT?: string
  venue?: string
}

function toBRT(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch { return isoDate }
}

async function fetchESPN(): Promise<Response> {
  // Fetch a wide date range covering the whole tournament
  const url = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260612-20260719&limit=200'
  return fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; bolao-sync/1.0)',
      'Accept': 'application/json',
    },
    next: { revalidate: 0 },
  })
}

// GET /api/admin/sync — preview diffs
export async function GET(req: NextRequest) {
  const adminKey = req.headers.get('x-admin-key')
  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let espnData: any
  try {
    const res = await fetchESPN()
    if (!res.ok) {
      return NextResponse.json({ error: `ESPN retornou ${res.status}` }, { status: 502 })
    }
    espnData = await res.json()
  } catch (err: any) {
    return NextResponse.json({ error: `Falha ao buscar ESPN: ${err.message}` }, { status: 502 })
  }

  const db = await readDB()
  const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
  const resolvedKnockout = computeBracketFromResults(db.results)

  const events: any[] = espnData.events ?? []
  const diffs: SyncDiff[] = []

  for (const event of events) {
    const competition = event.competitions?.[0]
    if (!competition) continue

    const status = competition.status ?? event.status
    const completed = status?.type?.completed === true
      || status?.type?.name === 'STATUS_FINAL'
      || status?.type?.description?.toLowerCase() === 'final'
    if (!completed) continue

    const competitors: any[] = competition.competitors ?? []
    if (competitors.length !== 2) continue

    // Identify home/away or just use index order
    const c1 = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
    const c2 = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]

    const id1 = resolveTeam(c1.team?.abbreviation ?? '', c1.team?.displayName ?? c1.team?.name ?? '')
    const id2 = resolveTeam(c2.team?.abbreviation ?? '', c2.team?.displayName ?? c2.team?.name ?? '')
    if (!id1 || !id2) continue

    const espnScore1 = parseInt(c1.score ?? '0', 10)
    const espnScore2 = parseInt(c2.score ?? '0', 10)

    // Find matching match in our system — for knockout matches use resolved team IDs
    const match = ALL_MATCHES.find(m => {
      const t1 = m.team1Id !== 'TBD' ? m.team1Id : resolvedKnockout[m.id]?.team1Id
      const t2 = m.team2Id !== 'TBD' ? m.team2Id : resolvedKnockout[m.id]?.team2Id
      if (!t1 || !t2 || t1 === 'TBD' || t2 === 'TBD') return false
      return (t1 === id1 && t2 === id2) || (t1 === id2 && t2 === id1)
    })
    if (!match) continue

    const resolved = resolvedKnockout[match.id]
    const effectiveTeam1 = match.team1Id !== 'TBD' ? match.team1Id : resolved?.team1Id ?? match.team1Id
    const flipped = effectiveTeam1 === id2
    const ourScore1 = flipped ? espnScore2 : espnScore1
    const ourScore2 = flipped ? espnScore1 : espnScore2

    const current = resultMap[match.id]
    const isNew = !current
    const isDivergent = !isNew && (current.score1 !== ourScore1 || current.score2 !== ourScore2)

    if (!isNew && !isDivergent) continue

    const eff1 = resolved?.team1Id ?? match.team1Id
    const eff2 = resolved?.team2Id ?? match.team2Id
    diffs.push({
      matchId: match.id,
      team1: { id: eff1, name: teamById[eff1]?.name ?? eff1, flag: teamById[eff1]?.flag ?? '🏳' },
      team2: { id: eff2, name: teamById[eff2]?.name ?? eff2, flag: teamById[eff2]?.flag ?? '🏳' },
      espnScore1: ourScore1,
      espnScore2: ourScore2,
      currentScore1: current?.score1,
      currentScore2: current?.score2,
      isNew,
      isDivergent,
      date: event.date ?? undefined,
      dateBRT: event.date ? toBRT(event.date) : undefined,
      venue: competition.venue?.fullName ?? competition.venue?.address?.city ?? undefined,
    })
  }

  return NextResponse.json({ diffs, total: events.length })
}

// POST /api/admin/sync — apply selected updates
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { adminKey, updates, diffs } = body as {
    adminKey: string
    updates: MatchResult[]
    diffs?: SyncDiff[]
  }

  if (adminKey !== (process.env.ADMIN_KEY ?? 'admin123')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return NextResponse.json({ error: 'Nenhuma atualização enviada' }, { status: 400 })
  }

  // Build date lookup from diffs payload (so leaderboard sort works correctly)
  const dateMap: Record<string, { date: string; dateBRT: string; venue: string }> = {}
  for (const d of diffs ?? []) {
    if (d.date) dateMap[d.matchId] = { date: d.date, dateBRT: d.dateBRT ?? '', venue: d.venue ?? '' }
  }

  await updateDB(db => {
    const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    for (const u of updates) {
      resultMap[u.matchId] = {
        ...resultMap[u.matchId],
        matchId: u.matchId, score1: u.score1, score2: u.score2,
        ...(u.advancingTeamId ? { advancingTeamId: u.advancingTeamId } : {}),
        ...(u.regulationScore1 !== undefined ? { regulationScore1: u.regulationScore1 } : {}),
        ...(u.regulationScore2 !== undefined ? { regulationScore2: u.regulationScore2 } : {}),
      }
    }
    const existingDates = db.matchDates ?? {}
    return {
      ...db,
      results: Object.values(resultMap),
      matchDates: { ...existingDates, ...dateMap },
    }
  })

  return NextResponse.json({ ok: true, count: updates.length })
}
