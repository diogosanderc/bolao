import { Team, Group, Match } from './types'

export const TEAMS: Team[] = [
  // CONMEBOL
  { id: 'ARG', name: 'Argentina',     flag: '🇦🇷', confederation: 'CONMEBOL' },
  { id: 'BRA', name: 'Brasil',        flag: '🇧🇷', confederation: 'CONMEBOL' },
  { id: 'COL', name: 'Colômbia',      flag: '🇨🇴', confederation: 'CONMEBOL' },
  { id: 'URU', name: 'Uruguai',       flag: '🇺🇾', confederation: 'CONMEBOL' },
  { id: 'ECU', name: 'Equador',       flag: '🇪🇨', confederation: 'CONMEBOL' },
  { id: 'PAR', name: 'Paraguai',      flag: '🇵🇾', confederation: 'CONMEBOL' },
  // CONCACAF
  { id: 'USA', name: 'Estados Unidos', flag: '🇺🇸', confederation: 'CONCACAF' },
  { id: 'MEX', name: 'México',         flag: '🇲🇽', confederation: 'CONCACAF' },
  { id: 'CAN', name: 'Canadá',         flag: '🇨🇦', confederation: 'CONCACAF' },
  { id: 'PAN', name: 'Panamá',         flag: '🇵🇦', confederation: 'CONCACAF' },
  { id: 'JAM', name: 'Jamaica',        flag: '🇯🇲', confederation: 'CONCACAF' },
  { id: 'CRC', name: 'Costa Rica',     flag: '🇨🇷', confederation: 'CONCACAF' },
  { id: 'HON', name: 'Honduras',       flag: '🇭🇳', confederation: 'CONCACAF' },
  { id: 'SLV', name: 'El Salvador',    flag: '🇸🇻', confederation: 'CONCACAF' },
  // UEFA
  { id: 'GER', name: 'Alemanha',    flag: '🇩🇪', confederation: 'UEFA' },
  { id: 'FRA', name: 'França',      flag: '🇫🇷', confederation: 'UEFA' },
  { id: 'ESP', name: 'Espanha',     flag: '🇪🇸', confederation: 'UEFA' },
  { id: 'ENG', name: 'Inglaterra',  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', confederation: 'UEFA' },
  { id: 'POR', name: 'Portugal',    flag: '🇵🇹', confederation: 'UEFA' },
  { id: 'ITA', name: 'Itália',      flag: '🇮🇹', confederation: 'UEFA' },
  { id: 'NED', name: 'Holanda',     flag: '🇳🇱', confederation: 'UEFA' },
  { id: 'BEL', name: 'Bélgica',     flag: '🇧🇪', confederation: 'UEFA' },
  { id: 'CRO', name: 'Croácia',     flag: '🇭🇷', confederation: 'UEFA' },
  { id: 'SRB', name: 'Sérvia',      flag: '🇷🇸', confederation: 'UEFA' },
  { id: 'TUR', name: 'Turquia',     flag: '🇹🇷', confederation: 'UEFA' },
  { id: 'AUT', name: 'Áustria',     flag: '🇦🇹', confederation: 'UEFA' },
  { id: 'POL', name: 'Polônia',     flag: '🇵🇱', confederation: 'UEFA' },
  { id: 'SCO', name: 'Escócia',     flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', confederation: 'UEFA' },
  { id: 'UKR', name: 'Ucrânia',     flag: '🇺🇦', confederation: 'UEFA' },
  { id: 'SUI', name: 'Suíça',       flag: '🇨🇭', confederation: 'UEFA' },
  // CAF
  { id: 'MAR', name: 'Marrocos',    flag: '🇲🇦', confederation: 'CAF' },
  { id: 'SEN', name: 'Senegal',     flag: '🇸🇳', confederation: 'CAF' },
  { id: 'NGA', name: 'Nigéria',     flag: '🇳🇬', confederation: 'CAF' },
  { id: 'EGY', name: 'Egito',       flag: '🇪🇬', confederation: 'CAF' },
  { id: 'ALG', name: 'Argélia',     flag: '🇩🇿', confederation: 'CAF' },
  { id: 'CMR', name: 'Camarões',    flag: '🇨🇲', confederation: 'CAF' },
  { id: 'RSA', name: 'África do Sul', flag: '🇿🇦', confederation: 'CAF' },
  { id: 'GHA', name: 'Gana',        flag: '🇬🇭', confederation: 'CAF' },
  { id: 'TUN', name: 'Tunísia',     flag: '🇹🇳', confederation: 'CAF' },
  // AFC
  { id: 'JPN', name: 'Japão',       flag: '🇯🇵', confederation: 'AFC' },
  { id: 'KOR', name: 'Coreia do Sul', flag: '🇰🇷', confederation: 'AFC' },
  { id: 'AUS', name: 'Austrália',   flag: '🇦🇺', confederation: 'AFC' },
  { id: 'KSA', name: 'Arábia Saudita', flag: '🇸🇦', confederation: 'AFC' },
  { id: 'IRN', name: 'Irã',         flag: '🇮🇷', confederation: 'AFC' },
  { id: 'UZB', name: 'Uzbequistão', flag: '🇺🇿', confederation: 'AFC' },
  { id: 'JOR', name: 'Jordânia',    flag: '🇯🇴', confederation: 'AFC' },
  { id: 'IRQ', name: 'Iraque',      flag: '🇮🇶', confederation: 'AFC' },
  // OFC
  { id: 'NZL', name: 'Nova Zelândia', flag: '🇳🇿', confederation: 'OFC' },
]

export const GROUPS: Group[] = [
  { id: 'A', name: 'Grupo A', teamIds: ['USA', 'PAN', 'NZL', 'SLV'] },
  { id: 'B', name: 'Grupo B', teamIds: ['MEX', 'JAM', 'KSA', 'GHA'] },
  { id: 'C', name: 'Grupo C', teamIds: ['CAN', 'CRC', 'JOR', 'RSA'] },
  { id: 'D', name: 'Grupo D', teamIds: ['BRA', 'COL', 'AUT', 'TUR'] },
  { id: 'E', name: 'Grupo E', teamIds: ['ARG', 'ECU', 'SRB', 'CRO'] },
  { id: 'F', name: 'Grupo F', teamIds: ['URU', 'PAR', 'POL', 'UKR'] },
  { id: 'G', name: 'Grupo G', teamIds: ['FRA', 'GER', 'MAR', 'CMR'] },
  { id: 'H', name: 'Grupo H', teamIds: ['ESP', 'ITA', 'JPN', 'ALG'] },
  { id: 'I', name: 'Grupo I', teamIds: ['ENG', 'NED', 'KOR', 'NGA'] },
  { id: 'J', name: 'Grupo J', teamIds: ['POR', 'BEL', 'AUS', 'EGY'] },
  { id: 'K', name: 'Grupo K', teamIds: ['HON', 'SUI', 'UZB', 'SEN'] },
  { id: 'L', name: 'Grupo L', teamIds: ['IRN', 'SCO', 'IRQ', 'TUN'] },
]

function groupMatches(groupId: string, teamIds: string[]): Match[] {
  const [t1, t2, t3, t4] = teamIds
  const pairs = [
    [t1, t2], [t3, t4],
    [t1, t3], [t2, t4],
    [t1, t4], [t2, t3],
  ]
  const groupIndex = groupId.charCodeAt(0) - 'A'.charCodeAt(0)
  return pairs.map(([a, b], i) => ({
    id: `G${groupId}${i + 1}`,
    phase: 'group' as const,
    groupId,
    matchNumber: groupIndex * 6 + i + 1,
    team1Id: a,
    team2Id: b,
  }))
}

export const GROUP_MATCHES: Match[] = GROUPS.flatMap(g =>
  groupMatches(g.id, g.teamIds)
)

// Knockout matches start as TBD — teams filled in as tournament progresses.
// IDs follow the bracket structure so the admin can link them.
export const KNOCKOUT_MATCHES: Match[] = [
  // Round of 32 (16 avos) - 16 matches
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `R32_${i + 1}`,
    phase: 'round_of_32' as const,
    matchNumber: 73 + i,
    team1Id: 'TBD',
    team2Id: 'TBD',
  })),
  // Round of 16 (oitavas) - 8 matches
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `R16_${i + 1}`,
    phase: 'round_of_16' as const,
    matchNumber: 89 + i,
    team1Id: 'TBD',
    team2Id: 'TBD',
  })),
  // Quarterfinals - 4 matches
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `QF_${i + 1}`,
    phase: 'quarterfinal' as const,
    matchNumber: 97 + i,
    team1Id: 'TBD',
    team2Id: 'TBD',
  })),
  // Semifinals - 2 matches
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `SF_${i + 1}`,
    phase: 'semifinal' as const,
    matchNumber: 101 + i,
    team1Id: 'TBD',
    team2Id: 'TBD',
  })),
  // Third place
  {
    id: 'TP_1',
    phase: 'third_place' as const,
    matchNumber: 103,
    team1Id: 'TBD',
    team2Id: 'TBD',
  },
  // Final
  {
    id: 'F_1',
    phase: 'final' as const,
    matchNumber: 104,
    team1Id: 'TBD',
    team2Id: 'TBD',
  },
]

export const ALL_MATCHES: Match[] = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

export const teamById = Object.fromEntries(TEAMS.map(t => [t.id, t]))
export const groupById = Object.fromEntries(GROUPS.map(g => [g.id, g]))
export const matchById = Object.fromEntries(ALL_MATCHES.map(m => [m.id, m]))
