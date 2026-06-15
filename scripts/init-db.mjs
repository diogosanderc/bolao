// Runs on every deploy (before `next start`).
// Merges the git-tracked seed db (participants + predictions) with the
// persistent-volume db (results + any admin-edited predictions) so that:
//   - New participants added to git appear in production after the next deploy.
//   - Results entered via the admin panel survive deploys.
//   - Seed matchPredictions always win (they come from the canonical TXT import).
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

// Participants: seed wins (preserves tokens for existing ones, adds new ones)
const volumeParticipantMap = Object.fromEntries((volumeDb.participants || []).map(p => [p.id, p]))
const mergedParticipants = seedDb.participants.map(p =>
  volumeParticipantMap[p.id]
    ? { ...p, token: volumeParticipantMap[p.id].token } // preserve custom tokens
    : p
)

// matchPredictions: seed always wins (canonical TXT import)
const mergedPredictions = seedDb.matchPredictions

// results: volume always wins (admin-entered game results must survive deploys)
const merged = {
  participants: mergedParticipants,
  matchPredictions: mergedPredictions,
  groupPredictions: seedDb.groupPredictions || [],
  results: volumeDb.results || [],
}

writeFileSync(volumePath, JSON.stringify(merged, null, 2))
console.log(
  `[init-db] ${merged.participants.length} participants, ` +
  `${merged.matchPredictions.length} predictions from seed, ` +
  `${merged.results.length} results preserved from volume.`
)
