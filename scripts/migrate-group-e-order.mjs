// Migration: fix Group E match order
// Old teamIds ['GER','CIV','CUR','ECU'] → GE1=GER vs CIV, GE3=GER vs CUR (was played first)
// New teamIds ['GER','CUR','CIV','ECU'] → GE1=GER vs CUR, GE2=CIV vs ECU (played first)
// Must swap result matchIds GE3→GE1, GE4→GE2
// Must swap prediction matchIds GE1↔GE3, GE2↔GE4
// Must swap score1/score2 for GE6 predictions (CIV and CUR swap positions as team1/team2)

import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../data/db.json')

const db = JSON.parse(readFileSync(dbPath, 'utf8'))

// Fix results
const beforeResults = db.results.filter(r => r.matchId.startsWith('GE'))
db.results = db.results.map(r => {
  if (r.matchId === 'GE3') return { ...r, matchId: 'GE1' }
  if (r.matchId === 'GE4') return { ...r, matchId: 'GE2' }
  // GE1, GE2 had no results, so no need to handle those
  return r
})

// Fix predictions: swap GE1↔GE3 and GE2↔GE4, plus swap scores for GE6
db.matchPredictions = db.matchPredictions.map(p => {
  if (p.matchId === 'GE1') return { ...p, matchId: 'GE3' }
  if (p.matchId === 'GE2') return { ...p, matchId: 'GE4' }
  if (p.matchId === 'GE3') return { ...p, matchId: 'GE1' }
  if (p.matchId === 'GE4') return { ...p, matchId: 'GE2' }
  // GE6: team1 was CIV, now becomes CUR; swap scores so result outcome is preserved
  if (p.matchId === 'GE6') return { ...p, score1: p.score2, score2: p.score1 }
  return p
})

writeFileSync(dbPath, JSON.stringify(db, null, 2))

console.log('Results before:', beforeResults)
console.log('Results after:', db.results.filter(r => r.matchId.startsWith('GE')))
console.log('Done. Group E predictions remapped.')
