// Brazilian World Cup 2026 broadcasters.
// Source/credit: 26worldcup/26worldcup.github.io broadcasters.json (MIT), asOf 2026-06-10.
//
// The open dataset is per-market (country), not per-match — it can't say which
// channel carries a specific game. CazéTV streams all 104 games free, so it's the
// only reliable default. Globo + SBT are only shown where it's certain (Brazil's
// games and the final). For anything else, use `OVERRIDES` to pin exact channels.

export type Broadcaster = {
  id: string
  name: string
  /** text color (fallback chip) */
  fg: string
  /** badge background (fallback chip) */
  bg: string
  free: boolean
  url?: string
  /** optional real logo file in /public/tv — falls back to the colored chip if absent */
  logo?: string
}

export const CAZE: Broadcaster   = { id: 'caze',  name: 'CazéTV', fg: '#ffffff', bg: '#ff2d2d', free: true, url: 'https://www.youtube.com/@CazeTV', logo: '/tv/caze.svg' }
export const GLOBO: Broadcaster  = { id: 'globo', name: 'Globo',  fg: '#ffffff', bg: '#0a3d91', free: true, logo: '/tv/globo.svg' }
export const SBT: Broadcaster    = { id: 'sbt',   name: 'SBT',    fg: '#111827', bg: '#ffd400', free: true, logo: '/tv/sbt.svg' }

// Exact channel overrides per internal matchId (fill in as the grade is confirmed)
const OVERRIDES: Record<string, Broadcaster[]> = {}

/**
 * Channels showing a given match in Brazil.
 * Default: CazéTV always; Globo + SBT for Brazil matches and the knockout stage.
 */
export function broadcastersForMatch(team1Id: string, team2Id: string, phase?: string): Broadcaster[] {
  const isBrazil = team1Id === 'BRA' || team2Id === 'BRA'
  const isFinal = phase === 'final'
  // Only Brazil's games and the final reliably air on open TV (Globo + SBT).
  // Everything else defaults to CazéTV (streams all 104 free); pin exceptions in OVERRIDES.
  if (isBrazil || isFinal) return [GLOBO, SBT, CAZE]
  return [CAZE]
}

export function broadcastersForMatchId(matchId: string, team1Id: string, team2Id: string, phase?: string): Broadcaster[] {
  return OVERRIDES[matchId] ?? broadcastersForMatch(team1Id, team2Id, phase)
}
