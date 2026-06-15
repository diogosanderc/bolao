import { ALL_MATCHES, teamById } from './copa2026'

const ESPN_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260612-20260719&limit=200'

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

export type ESPNEvent = {
  matchId: string
  team1Id: string
  team2Id: string
  date: string      // ISO 8601 UTC
  dateBRT: string   // formatted BRT for display
  venue: string
  completed: boolean
  inProgress: boolean
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

export async function fetchESPNEvents(): Promise<ESPNEvent[]> {
  const res = await fetch(ESPN_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bolao/1.0)' },
    next: { revalidate: 1800 }, // cache 30 min
  })
  if (!res.ok) throw new Error(`ESPN ${res.status}`)
  const data = await res.json()
  const events: any[] = data.events ?? []
  const result: ESPNEvent[] = []

  for (const event of events) {
    const competition = event.competitions?.[0]
    if (!competition) continue

    const status = competition.status ?? event.status
    const completed = status?.type?.completed === true || status?.type?.name === 'STATUS_FINAL'
    const inProgress = !completed && (
      status?.type?.name === 'STATUS_IN_PROGRESS' ||
      status?.type?.name === 'STATUS_HALFTIME'
    )

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

    const venue = competition.venue?.fullName ?? competition.venue?.address?.city ?? ''
    const dateISO = event.date ?? ''

    result.push({
      matchId: match.id,
      team1Id: match.team1Id,
      team2Id: match.team2Id,
      date: dateISO,
      dateBRT: toBRT(dateISO),
      venue,
      completed,
      inProgress,
    })
  }

  return result
}
