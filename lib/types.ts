export type Phase =
  | 'group'
  | 'round_of_32'
  | 'round_of_16'
  | 'quarterfinal'
  | 'semifinal'
  | 'third_place'
  | 'final'

export const PHASE_LABELS: Record<Phase, string> = {
  group: 'Fase de Grupos',
  round_of_32: '16 avos de Final',
  round_of_16: 'Oitavas de Final',
  quarterfinal: 'Quartas de Final',
  semifinal: 'Semifinal',
  third_place: 'Disputa pelo 3º Lugar',
  final: 'Final',
}

export const KNOCKOUT_PHASES: Phase[] = [
  'round_of_32',
  'round_of_16',
  'quarterfinal',
  'semifinal',
  'third_place',
  'final',
]

export interface Team {
  id: string
  name: string
  flag: string  // emoji (fallback)
  iso2: string  // ISO 3166-1 alpha-2 para flagcdn.com
  confederation: string
}

export interface Group {
  id: string
  name: string
  teamIds: string[]
}

export interface Match {
  id: string
  phase: Phase
  groupId?: string
  matchNumber: number
  team1Id: string
  team2Id: string
  date?: string
  venue?: string
}

export interface MatchResult {
  matchId: string
  score1: number
  score2: number
  // For knockout draws: id of team that advances (via pen/et)
  advancingTeamId?: string
}

export interface MatchPrediction {
  participantId: string
  matchId: string
  score1: number
  score2: number
  // For knockout: id of team participant thinks will advance if draw
  advancingTeamId?: string
}

export interface GroupPrediction {
  participantId: string
  groupId: string
  order: string[] // team ids in predicted final standings [1st, 2nd, 3rd, 4th]
}

export interface Participant {
  id: string
  name: string
  email: string
  passwordHash: string
  token: string       // token único para URL de palpites
  sessionToken?: string
  sessionExpiry?: string
  resetToken?: string
  resetExpiry?: string
  createdAt: string
}

export interface Database {
  participants: Participant[]
  matchPredictions: MatchPrediction[]
  groupPredictions: GroupPrediction[]
  results: MatchResult[]
}

export interface LeaderboardEntry {
  participant: Participant
  totalPoints: number
  matchPoints: number
  phasePoints: number
  breakdown: {
    correctResults: number
    correctScores: number
    correctGoals: number
    highScoreBonus: number
    groupOrderPoints: number
    advancementPoints: Record<string, number>
  }
}
