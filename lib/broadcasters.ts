// Brazilian World Cup 2026 broadcasters.
// Source/credit: 26worldcup/26worldcup.github.io broadcasters.json (MIT), asOf 2026-06-10.
//
// The open dataset is per-market (country), not per-match. CazéTV streams all 104
// games free; Globo and SBT carry Brazil's games + the knockout stage on free TV.
// `OVERRIDES` lets us pin exact channels for a specific match when known.

export type Broadcaster = {
  id: string
  name: string
  /** text color */
  fg: string
  /** badge background */
  bg: string
  free: boolean
  url?: string
}

export const CAZE: Broadcaster   = { id: 'caze',  name: 'CazéTV', fg: '#ffffff', bg: '#ff2d2d', free: true, url: 'https://www.youtube.com/@CazeTV' }
export const GLOBO: Broadcaster  = { id: 'globo', name: 'Globo',  fg: '#ffffff', bg: '#0a3d91', free: true }
export const SBT: Broadcaster    = { id: 'sbt',   name: 'SBT',    fg: '#111827', bg: '#ffd400', free: true }

// Exact channel overrides per internal matchId (fill in as the grade is confirmed)
const OVERRIDES: Record<string, Broadcaster[]> = {}

/**
 * Channels showing a given match in Brazil.
 * Default: CazéTV always; Globo + SBT for Brazil matches and the knockout stage.
 */
export function broadcastersForMatch(team1Id: string, team2Id: string, phase?: string): Broadcaster[] {
  const isBrazil = team1Id === 'BRA' || team2Id === 'BRA'
  const isKnockout = !!phase && phase !== 'group'
  if (isBrazil || isKnockout) return [GLOBO, SBT, CAZE]
  return [CAZE]
}

export function broadcastersForMatchId(matchId: string, team1Id: string, team2Id: string, phase?: string): Broadcaster[] {
  return OVERRIDES[matchId] ?? broadcastersForMatch(team1Id, team2Id, phase)
}
