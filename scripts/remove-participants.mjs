import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../data/db.json')

const db = JSON.parse(readFileSync(dbPath, 'utf-8'))

const toRemove = ['MANSONI', 'MOREATICO']

const ids = db.participants
  .filter(p => toRemove.includes(p.name))
  .map(p => p.id)

db.participants = db.participants.filter(p => !toRemove.includes(p.name))
db.matchPredictions = db.matchPredictions.filter(p => !ids.includes(p.participantId))

writeFileSync(dbPath, JSON.stringify(db, null, 2))
console.log(`Removidos: ${toRemove.join(', ')}`)
