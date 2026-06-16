import { ALL_MATCHES } from './copa2026'

// Full tournament schedule — 30 min cache (dates don't change often)
const ESPN_SCHEDULE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260612-20260719&limit=200'
// Today only — 60 sec cache (for live scores)
const ESPN_TODAY_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard'

export const ESPN_TO_TEAM_ID: Record<string, string> = {
  GER: 'GER', FRA: 'FRA', ESP: 'ESP', ENG: 'ENG', POR: 'POR',
  NED: 'NED', BEL: 'BEL', CRO: 'CRO', TUR: 'TUR', AUT: 'AUT',
  SCO: 'SCO', SUI: 'SUI', CZE: 'CZE', BIH: 'BIH', SWE: 'SWE', NOR: 'NOR',
  BRA: 'BRA', ARG: 'ARG', COL: 'COL', URU: 'URU', ECU: 'ECU',
  PAR: 'PAR', USA: 'USA', MEX: 'MEX', CAN: 'CAN', PAN: 'PAN', HAI: 'HAI',
  MAR: 'MAR', SEN: 'SEN', EGY: 'EGY', ALG: 'ALG', RSA: 'RSA',
  GHA: 'GHA', TUN: 'TUN', CPV: 'CPV', COD: 'COD',
  JPN: 'JPN', KOR: 'KOR', AUS: 'AUS', KSA: 'KSA', IRN: 'IRN',
  UZB: 'UZB', JOR: 'JOR', IRQ: 'IRQ', QAT: 'QAT', NZL: 'NZL',
  CUW: 'CUR', CUR: 'CUR', CIV: 'CIV', IVC: 'CIV', SAF: 'RSA',
  // additional ESPN variants seen in the wild
  'bosnia & herzegovina': 'BIH', 'usa': 'USA', 'congo dr': 'COD', 'costa do marfim': 'CIV',
  germany: 'GER', france: 'FRA', spain: 'ESP', england: 'ENG', portugal: 'POR',
  netherlands: 'NED', belgium: 'BEL', croatia: 'CRO', turkey: 'TUR', austria: 'AUT',
  scotland: 'SCO', switzerland: 'SUI', czechia: 'CZE', 'czech republic': 'CZE',
  'bosnia and herzegovina': 'BIH', sweden: 'SWE', norway: 'NOR',
  brazil: 'BRA', argentina: 'ARG', colombia: 'COL', uruguay: 'URU', ecuador: 'ECU',
  paraguay: 'PAR', 'united states': 'USA', mexico: 'MEX', canada: 'CAN',
  panama: 'PAN', haiti: 'HAI',
  morocco: 'MAR', senegal: 'SEN', egypt: 'EGY', algeria: 'ALG', 'south africa': 'RSA',
  ghana: 'GHA', tunisia: 'TUN', 'cabo verde': 'CPV', 'cape verde': 'CPV',
  'dr congo': 'COD', 'democratic republic of congo': 'COD',
  japan: 'JPN', 'south korea': 'KOR', australia: 'AUS', 'saudi arabia': 'KSA',
  iran: 'IRN', uzbekistan: 'UZB', jordan: 'JOR', iraq: 'IRQ', qatar: 'QAT',
  'new zealand': 'NZL', curacao: 'CUR', "curaçao": 'CUR',
  "côte d'ivoire": 'CIV', "ivory coast": 'CIV',
}

export function resolveTeam(abbr: string, name: string): string | null {
  return ESPN_TO_TEAM_ID[abbr]
    ?? ESPN_TO_TEAM_ID[name.toLowerCase()]
    ?? null
}

export type GoalEvent = {
  minute: string
  playerName: string
  teamId: string
  ownGoal: boolean
}

export type ESPNEvent = {
  matchId: string
  team1Id: string
  team2Id: string
  date: string
  dateBRT: string
  venue: string
  completed: boolean
  inProgress: boolean
  score1?: number
  score2?: number
  liveScore1?: number
  liveScore2?: number
  clock?: string
  goals?: GoalEvent[]
}

function toBRT(isoDate: string): string {
  try {
    const d = new Date(isoDate)
    return d.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return isoDate
  }
}

type LiveInfo = { score1: number; score2: number; clock: string; goals: GoalEvent[] }

function parseEvents(rawEvents: any[], liveMap: Map<string, LiveInfo>): ESPNEvent[] {
  const result: ESPNEvent[] = []
  for (const event of rawEvents) {
    const competition = event.competitions?.[0]
    if (!competition) continue

    const status = competition.status ?? event.status
    const completed = status?.type?.completed === true || status?.type?.name === 'STATUS_FINAL'

    const competitors: any[] = competition.competitors ?? []
    if (competitors.length !== 2) continue

    const c1 = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
    const c2 = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]
    const id1 = resolveTeam(c1.team?.abbreviation ?? '', c1.team?.displayName ?? '')
    const id2 = resolveTeam(c2.team?.abbreviation ?? '', c2.team?.displayName ?? '')
    if (!id1 || !id2) continue

    const match = ALL_MATCHES.find(m =>
      (m.team1Id === id1 && m.team2Id === id2) ||
      (m.team1Id === id2 && m.team2Id === id1)
    )
    if (!match) continue

    const live = liveMap.get(match.id)
    const flipped = match.team1Id === id2

    const rawScore1 = parseInt(c1.score ?? '', 10)
    const rawScore2 = parseInt(c2.score ?? '', 10)
    const hasScores = !isNaN(rawScore1) && !isNaN(rawScore2)
    const finalScore1 = hasScores ? (flipped ? rawScore2 : rawScore1) : undefined
    const finalScore2 = hasScores ? (flipped ? rawScore1 : rawScore2) : undefined

    // Parse goal events from competition details
    const goals: GoalEvent[] = []
    for (const detail of competition.details ?? []) {
      const typeText: string = detail.type?.text ?? ''
      const isGoal = typeText === 'Goal' || typeText === 'Own Goal' || typeText === 'Penalty - Scored'
      if (!isGoal) continue
      const minute: string = detail.clock?.displayValue ?? ''
      const playerName: string = detail.athletesInvolved?.[0]?.displayName ?? ''
      const ownGoal = typeText === 'Own Goal'
      // detail.team.id is ESPN's team id — match against c1/c2
      const detailTeamId = detail.team?.id
      const scoringTeamId = detailTeamId === c1.team?.id ? (flipped ? match.team2Id : match.team1Id)
        : detailTeamId === c2.team?.id ? (flipped ? match.team1Id : match.team2Id)
        : ''
      if (playerName) goals.push({ minute, playerName, teamId: scoringTeamId, ownGoal })
    }

    result.push({
      matchId: match.id,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      date: event.date ?? '',
      dateBRT: toBRT(event.date ?? ''),
      venue: competition.venue?.fullName ?? competition.venue?.address?.city ?? '',
      completed,
      inProgress: !!live,
      score1: completed ? finalScore1 : undefined,
      score2: completed ? finalScore2 : undefined,
      liveScore1: live ? (flipped ? live.score2 : live.score1) : undefined,
      liveScore2: live ? (flipped ? live.score1 : live.score2) : undefined,
      clock: live?.clock,
      // For live matches use real-time goals from today endpoint; fall back to schedule details
      goals: (live?.goals?.length ? live.goals : goals.length > 0 ? goals : undefined),
    })
  }
  return result
}

// Fetch today's scoreboard for real-time live scores (60s cache)
async function fetchLiveMap(): Promise<Map<string, LiveInfo>> {
  try {
    const res = await fetch(ESPN_TODAY_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bolao/1.0)' },
      next: { revalidate: 60 },
    })
    if (!res.ok) return new Map()
    const data = await res.json()
    const liveMap = new Map<string, LiveInfo>()
    for (const event of data.events ?? []) {
      const competition = event.competitions?.[0]
      const status = competition?.status ?? event.status
      const isLive = !status?.type?.completed && (
        status?.type?.state === 'in' ||
        status?.type?.name === 'STATUS_IN_PROGRESS' ||
        status?.type?.name === 'STATUS_HALFTIME' ||
        status?.type?.name === 'STATUS_SECOND_HALF' ||
        status?.type?.name === 'STATUS_EXTRA_TIME' ||
        status?.type?.name === 'STATUS_PENALTY'
      )
      if (!isLive) continue
      const competitors: any[] = competition?.competitors ?? []
      if (competitors.length !== 2) continue
      const c1 = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
      const c2 = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]
      const id1 = resolveTeam(c1.team?.abbreviation ?? '', c1.team?.displayName ?? '')
      const id2 = resolveTeam(c2.team?.abbreviation ?? '', c2.team?.displayName ?? '')
      if (!id1 || !id2) continue
      const match = ALL_MATCHES.find(m =>
        (m.team1Id === id1 && m.team2Id === id2) ||
        (m.team1Id === id2 && m.team2Id === id1)
      )
      if (!match) continue
      const flippedLive = match.team1Id === id2
      const rawLiveS1 = parseInt(c1.score ?? '0', 10)
      const rawLiveS2 = parseInt(c2.score ?? '0', 10)

      // Extract goal details from the live (today) endpoint
      const liveGoals: GoalEvent[] = []
      for (const detail of competition?.details ?? []) {
        const typeText: string = detail.type?.text ?? ''
        const isGoal = typeText === 'Goal' || typeText === 'Own Goal' || typeText === 'Penalty - Scored'
        if (!isGoal) continue
        const minute: string = detail.clock?.displayValue ?? ''
        const playerName: string = detail.athletesInvolved?.[0]?.displayName ?? ''
        const ownGoal = typeText === 'Own Goal'
        const detailTeamId = detail.team?.id
        const scoringTeamId = detailTeamId === c1.team?.id ? (flippedLive ? match.team2Id : match.team1Id)
          : detailTeamId === c2.team?.id ? (flippedLive ? match.team1Id : match.team2Id)
          : ''
        if (playerName) liveGoals.push({ minute, playerName, teamId: scoringTeamId, ownGoal })
      }

      liveMap.set(match.id, {
        score1: rawLiveS1,
        score2: rawLiveS2,
        clock: status?.type?.name === 'STATUS_HALFTIME' ? 'Intervalo' : (status?.displayClock ?? ''),
        goals: liveGoals,
      })
    }
    return liveMap
  } catch {
    return new Map()
  }
}

export async function fetchESPNEvents(): Promise<ESPNEvent[]> {
  const [scheduleRes, liveMap] = await Promise.all([
    fetch(ESPN_SCHEDULE_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bolao/1.0)' },
      next: { revalidate: 1800 },
    }),
    fetchLiveMap(),
  ])
  if (!scheduleRes.ok) throw new Error(`ESPN ${scheduleRes.status}`)
  const data = await scheduleRes.json()
  return parseEvents(data.events ?? [], liveMap)
}
