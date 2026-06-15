import { Team, Group, Match } from './types'

export const TEAMS: Team[] = [
  // CONMEBOL
  { id: 'ARG', name: 'Argentina',              flag: '🇦🇷', iso2: 'ar', confederation: 'CONMEBOL' },
  { id: 'BRA', name: 'Brasil',                 flag: '🇧🇷', iso2: 'br', confederation: 'CONMEBOL' },
  { id: 'COL', name: 'Colômbia',               flag: '🇨🇴', iso2: 'co', confederation: 'CONMEBOL' },
  { id: 'URU', name: 'Uruguai',                flag: '🇺🇾', iso2: 'uy', confederation: 'CONMEBOL' },
  { id: 'ECU', name: 'Equador',                flag: '🇪🇨', iso2: 'ec', confederation: 'CONMEBOL' },
  { id: 'PAR', name: 'Paraguai',               flag: '🇵🇾', iso2: 'py', confederation: 'CONMEBOL' },
  // CONCACAF
  { id: 'USA', name: 'Estados Unidos',         flag: '🇺🇸', iso2: 'us', confederation: 'CONCACAF' },
  { id: 'MEX', name: 'México',                 flag: '🇲🇽', iso2: 'mx', confederation: 'CONCACAF' },
  { id: 'CAN', name: 'Canadá',                 flag: '🇨🇦', iso2: 'ca', confederation: 'CONCACAF' },
  { id: 'PAN', name: 'Panamá',                 flag: '🇵🇦', iso2: 'pa', confederation: 'CONCACAF' },
  { id: 'HAI', name: 'Haiti',                  flag: '🇭🇹', iso2: 'ht', confederation: 'CONCACAF' },
  { id: 'CUR', name: 'Curaçao',                flag: '🇨🇼', iso2: 'cw', confederation: 'CONCACAF' },
  // UEFA
  { id: 'GER', name: 'Alemanha',               flag: '🇩🇪', iso2: 'de', confederation: 'UEFA' },
  { id: 'FRA', name: 'França',                 flag: '🇫🇷', iso2: 'fr', confederation: 'UEFA' },
  { id: 'ESP', name: 'Espanha',                flag: '🇪🇸', iso2: 'es', confederation: 'UEFA' },
  { id: 'ENG', name: 'Inglaterra',             flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', iso2: 'gb-eng', confederation: 'UEFA' },
  { id: 'POR', name: 'Portugal',               flag: '🇵🇹', iso2: 'pt', confederation: 'UEFA' },
  { id: 'NED', name: 'Holanda',                flag: '🇳🇱', iso2: 'nl', confederation: 'UEFA' },
  { id: 'BEL', name: 'Bélgica',                flag: '🇧🇪', iso2: 'be', confederation: 'UEFA' },
  { id: 'CRO', name: 'Croácia',                flag: '🇭🇷', iso2: 'hr', confederation: 'UEFA' },
  { id: 'TUR', name: 'Turquia',                flag: '🇹🇷', iso2: 'tr', confederation: 'UEFA' },
  { id: 'AUT', name: 'Áustria',                flag: '🇦🇹', iso2: 'at', confederation: 'UEFA' },
  { id: 'SCO', name: 'Escócia',                flag: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', iso2: 'gb-sct', confederation: 'UEFA' },
  { id: 'SUI', name: 'Suíça',                  flag: '🇨🇭', iso2: 'ch', confederation: 'UEFA' },
  { id: 'CZE', name: 'Tchéquia',               flag: '🇨🇿', iso2: 'cz', confederation: 'UEFA' },
  { id: 'BIH', name: 'Bósnia e Herzegovina',   flag: '🇧🇦', iso2: 'ba', confederation: 'UEFA' },
  { id: 'SWE', name: 'Suécia',                 flag: '🇸🇪', iso2: 'se', confederation: 'UEFA' },
  { id: 'NOR', name: 'Noruega',                flag: '🇳🇴', iso2: 'no', confederation: 'UEFA' },
  // CAF
  { id: 'MAR', name: 'Marrocos',               flag: '🇲🇦', iso2: 'ma', confederation: 'CAF' },
  { id: 'SEN', name: 'Senegal',                flag: '🇸🇳', iso2: 'sn', confederation: 'CAF' },
  { id: 'EGY', name: 'Egito',                  flag: '🇪🇬', iso2: 'eg', confederation: 'CAF' },
  { id: 'ALG', name: 'Argélia',                flag: '🇩🇿', iso2: 'dz', confederation: 'CAF' },
  { id: 'RSA', name: 'África do Sul',          flag: '🇿🇦', iso2: 'za', confederation: 'CAF' },
  { id: 'GHA', name: 'Gana',                   flag: '🇬🇭', iso2: 'gh', confederation: 'CAF' },
  { id: 'TUN', name: 'Tunísia',                flag: '🇹🇳', iso2: 'tn', confederation: 'CAF' },
  { id: 'CIV', name: 'Costa do Marfim',        flag: '🇨🇮', iso2: 'ci', confederation: 'CAF' },
  { id: 'CPV', name: 'Cabo Verde',             flag: '🇨🇻', iso2: 'cv', confederation: 'CAF' },
  { id: 'COD', name: 'Congo DR',               flag: '🇨🇩', iso2: 'cd', confederation: 'CAF' },
  // AFC
  { id: 'JPN', name: 'Japão',                  flag: '🇯🇵', iso2: 'jp', confederation: 'AFC' },
  { id: 'KOR', name: 'Coreia do Sul',          flag: '🇰🇷', iso2: 'kr', confederation: 'AFC' },
  { id: 'AUS', name: 'Austrália',              flag: '🇦🇺', iso2: 'au', confederation: 'AFC' },
  { id: 'KSA', name: 'Arábia Saudita',         flag: '🇸🇦', iso2: 'sa', confederation: 'AFC' },
  { id: 'IRN', name: 'Irã',                    flag: '🇮🇷', iso2: 'ir', confederation: 'AFC' },
  { id: 'UZB', name: 'Uzbequistão',            flag: '🇺🇿', iso2: 'uz', confederation: 'AFC' },
  { id: 'JOR', name: 'Jordânia',               flag: '🇯🇴', iso2: 'jo', confederation: 'AFC' },
  { id: 'IRQ', name: 'Iraque',                 flag: '🇮🇶', iso2: 'iq', confederation: 'AFC' },
  { id: 'QAT', name: 'Catar',                  flag: '🇶🇦', iso2: 'qa', confederation: 'AFC' },
  // OFC
  { id: 'NZL', name: 'Nova Zelândia',          flag: '🇳🇿', iso2: 'nz', confederation: 'OFC' },
]

export const GROUPS: Group[] = [
  { id: 'A', name: 'Grupo A', teamIds: ['MEX', 'RSA', 'KOR', 'CZE'] },
  { id: 'B', name: 'Grupo B', teamIds: ['CAN', 'BIH', 'QAT', 'SUI'] },
  { id: 'C', name: 'Grupo C', teamIds: ['BRA', 'MAR', 'HAI', 'SCO'] },
  { id: 'D', name: 'Grupo D', teamIds: ['USA', 'PAR', 'AUS', 'TUR'] },
  { id: 'E', name: 'Grupo E', teamIds: ['GER', 'CIV', 'CUR', 'ECU'] },
  { id: 'F', name: 'Grupo F', teamIds: ['NED', 'JPN', 'SWE', 'TUN'] },
  { id: 'G', name: 'Grupo G', teamIds: ['BEL', 'EGY', 'IRN', 'NZL'] },
  { id: 'H', name: 'Grupo H', teamIds: ['ESP', 'CPV', 'KSA', 'URU'] },
  { id: 'I', name: 'Grupo I', teamIds: ['FRA', 'SEN', 'IRQ', 'NOR'] },
  { id: 'J', name: 'Grupo J', teamIds: ['ARG', 'ALG', 'AUT', 'JOR'] },
  { id: 'K', name: 'Grupo K', teamIds: ['POR', 'COD', 'UZB', 'COL'] },
  { id: 'L', name: 'Grupo L', teamIds: ['ENG', 'CRO', 'GHA', 'PAN'] },
]

// Datas e locais dos jogos confirmados
const GROUP_SCHEDULE: Record<string, [string, string][]> = {
  D: [
    ['12/06 22:00', 'Los Angeles'], ['14/06 01:00', 'Vancouver'],
    ['18/06 22:00', 'Los Angeles'], ['18/06 19:00', 'Vancouver'],
    ['22/06 22:00', 'Los Angeles'], ['22/06 22:00', 'Vancouver'],
  ],
  E: [
    ['14/06 14:00', 'Houston'], ['14/06 20:00', 'Filadélfia'],
    ['18/06 14:00', 'Houston'], ['18/06 17:00', 'Filadélfia'],
    ['22/06 19:00', 'Houston'], ['22/06 19:00', 'Filadélfia'],
  ],
}

function groupMatches(groupId: string, teamIds: string[]): Match[] {
  const [t1, t2, t3, t4] = teamIds
  const pairs: [string, string][] = [
    [t1, t2], [t3, t4],
    [t1, t3], [t2, t4],
    [t1, t4], [t2, t3],
  ]
  const groupIndex = groupId.charCodeAt(0) - 'A'.charCodeAt(0)
  const schedule = GROUP_SCHEDULE[groupId]
  return pairs.map(([a, b], i) => ({
    id: `G${groupId}${i + 1}`,
    phase: 'group' as const,
    groupId,
    matchNumber: groupIndex * 6 + i + 1,
    team1Id: a,
    team2Id: b,
    date: schedule?.[i]?.[0],
    venue: schedule?.[i]?.[1],
  }))
}

export const GROUP_MATCHES: Match[] = GROUPS.flatMap(g =>
  groupMatches(g.id, g.teamIds)
)

export const KNOCKOUT_MATCHES: Match[] = [
  ...Array.from({ length: 16 }, (_, i) => ({
    id: `R32_${i + 1}`, phase: 'round_of_32' as const,
    matchNumber: 73 + i, team1Id: 'TBD', team2Id: 'TBD',
  })),
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `R16_${i + 1}`, phase: 'round_of_16' as const,
    matchNumber: 89 + i, team1Id: 'TBD', team2Id: 'TBD',
  })),
  ...Array.from({ length: 4 }, (_, i) => ({
    id: `QF_${i + 1}`, phase: 'quarterfinal' as const,
    matchNumber: 97 + i, team1Id: 'TBD', team2Id: 'TBD',
  })),
  ...Array.from({ length: 2 }, (_, i) => ({
    id: `SF_${i + 1}`, phase: 'semifinal' as const,
    matchNumber: 101 + i, team1Id: 'TBD', team2Id: 'TBD',
  })),
  { id: 'TP_1', phase: 'third_place' as const, matchNumber: 103, team1Id: 'TBD', team2Id: 'TBD' },
  { id: 'F_1',  phase: 'final' as const,       matchNumber: 104, team1Id: 'TBD', team2Id: 'TBD' },
]

export const ALL_MATCHES: Match[] = [...GROUP_MATCHES, ...KNOCKOUT_MATCHES]

export const teamById  = Object.fromEntries(TEAMS.map(t => [t.id, t]))
export const groupById = Object.fromEntries(GROUPS.map(g => [g.id, g]))
export const matchById = Object.fromEntries(ALL_MATCHES.map(m => [m.id, m]))

// Chaveamento oficial do R32 da Copa 2026
export type BracketSlot =
  | { type: 'rank'; group: string; rank: 1 | 2 }
  | { type: 'best3rd'; index: number } // índice no ranking dos melhores 3ºs (0 = melhor)

// Confrontos fixos baseados no chaveamento oficial FIFA Copa 2026
export const R32_BRACKET: { id: string; s1: BracketSlot; s2: BracketSlot }[] = [
  { id: 'R32_1',  s1: { type:'rank', group:'A', rank:2 }, s2: { type:'rank', group:'B', rank:2 } },
  { id: 'R32_2',  s1: { type:'rank', group:'E', rank:1 }, s2: { type:'best3rd', index:0 } },
  { id: 'R32_3',  s1: { type:'rank', group:'F', rank:1 }, s2: { type:'rank', group:'C', rank:2 } },
  { id: 'R32_4',  s1: { type:'rank', group:'C', rank:1 }, s2: { type:'rank', group:'F', rank:2 } },
  { id: 'R32_5',  s1: { type:'rank', group:'B', rank:1 }, s2: { type:'best3rd', index:1 } },
  { id: 'R32_6',  s1: { type:'rank', group:'E', rank:2 }, s2: { type:'rank', group:'I', rank:2 } },
  { id: 'R32_7',  s1: { type:'rank', group:'A', rank:1 }, s2: { type:'best3rd', index:2 } },
  { id: 'R32_8',  s1: { type:'rank', group:'L', rank:1 }, s2: { type:'best3rd', index:3 } },
  { id: 'R32_9',  s1: { type:'rank', group:'G', rank:1 }, s2: { type:'best3rd', index:4 } },
  { id: 'R32_10', s1: { type:'rank', group:'D', rank:1 }, s2: { type:'best3rd', index:5 } },
  { id: 'R32_11', s1: { type:'rank', group:'K', rank:2 }, s2: { type:'rank', group:'L', rank:2 } },
  { id: 'R32_12', s1: { type:'rank', group:'H', rank:1 }, s2: { type:'rank', group:'J', rank:2 } },
  { id: 'R32_13', s1: { type:'rank', group:'J', rank:1 }, s2: { type:'rank', group:'H', rank:2 } },
  { id: 'R32_14', s1: { type:'rank', group:'I', rank:1 }, s2: { type:'best3rd', index:6 } },
  { id: 'R32_15', s1: { type:'rank', group:'K', rank:1 }, s2: { type:'best3rd', index:7 } },
  { id: 'R32_16', s1: { type:'rank', group:'D', rank:2 }, s2: { type:'rank', group:'G', rank:2 } },
]
