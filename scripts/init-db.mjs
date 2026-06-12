// Runs on every deploy (before `next start`).
// Merges the git-tracked seed db (participants + predictions) with the
// persistent-volume db (results + any admin-edited predictions) so that:
//   - New participants added to git appear in production after the next deploy.
//   - Results entered via the admin panel survive deploys.
//
// Only active when DATA_DIR env var is set (production).
// In development (no DATA_DIR), the app reads/writes data/db.json directly.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'

const dataDir = process.env.DATA_DIR
if (!dataDir) {
  // Dev mode: db.json lives in the git working tree, nothing to do.
  process.exit(0)
}

const seedPath = join(process.cwd(), 'data', 'db.json')
const volumePath = join(dataDir, 'db.json')

mkdirSync(dataDir, { recursive: true })

const seedDb = JSON.parse(readFileSync(seedPath, 'utf8'))

let volumeDb = { participants: [], matchPredictions: [], groupPredictions: [], results: [] }
if (existsSync(volumePath)) {
  try {
    volumeDb = JSON.parse(readFileSync(volumePath, 'utf8'))
  } catch {
    console.warn('Could not parse existing volume db, starting fresh.')
  }
}

const existingParticipantIds = new Set((volumeDb.participants || []).map(p => p.id))
const existingPredictionKeys = new Set(
  (volumeDb.matchPredictions || []).map(p => `${p.participantId}:${p.matchId}`)
)

const newParticipants = seedDb.participants.filter(p => !existingParticipantIds.has(p.id))
const newPredictions = seedDb.matchPredictions.filter(
  p => !existingPredictionKeys.has(`${p.participantId}:${p.matchId}`)
)

const merged = {
  participants: [...(volumeDb.participants || []), ...newParticipants],
  matchPredictions: [...(volumeDb.matchPredictions || []), ...newPredictions],
  groupPredictions: volumeDb.groupPredictions || [],
  results: volumeDb.results || [],
}

writeFileSync(volumePath, JSON.stringify(merged, null, 2))
console.log(
  `[init-db] ${merged.participants.length} participants (${newParticipants.length} new), ` +
  `${merged.results.length} results preserved.`
)
