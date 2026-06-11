import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = join(__dirname, '..', 'data', 'db.json')

const db = JSON.parse(readFileSync(DB_PATH, 'utf-8'))

// Remove MANSONI if exists
db.participants = db.participants.filter(p => p.name !== 'MANSONI')
db.matchPredictions = db.matchPredictions.filter(p => p.participantId !== 'mansoni-001')

// Add MANSONI participant
db.participants.push({
  id: 'mansoni-001',
  name: 'MANSONI',
  email: '',
  passwordHash: '',
  token: 'mansoni2026tok',
  createdAt: '2026-06-11T14:00:00.000Z',
})

const preds = []
const pid = 'mansoni-001'

// ============================================================
// FASE DE GRUPOS
// Pares por grupo: GA1=[MEX,RSA], GA2=[KOR,CZE], GA3=[MEX,KOR], GA4=[RSA,CZE], GA5=[MEX,CZE], GA6=[RSA,KOR]
// ============================================================

// Grupo A: [MEX, RSA, KOR, CZE]
preds.push({ participantId: pid, matchId: 'GA1', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GA2', score1: 1, score2: 2 })
preds.push({ participantId: pid, matchId: 'GA3', score1: 1, score2: 0 })
preds.push({ participantId: pid, matchId: 'GA4', score1: 1, score2: 2 })
preds.push({ participantId: pid, matchId: 'GA5', score1: 1, score2: 0 })
preds.push({ participantId: pid, matchId: 'GA6', score1: 1, score2: 1 })

// Grupo B: [CAN, BIH, QAT, SUI]
preds.push({ participantId: pid, matchId: 'GB1', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GB2', score1: 0, score2: 1 })
preds.push({ participantId: pid, matchId: 'GB3', score1: 1, score2: 0 })
preds.push({ participantId: pid, matchId: 'GB4', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GB5', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GB6', score1: 1, score2: 1 })

// Grupo C: [BRA, MAR, HAI, SCO]
preds.push({ participantId: pid, matchId: 'GC1', score1: 2, score2: 0 })
preds.push({ participantId: pid, matchId: 'GC2', score1: 0, score2: 2 })
preds.push({ participantId: pid, matchId: 'GC3', score1: 5, score2: 0 })
preds.push({ participantId: pid, matchId: 'GC4', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GC5', score1: 2, score2: 0 })
preds.push({ participantId: pid, matchId: 'GC6', score1: 3, score2: 0 })

// Grupo D: [USA, PAR, AUS, TUR]
preds.push({ participantId: pid, matchId: 'GD1', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GD2', score1: 0, score2: 2 })
preds.push({ participantId: pid, matchId: 'GD3', score1: 1, score2: 0 })
preds.push({ participantId: pid, matchId: 'GD4', score1: 1, score2: 2 })
preds.push({ participantId: pid, matchId: 'GD5', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GD6', score1: 1, score2: 0 })

// Grupo E: [GER, CIV, CUR, ECU]
preds.push({ participantId: pid, matchId: 'GE1', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GE2', score1: 1, score2: 3 })
preds.push({ participantId: pid, matchId: 'GE3', score1: 5, score2: 0 })
preds.push({ participantId: pid, matchId: 'GE4', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GE5', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GE6', score1: 2, score2: 0 })

// Grupo F: [NED, JPN, SWE, TUN]
preds.push({ participantId: pid, matchId: 'GF1', score1: 2, score2: 0 })
preds.push({ participantId: pid, matchId: 'GF2', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GF3', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GF4', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GF5', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GF6', score1: 2, score2: 1 })

// Grupo G: [BEL, EGY, IRN, NZL]
preds.push({ participantId: pid, matchId: 'GG1', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GG2', score1: 1, score2: 0 })
preds.push({ participantId: pid, matchId: 'GG3', score1: 3, score2: 0 })
preds.push({ participantId: pid, matchId: 'GG4', score1: 4, score2: 1 })
preds.push({ participantId: pid, matchId: 'GG5', score1: 3, score2: 1 })
preds.push({ participantId: pid, matchId: 'GG6', score1: 2, score2: 1 })

// Grupo H: [ESP, CPV, KSA, URU]
preds.push({ participantId: pid, matchId: 'GH1', score1: 4, score2: 0 })
preds.push({ participantId: pid, matchId: 'GH2', score1: 1, score2: 2 })
preds.push({ participantId: pid, matchId: 'GH3', score1: 2, score2: 0 })
preds.push({ participantId: pid, matchId: 'GH4', score1: 0, score2: 2 })
preds.push({ participantId: pid, matchId: 'GH5', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GH6', score1: 0, score2: 2 })

// Grupo I: [FRA, SEN, IRQ, NOR]
preds.push({ participantId: pid, matchId: 'GI1', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GI2', score1: 0, score2: 3 })
preds.push({ participantId: pid, matchId: 'GI3', score1: 4, score2: 1 })
preds.push({ participantId: pid, matchId: 'GI4', score1: 1, score2: 1 })
preds.push({ participantId: pid, matchId: 'GI5', score1: 3, score2: 1 })
preds.push({ participantId: pid, matchId: 'GI6', score1: 1, score2: 0 })

// Grupo J: [ARG, ALG, AUT, JOR]
preds.push({ participantId: pid, matchId: 'GJ1', score1: 2, score2: 0 })
preds.push({ participantId: pid, matchId: 'GJ2', score1: 1, score2: 0 })
preds.push({ participantId: pid, matchId: 'GJ3', score1: 2, score2: 0 })
preds.push({ participantId: pid, matchId: 'GJ4', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GJ5', score1: 3, score2: 0 })
preds.push({ participantId: pid, matchId: 'GJ6', score1: 1, score2: 1 })

// Grupo K: [POR, COD, UZB, COL]
preds.push({ participantId: pid, matchId: 'GK1', score1: 4, score2: 0 })
preds.push({ participantId: pid, matchId: 'GK2', score1: 0, score2: 2 })
preds.push({ participantId: pid, matchId: 'GK3', score1: 3, score2: 0 })
preds.push({ participantId: pid, matchId: 'GK4', score1: 1, score2: 3 })
preds.push({ participantId: pid, matchId: 'GK5', score1: 2, score2: 2 })
preds.push({ participantId: pid, matchId: 'GK6', score1: 1, score2: 1 })

// Grupo L: [ENG, CRO, GHA, PAN]
preds.push({ participantId: pid, matchId: 'GL1', score1: 2, score2: 2 })
preds.push({ participantId: pid, matchId: 'GL2', score1: 3, score2: 1 })
preds.push({ participantId: pid, matchId: 'GL3', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GL4', score1: 2, score2: 1 })
preds.push({ participantId: pid, matchId: 'GL5', score1: 3, score2: 1 })
preds.push({ participantId: pid, matchId: 'GL6', score1: 1, score2: 1 })

// ============================================================
// DEZESSEIS AVOS (R32)
// Slots: s1 = team listed first in bracket, s2 = team listed second
// R32_1: s1=2.ºA(CZE), s2=2.ºB(SUI)
// R32_2: s1=1.ºE(GER), s2=3rd
// etc.
// advancingTeamId required when scores tied (X marker in XLSX)
// ============================================================
preds.push({ participantId: pid, matchId: 'R32_1',  score1: 2, score2: 2, advancingTeamId: 'CZE' })  // 2.ºA CZE wins pens
preds.push({ participantId: pid, matchId: 'R32_2',  score1: 2, score2: 0 })  // GER wins
preds.push({ participantId: pid, matchId: 'R32_3',  score1: 3, score2: 1 })  // NED wins
preds.push({ participantId: pid, matchId: 'R32_4',  score1: 2, score2: 0 })  // BRA wins
preds.push({ participantId: pid, matchId: 'R32_5',  score1: 1, score2: 0 })  // CAN wins
preds.push({ participantId: pid, matchId: 'R32_6',  score1: 1, score2: 1, advancingTeamId: 'ECU' })  // 2.ºE ECU wins pens
preds.push({ participantId: pid, matchId: 'R32_7',  score1: 2, score2: 0 })  // MEX wins
preds.push({ participantId: pid, matchId: 'R32_8',  score1: 2, score2: 0 })  // ENG wins
preds.push({ participantId: pid, matchId: 'R32_9',  score1: 2, score2: 0 })  // BEL wins
preds.push({ participantId: pid, matchId: 'R32_10', score1: 0, score2: 0, advancingTeamId: 'TUR' })  // 1.ºD TUR wins pens
preds.push({ participantId: pid, matchId: 'R32_11', score1: 1, score2: 0 })  // COL wins
preds.push({ participantId: pid, matchId: 'R32_12', score1: 3, score2: 0 })  // ESP wins
preds.push({ participantId: pid, matchId: 'R32_13', score1: 2, score2: 1 })  // ARG wins
preds.push({ participantId: pid, matchId: 'R32_14', score1: 3, score2: 0 })  // FRA wins
preds.push({ participantId: pid, matchId: 'R32_15', score1: 3, score2: 0 })  // POR wins
preds.push({ participantId: pid, matchId: 'R32_16', score1: 1, score2: 0 })  // USA wins

// ============================================================
// OITAVAS DE FINAL (R16)
// R16_1: winner(R32_2)=GER  vs winner(R32_14)=FRA  → FRA wins pens 2-2
// R16_2: winner(R32_1)=CZE  vs winner(R32_3)=NED   → NED wins 1-0
// R16_3: winner(R32_4)=BRA  vs winner(R32_6)=ECU   → BRA wins 3-1
// R16_4: winner(R32_7)=MEX  vs winner(R32_8)=ENG   → MEX wins 1-0
// R16_5: winner(R32_11)=COL vs winner(R32_12)=ESP  → ESP wins 2-1
// R16_6: winner(R32_10)=TUR vs winner(R32_9)=BEL   → BEL wins 2-1
// R16_7: winner(R32_13)=ARG vs winner(R32_16)=USA  → ARG wins 2-0
// R16_8: winner(R32_5)=CAN  vs winner(R32_15)=POR  → POR wins 2-1
// ============================================================
preds.push({ participantId: pid, matchId: 'R16_1', score1: 2, score2: 2, advancingTeamId: 'FRA' })  // FRA wins pens
preds.push({ participantId: pid, matchId: 'R16_2', score1: 0, score2: 1 })  // NED wins
preds.push({ participantId: pid, matchId: 'R16_3', score1: 3, score2: 1 })  // BRA wins
preds.push({ participantId: pid, matchId: 'R16_4', score1: 1, score2: 0 })  // MEX wins
preds.push({ participantId: pid, matchId: 'R16_5', score1: 1, score2: 2 })  // ESP wins
preds.push({ participantId: pid, matchId: 'R16_6', score1: 1, score2: 2 })  // BEL wins
preds.push({ participantId: pid, matchId: 'R16_7', score1: 2, score2: 0 })  // ARG wins
preds.push({ participantId: pid, matchId: 'R16_8', score1: 1, score2: 2 })  // POR wins

// ============================================================
// QUARTAS DE FINAL (QF)
// QF_1: winner(R16_1)=FRA vs winner(R16_2)=NED → FRA wins 2-1
// QF_2: winner(R16_3)=BRA vs winner(R16_4)=MEX → BRA wins 2-1
// QF_3: winner(R16_5)=ESP vs winner(R16_6)=BEL → ESP wins 1-0
// QF_4: winner(R16_7)=ARG vs winner(R16_8)=POR → ARG wins pens 1-1
// ============================================================
preds.push({ participantId: pid, matchId: 'QF_1', score1: 2, score2: 1 })  // FRA wins
preds.push({ participantId: pid, matchId: 'QF_2', score1: 2, score2: 1 })  // BRA wins
preds.push({ participantId: pid, matchId: 'QF_3', score1: 1, score2: 0 })  // ESP wins
preds.push({ participantId: pid, matchId: 'QF_4', score1: 1, score2: 1, advancingTeamId: 'ARG' })  // ARG wins pens

// ============================================================
// SEMIFINAIS (SF)
// SF_1: winner(QF_1)=FRA vs winner(QF_3)=ESP → FRA wins 1-0
// SF_2: winner(QF_2)=BRA vs winner(QF_4)=ARG → BRA wins 2-1
// ============================================================
preds.push({ participantId: pid, matchId: 'SF_1', score1: 1, score2: 0 })  // FRA wins
preds.push({ participantId: pid, matchId: 'SF_2', score1: 2, score2: 1 })  // BRA wins

// ============================================================
// DISPUTA 3.º LUGAR (TP_1)
// loser(SF_1)=ESP vs loser(SF_2)=ARG
// Scores not filled in the XLSX — skipping
// ============================================================
// (no TP_1 prediction — user left blank)

// ============================================================
// FINAL (F_1)
// winner(SF_1)=FRA vs winner(SF_2)=BRA → BRA wins 1-0
// ============================================================
preds.push({ participantId: pid, matchId: 'F_1', score1: 0, score2: 1 })  // BRA wins

// Append all predictions
db.matchPredictions = [...db.matchPredictions, ...preds]

writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf-8')
console.log(`✓ MANSONI adicionado com ${preds.length} palpites`)
