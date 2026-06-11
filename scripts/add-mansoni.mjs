import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../data/db.json')

const db = JSON.parse(readFileSync(dbPath, 'utf-8'))

// Remove entradas anteriores para evitar duplicatas
db.matchPredictions = db.matchPredictions.filter(p => p.participantId !== 'mansoni-001')

if (!db.participants.find(p => p.name === 'MANSONI')) {
  db.participants.push({
    id: 'mansoni-001',
    name: 'MANSONI',
    email: '',
    passwordHash: '',
    token: 'd9e2f4a17bc83051',
    createdAt: '2026-06-11T15:00:00.000Z'
  })
}

const predictions = [
  // Grupo A: MEX(t1) RSA(t2) KOR(t3) CZE(t4)
  // GA1=MEX×RSA  GA2=KOR×CZE  GA3=MEX×KOR  GA4=RSA×CZE  GA5=MEX×CZE  GA6=RSA×KOR
  { matchId: 'GA1', score1: 1, score2: 1 }, { matchId: 'GA2', score1: 1, score2: 2 },
  { matchId: 'GA3', score1: 1, score2: 0 }, { matchId: 'GA4', score1: 1, score2: 2 },
  { matchId: 'GA5', score1: 1, score2: 0 }, { matchId: 'GA6', score1: 1, score2: 1 },

  // Grupo B: CAN(t1) BIH(t2) QAT(t3) SUI(t4)
  // GB1=CAN×BIH  GB2=QAT×SUI  GB3=CAN×QAT  GB4=BIH×SUI  GB5=CAN×SUI  GB6=BIH×QAT
  { matchId: 'GB1', score1: 1, score2: 1 }, { matchId: 'GB2', score1: 0, score2: 1 },
  { matchId: 'GB3', score1: 1, score2: 0 }, { matchId: 'GB4', score1: 1, score2: 1 },
  { matchId: 'GB5', score1: 1, score2: 1 }, { matchId: 'GB6', score1: 1, score2: 1 },

  // Grupo C: BRA(t1) MAR(t2) HAI(t3) SCO(t4)
  // GC1=BRA×MAR  GC2=HAI×SCO  GC3=BRA×HAI  GC4=MAR×SCO  GC5=BRA×SCO  GC6=MAR×HAI
  { matchId: 'GC1', score1: 2, score2: 0 }, { matchId: 'GC2', score1: 0, score2: 2 },
  { matchId: 'GC3', score1: 5, score2: 0 }, { matchId: 'GC4', score1: 1, score2: 1 },
  { matchId: 'GC5', score1: 2, score2: 0 }, { matchId: 'GC6', score1: 3, score2: 0 },

  // Grupo D: USA(t1) PAR(t2) AUS(t3) TUR(t4)
  // GD1=USA×PAR  GD2=AUS×TUR  GD3=USA×AUS  GD4=PAR×TUR  GD5=USA×TUR  GD6=PAR×AUS
  { matchId: 'GD1', score1: 1, score2: 1 }, { matchId: 'GD2', score1: 0, score2: 2 },
  { matchId: 'GD3', score1: 1, score2: 0 }, { matchId: 'GD4', score1: 1, score2: 2 },
  { matchId: 'GD5', score1: 1, score2: 1 }, { matchId: 'GD6', score1: 1, score2: 0 },

  // Grupo E: GER(t1) CIV(t2) CUR(t3) ECU(t4)
  // GE1=GER×CIV  GE2=CUR×ECU  GE3=GER×CUR  GE4=CIV×ECU  GE5=GER×ECU  GE6=CIV×CUR
  { matchId: 'GE1', score1: 2, score2: 1 }, { matchId: 'GE2', score1: 1, score2: 3 },
  { matchId: 'GE3', score1: 5, score2: 0 }, { matchId: 'GE4', score1: 1, score2: 1 },
  { matchId: 'GE5', score1: 2, score2: 1 }, { matchId: 'GE6', score1: 2, score2: 0 },

  // Grupo F: NED(t1) JPN(t2) SWE(t3) TUN(t4)
  // GF1=NED×JPN  GF2=SWE×TUN  GF3=NED×SWE  GF4=JPN×TUN  GF5=NED×TUN  GF6=JPN×SWE
  { matchId: 'GF1', score1: 2, score2: 0 }, { matchId: 'GF2', score1: 1, score2: 1 },
  { matchId: 'GF3', score1: 2, score2: 1 }, { matchId: 'GF4', score1: 1, score2: 1 },
  { matchId: 'GF5', score1: 2, score2: 1 }, { matchId: 'GF6', score1: 2, score2: 1 },

  // Grupo G: BEL(t1) EGY(t2) IRN(t3) NZL(t4)
  // GG1=BEL×EGY  GG2=IRN×NZL  GG3=BEL×IRN  GG4=EGY×NZL  GG5=BEL×NZL  GG6=EGY×IRN
  { matchId: 'GG1', score1: 2, score2: 1 }, { matchId: 'GG2', score1: 1, score2: 0 },
  { matchId: 'GG3', score1: 3, score2: 0 }, { matchId: 'GG4', score1: 4, score2: 1 },
  { matchId: 'GG5', score1: 3, score2: 1 }, { matchId: 'GG6', score1: 2, score2: 1 },

  // Grupo H: ESP(t1) CPV(t2) KSA(t3) URU(t4)
  // GH1=ESP×CPV  GH2=KSA×URU  GH3=ESP×KSA  GH4=CPV×URU  GH5=ESP×URU  GH6=CPV×KSA
  { matchId: 'GH1', score1: 4, score2: 0 }, { matchId: 'GH2', score1: 1, score2: 2 },
  { matchId: 'GH3', score1: 2, score2: 0 }, { matchId: 'GH4', score1: 0, score2: 2 },
  { matchId: 'GH5', score1: 2, score2: 1 }, { matchId: 'GH6', score1: 0, score2: 2 },

  // Grupo I: FRA(t1) SEN(t2) IRQ(t3) NOR(t4)
  // GI1=FRA×SEN  GI2=IRQ×NOR  GI3=FRA×IRQ  GI4=SEN×NOR  GI5=FRA×NOR  GI6=SEN×IRQ
  { matchId: 'GI1', score1: 2, score2: 1 }, { matchId: 'GI2', score1: 0, score2: 3 },
  { matchId: 'GI3', score1: 4, score2: 1 }, { matchId: 'GI4', score1: 1, score2: 1 },
  { matchId: 'GI5', score1: 3, score2: 1 }, { matchId: 'GI6', score1: 1, score2: 0 },

  // Grupo J: ARG(t1) ALG(t2) AUT(t3) JOR(t4)
  // GJ1=ARG×ALG  GJ2=AUT×JOR  GJ3=ARG×AUT  GJ4=ALG×JOR  GJ5=ARG×JOR  GJ6=ALG×AUT
  { matchId: 'GJ1', score1: 2, score2: 0 }, { matchId: 'GJ2', score1: 1, score2: 0 },
  { matchId: 'GJ3', score1: 2, score2: 0 }, { matchId: 'GJ4', score1: 2, score2: 1 },
  { matchId: 'GJ5', score1: 3, score2: 0 }, { matchId: 'GJ6', score1: 1, score2: 1 },

  // Grupo K: POR(t1) COD(t2) UZB(t3) COL(t4)
  // GK1=POR×COD  GK2=UZB×COL  GK3=POR×UZB  GK4=COD×COL  GK5=POR×COL  GK6=COD×UZB
  { matchId: 'GK1', score1: 4, score2: 0 }, { matchId: 'GK2', score1: 0, score2: 2 },
  { matchId: 'GK3', score1: 3, score2: 0 }, { matchId: 'GK4', score1: 1, score2: 3 },
  { matchId: 'GK5', score1: 2, score2: 2 }, { matchId: 'GK6', score1: 1, score2: 1 },

  // Grupo L: ENG(t1) CRO(t2) GHA(t3) PAN(t4)
  // GL1=ENG×CRO  GL2=GHA×PAN  GL3=ENG×GHA  GL4=CRO×PAN  GL5=ENG×PAN  GL6=CRO×GHA
  { matchId: 'GL1', score1: 2, score2: 2 }, { matchId: 'GL2', score1: 3, score2: 1 },
  { matchId: 'GL3', score1: 2, score2: 1 }, { matchId: 'GL4', score1: 2, score2: 1 },
  { matchId: 'GL5', score1: 3, score2: 1 }, { matchId: 'GL6', score1: 1, score2: 1 },

  // 16 avos (R32) — mapeados pelo código de slot
  { matchId: 'R32_1',  score1: 2, score2: 2 }, // 2Ax2B
  { matchId: 'R32_2',  score1: 2, score2: 0 }, // 1Ex3ABCDF
  { matchId: 'R32_3',  score1: 3, score2: 1 }, // 1Fx2C
  { matchId: 'R32_4',  score1: 2, score2: 0 }, // 1Cx2F
  { matchId: 'R32_5',  score1: 1, score2: 0 }, // 1Bx3EFGIJ
  { matchId: 'R32_6',  score1: 1, score2: 1 }, // 2Ex2I
  { matchId: 'R32_7',  score1: 2, score2: 0 }, // 1Ax3CEFHI
  { matchId: 'R32_8',  score1: 2, score2: 0 }, // 1Lx3EHIJK
  { matchId: 'R32_9',  score1: 2, score2: 0 }, // 1Gx3AEHIJ
  { matchId: 'R32_10', score1: 0, score2: 0 }, // 1Dx3BEFIJ
  { matchId: 'R32_11', score1: 1, score2: 0 }, // 2Kx2L
  { matchId: 'R32_12', score1: 3, score2: 0 }, // 1Hx2J
  { matchId: 'R32_13', score1: 2, score2: 1 }, // 1Jx2H
  { matchId: 'R32_14', score1: 3, score2: 0 }, // 1Ix3CDFGH
  { matchId: 'R32_15', score1: 3, score2: 0 }, // 1Kx3DEIJL
  { matchId: 'R32_16', score1: 1, score2: 0 }, // 2Dx2G

  // Oitavas (R16)
  { matchId: 'R16_1', score1: 2, score2: 2 }, // 1E-3x1I-3
  { matchId: 'R16_2', score1: 0, score2: 1 }, // 2A2Bx1F2C
  { matchId: 'R16_3', score1: 3, score2: 1 }, // 1C2Fx2E2I
  { matchId: 'R16_4', score1: 1, score2: 0 }, // 1A-3x1L-3
  { matchId: 'R16_5', score1: 1, score2: 2 }, // 2K2Lx1H2J
  { matchId: 'R16_6', score1: 1, score2: 2 }, // 1D-3X1G-3
  { matchId: 'R16_7', score1: 2, score2: 0 }, // 1J2Hx2D2G
  { matchId: 'R16_8', score1: 1, score2: 2 }, // 1B-3X1K-3

  // Quartas e Semis
  { matchId: 'QF_1', score1: 2, score2: 1 },
  { matchId: 'QF_2', score1: 1, score2: 1 },
  { matchId: 'QF_3', score1: 2, score2: 0 },
  { matchId: 'QF_4', score1: 1, score2: 1 },
  { matchId: 'SF_1', score1: 1, score2: 0 },
  { matchId: 'SF_2', score1: 2, score2: 1 },

  // 3º Lugar e Final
  { matchId: 'TP_1', score1: 0, score2: 0 },
  { matchId: 'F_1',  score1: 0, score2: 1 },
]

for (const p of predictions) {
  db.matchPredictions.push({ participantId: 'mansoni-001', ...p })
}

writeFileSync(dbPath, JSON.stringify(db, null, 2))
console.log(`MANSONI adicionado com ${predictions.length} palpites (grupos + mata-mata completo).`)
