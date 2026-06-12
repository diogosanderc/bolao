import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../data/db.json')

const db = JSON.parse(readFileSync(dbPath, 'utf8'))

const PARTICIPANT_ID = 'macalister-001'

// Remove existing MACALISTER predictions
db.matchPredictions = db.matchPredictions.filter(p => p.participantId !== PARTICIPANT_ID)

// Remove existing MACALISTER participant (will re-add to preserve order)
db.participants = db.participants.filter(p => p.id !== PARTICIPANT_ID)

// Re-add MACALISTER participant at the front
db.participants.unshift({
  id: PARTICIPANT_ID,
  name: 'MACALISTER',
  email: '',
  passwordHash: '',
  token: 'ab183d6813227adc',
  createdAt: '2026-06-11T13:43:27.461Z',
})

function pred(matchId, score1, score2, advancingTeamId) {
  const p = { participantId: PARTICIPANT_ID, matchId, score1, score2 }
  if (advancingTeamId) p.advancingTeamId = advancingTeamId
  return p
}

const predictions = [
  // Group A
  pred('GA1', 2, 1),
  pred('GA2', 1, 0),
  pred('GA3', 1, 2),
  pred('GA4', 1, 1),
  pred('GA5', 2, 0),
  pred('GA6', 1, 1),
  // Group B
  pred('GB1', 1, 1),
  pred('GB2', 0, 2),
  pred('GB3', 1, 0),
  pred('GB4', 1, 2),
  pred('GB5', 1, 2),
  pred('GB6', 2, 1),
  // Group C
  pred('GC1', 2, 1),
  pred('GC2', 0, 2),
  pred('GC3', 4, 0),
  pred('GC4', 2, 1),
  pred('GC5', 2, 0),
  pred('GC6', 3, 0),
  // Group D
  pred('GD1', 2, 1),
  pred('GD2', 0, 2),
  pred('GD3', 2, 0),
  pred('GD4', 1, 3),
  pred('GD5', 1, 2),
  pred('GD6', 1, 1),
  // Group E
  pred('GE1', 2, 1),
  pred('GE2', 0, 3),
  pred('GE3', 4, 0),
  pred('GE4', 1, 1),
  pred('GE5', 3, 1),
  pred('GE6', 2, 0),
  // Group F
  pred('GF1', 2, 1),
  pred('GF2', 1, 1),
  pred('GF3', 2, 0),
  pred('GF4', 2, 1),
  pred('GF5', 2, 0),
  pred('GF6', 2, 0),
  // Group G
  pred('GG1', 3, 1),
  pred('GG2', 1, 0),
  pred('GG3', 2, 1),
  pred('GG4', 2, 0),
  pred('GG5', 2, 0),
  pred('GG6', 1, 2),
  // Group H
  pred('GH1', 3, 0),
  pred('GH2', 0, 2),
  pred('GH3', 3, 1),
  pred('GH4', 0, 2),
  pred('GH5', 2, 0),
  pred('GH6', 0, 2),
  // Group I
  pred('GI1', 2, 0),
  pred('GI2', 0, 2),
  pred('GI3', 3, 0),
  pred('GI4', 2, 1),
  pred('GI5', 2, 0),
  pred('GI6', 1, 0),
  // Group J
  pred('GJ1', 2, 0),
  pred('GJ2', 1, 0),
  pred('GJ3', 3, 0),
  pred('GJ4', 2, 0),
  pred('GJ5', 3, 0),
  pred('GJ6', 1, 0),
  // Group K
  pred('GK1', 3, 0),
  pred('GK2', 0, 2),
  pred('GK3', 3, 0),
  pred('GK4', 0, 3),
  pred('GK5', 2, 0),
  pred('GK6', 1, 0),
  // Group L
  pred('GL1', 2, 1),
  pred('GL2', 2, 1),
  pred('GL3', 2, 0),
  pred('GL4', 2, 0),
  pred('GL5', 3, 0),
  pred('GL6', 1, 0),

  // R32
  // R32_1: MEX 2-1 BIH (2ºA vs 2ºB)
  pred('R32_1', 2, 1),
  // R32_2: GER 2-0 SCO (1ºE vs 3rd)
  pred('R32_2', 2, 0),
  // R32_3: NED 1-1 MAR, MAR advances
  pred('R32_3', 1, 1, 'MAR'),
  // R32_4: BRA 2-1 JPN (1ºC vs 2ºF)
  pred('R32_4', 2, 1),
  // R32_5: SUI 2-1 AUT (1ºB vs 3rd)
  pred('R32_5', 2, 1),
  // R32_6: ECU 1-1 SEN, SEN advances
  pred('R32_6', 1, 1, 'SEN'),
  // R32_7: KOR 2-1 CIV (1ºA vs 3rd)
  pred('R32_7', 2, 1),
  // R32_8: ENG 2-1 NOR (1ºL vs 3rd)
  pred('R32_8', 2, 1),
  // R32_9: BEL 2-0 KSA (1ºG vs 3rd)
  pred('R32_9', 2, 0),
  // R32_10: TUR 1-1 CAN, TUR advances
  pred('R32_10', 1, 1, 'TUR'),
  // R32_11: COL 2-1 CRO (2ºK vs 2ºL)
  pred('R32_11', 2, 1),
  // R32_12: ESP 3-0 ALG (1ºH vs 2ºJ)
  pred('R32_12', 3, 0),
  // R32_13: ARG 2-0 URU (1ºJ vs 2ºH)
  pred('R32_13', 2, 0),
  // R32_14: FRA 3-0 EGY (1ºI vs 3rd)
  pred('R32_14', 3, 0),
  // R32_15: POR 2-0 GHA (1ºK vs 3rd)
  pred('R32_15', 2, 0),
  // R32_16: EUA 1-1 IRN, IRN advances
  pred('R32_16', 1, 1, 'IRN'),

  // R16
  // R16_1: [R32_2, R32_14] = GER vs FRA -> GER 1-2 FRA
  pred('R16_1', 1, 2),
  // R16_2: [R32_1, R32_3] = MEX vs MAR -> MEX 1-2 MAR
  pred('R16_2', 1, 2),
  // R16_3: [R32_4, R32_6] = BRA vs SEN -> BRA 2-1 SEN
  pred('R16_3', 2, 1),
  // R16_4: [R32_7, R32_8] = KOR vs ENG -> KOR 1-2 ENG
  pred('R16_4', 1, 2),
  // R16_5: [R32_11, R32_12] = COL vs ESP -> COL 0-2 ESP
  pred('R16_5', 0, 2),
  // R16_6: [R32_10, R32_9] = TUR vs BEL -> TUR 1-2 BEL
  pred('R16_6', 1, 2),
  // R16_7: [R32_13, R32_16] = ARG vs IRN -> ARG 2-0 IRN
  pred('R16_7', 2, 0),
  // R16_8: [R32_5, R32_15] = SUI vs POR -> SUI 1-2 POR
  pred('R16_8', 1, 2),

  // QF
  // QF_1: [R16_1, R16_2] = FRA vs MAR -> FRA 2-0 MAR
  pred('QF_1', 2, 0),
  // QF_2: [R16_3, R16_4] = BRA vs ENG -> BRA 1-2 ENG
  pred('QF_2', 1, 2),
  // QF_3: [R16_5, R16_6] = ESP vs BEL -> ESP 2-1 BEL
  pred('QF_3', 2, 1),
  // QF_4: [R16_7, R16_8] = ARG vs POR -> ARG 1-1 POR, POR advances
  pred('QF_4', 1, 1, 'POR'),

  // SF
  // SF_1: [QF_1, QF_3] = FRA vs ESP -> FRA 2-1 ESP
  pred('SF_1', 2, 1),
  // SF_2: [QF_2, QF_4] = ENG vs POR -> ENG 1-1 POR, POR advances
  pred('SF_2', 1, 1, 'POR'),

  // 3rd place
  // TP_1: losers SF_1 and SF_2 = ESP vs ENG -> ESP 2-0 ENG
  pred('TP_1', 2, 0),

  // Final
  // F_1: [SF_1, SF_2] = FRA vs POR -> FRA 2-1 POR
  pred('F_1', 2, 1),
]

db.matchPredictions.push(...predictions)

writeFileSync(dbPath, JSON.stringify(db, null, 2))
console.log(`Done! Added ${predictions.length} predictions for MACALISTER.`)
