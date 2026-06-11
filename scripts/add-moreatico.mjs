import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../data/db.json')

const db = JSON.parse(readFileSync(dbPath, 'utf-8'))

// Remove palpites de mata-mata do MOREATICO se existirem
db.matchPredictions = db.matchPredictions.filter(p => {
  if (p.participantId !== 'moreatico-001') return true
  return p.matchId.startsWith('G') // mantém só fase de grupos
})

if (!db.participants.find(p => p.name === 'MOREATICO')) {
  db.participants.push({
    id: 'moreatico-001',
    name: 'MOREATICO',
    email: '',
    passwordHash: '',
    token: 'c7f3a291be04d18e',
    createdAt: '2026-06-11T14:00:00.000Z'
  })
}

// Remove palpites de grupos existentes para evitar duplicatas
db.matchPredictions = db.matchPredictions.filter(p => p.participantId !== 'moreatico-001')

const predictions = [
  { matchId: 'GA1', score1: 2, score2: 0 }, { matchId: 'GA2', score1: 0, score2: 1 },
  { matchId: 'GA3', score1: 1, score2: 0 }, { matchId: 'GA4', score1: 0, score2: 1 },
  { matchId: 'GA5', score1: 1, score2: 1 }, { matchId: 'GA6', score1: 0, score2: 1 },
  { matchId: 'GB1', score1: 1, score2: 1 }, { matchId: 'GB2', score1: 0, score2: 2 },
  { matchId: 'GB3', score1: 2, score2: 0 }, { matchId: 'GB4', score1: 0, score2: 1 },
  { matchId: 'GB5', score1: 0, score2: 1 }, { matchId: 'GB6', score1: 2, score2: 0 },
  { matchId: 'GC1', score1: 2, score2: 1 }, { matchId: 'GC2', score1: 0, score2: 2 },
  { matchId: 'GC3', score1: 4, score2: 0 }, { matchId: 'GC4', score1: 2, score2: 1 },
  { matchId: 'GC5', score1: 2, score2: 0 }, { matchId: 'GC6', score1: 3, score2: 0 },
  { matchId: 'GD1', score1: 1, score2: 0 }, { matchId: 'GD2', score1: 0, score2: 1 },
  { matchId: 'GD3', score1: 1, score2: 0 }, { matchId: 'GD4', score1: 1, score2: 0 },
  { matchId: 'GD5', score1: 1, score2: 1 }, { matchId: 'GD6', score1: 1, score2: 0 },
  { matchId: 'GE1', score1: 1, score2: 0 }, { matchId: 'GE2', score1: 0, score2: 3 },
  { matchId: 'GE3', score1: 4, score2: 0 }, { matchId: 'GE4', score1: 1, score2: 1 },
  { matchId: 'GE5', score1: 1, score2: 1 }, { matchId: 'GE6', score1: 3, score2: 0 },
  { matchId: 'GF1', score1: 1, score2: 0 }, { matchId: 'GF2', score1: 1, score2: 0 },
  { matchId: 'GF3', score1: 2, score2: 1 }, { matchId: 'GF4', score1: 1, score2: 0 },
  { matchId: 'GF5', score1: 1, score2: 0 }, { matchId: 'GF6', score1: 2, score2: 1 },
  { matchId: 'GG1', score1: 1, score2: 0 }, { matchId: 'GG2', score1: 2, score2: 0 },
  { matchId: 'GG3', score1: 1, score2: 0 }, { matchId: 'GG4', score1: 2, score2: 0 },
  { matchId: 'GG5', score1: 3, score2: 0 }, { matchId: 'GG6', score1: 2, score2: 1 },
  { matchId: 'GH1', score1: 4, score2: 0 }, { matchId: 'GH2', score1: 0, score2: 1 },
  { matchId: 'GH3', score1: 4, score2: 0 }, { matchId: 'GH4', score1: 1, score2: 2 },
  { matchId: 'GH5', score1: 2, score2: 0 }, { matchId: 'GH6', score1: 1, score2: 0 },
  { matchId: 'GI1', score1: 2, score2: 1 }, { matchId: 'GI2', score1: 0, score2: 2 },
  { matchId: 'GI3', score1: 2, score2: 0 }, { matchId: 'GI4', score1: 0, score2: 1 },
  { matchId: 'GI5', score1: 2, score2: 1 }, { matchId: 'GI6', score1: 1, score2: 0 },
  { matchId: 'GJ1', score1: 2, score2: 0 }, { matchId: 'GJ2', score1: 1, score2: 0 },
  { matchId: 'GJ3', score1: 2, score2: 1 }, { matchId: 'GJ4', score1: 1, score2: 0 },
  { matchId: 'GJ5', score1: 2, score2: 0 }, { matchId: 'GJ6', score1: 0, score2: 1 },
  { matchId: 'GK1', score1: 2, score2: 0 }, { matchId: 'GK2', score1: 0, score2: 2 },
  { matchId: 'GK3', score1: 2, score2: 0 }, { matchId: 'GK4', score1: 0, score2: 1 },
  { matchId: 'GK5', score1: 0, score2: 1 }, { matchId: 'GK6', score1: 1, score2: 0 },
  { matchId: 'GL1', score1: 1, score2: 1 }, { matchId: 'GL2', score1: 1, score2: 0 },
  { matchId: 'GL3', score1: 1, score2: 0 }, { matchId: 'GL4', score1: 2, score2: 0 },
  { matchId: 'GL5', score1: 1, score2: 0 }, { matchId: 'GL6', score1: 2, score2: 0 },
]

for (const p of predictions) {
  db.matchPredictions.push({ participantId: 'moreatico-001', ...p })
}

writeFileSync(dbPath, JSON.stringify(db, null, 2))
console.log(`MOREATICO atualizado com ${predictions.length} palpites (somente fase de grupos).`)
