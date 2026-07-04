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
  score1: number   // full final score (regulation + ET goals) — used for display
  score2: number
  // For knockout matches that went to ET/penalties: regulation-time score for points calculation
  regulationScore1?: number
  regulationScore2?: number
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

export interface PushSubscriptionRecord {
  endpoint: string
  keys: { p256dh: string; auth: string }
  createdAt: string
  participantId?: string // the "sou eu" participant this device follows
}

export interface R32TeamPick {
  participantId: string
  teamIds: string[] // 32 teams explicitly predicted to qualify for round of 32
}

export interface KnockoutPhasePick {
  participantId: string
  r16: string[]       // 16 teams predicted to reach round of 16
  qf: string[]        // 8 teams predicted to reach quarterfinal
  sf: string[]        // 4 teams predicted to reach semifinal
  finalists: string[] // 2 teams predicted to reach final
  champion: string    // 1 team predicted as champion
}

export interface Database {
  participants: Participant[]
  matchPredictions: MatchPrediction[]
  groupPredictions: GroupPrediction[]
  results: MatchResult[]
  matchDates: Record<string, { date: string; dateBRT: string; venue: string }>
  pushSubscriptions?: PushSubscriptionRecord[]
  liveMatchStates?: Record<string, { status: 'pre' | 'in' | 'halftime' | 'suspended' | 'extratime' | 'et_halftime' | 'penalties' | 'completed'; score1: number; score2: number }>
  r32TeamPicks?: R32TeamPick[]
  knockoutPhasePicks?: KnockoutPhasePick[]
  lastRanks?: Record<string, number> // last notified rank per participant (for position push)
  souEu?: Record<string, { at: string; count: number }> // participantId → last "Sou eu" click
}

export interface LeaderboardEntry {
  participant: Participant
  totalPoints: number
  matchPoints: number
  phasePoints: number
  lastMatchPoints: number
  breakdown: {
    correctResults: number
    correctScores: number
    correctGoals: number
    highScoreBonus: number
    groupOrderPoints: number
    advancementPoints: Record<string, number>
  }
}
