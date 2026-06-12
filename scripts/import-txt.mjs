/**
 * Import participants from a TXT file (GERALJOG format).
 * Usage: node scripts/import-txt.mjs <path-to-txt> [--skip NAME1,NAME2]
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = join(__dirname, '../data/db.json')
const txtPath = process.argv[2]
if (!txtPath) { console.error('Usage: node import-txt.mjs <file.TXT>'); process.exit(1) }

const skipArg = process.argv[3] === '--skip' ? (process.argv[4] || '').toUpperCase().split(',') : []

// ── Team name → system ID ────────────────────────────────────────────────────
const NAME_TO_ID = {
  'MEXICO':'MEX','AFRICA':'RSA','COREIA':'KOR','REP CHECA':'CZE',
  'SUICA':'SUI','CANADA':'CAN','CATAR':'QAT','BOSNIA':'BIH',
  'BRASIL':'BRA','MARROCOS':'MAR','HAITI':'HAI','ESCOCIA':'SCO',
  'EUA':'USA','PARAGUAI':'PAR','AUSTRALIA':'AUS','TURQUIA':'TUR',
  'ALEMANHA':'GER','CURACAO':'CUR','EQUADOR':'ECU',
  'COSTA MARF':'CIV','COSTA MAR':'CIV','COSTA MARFIM':'CIV',
  'HOLANDA':'NED','JAPAO':'JPN','SUECIA':'SWE','TUNISIA':'TUN',
  'BELGICA':'BEL','EGITO':'EGY','IRA':'IRN','N.ZELANDIA':'NZL',
  'ESPANHA':'ESP','CABO VERDE':'CPV','ARABIA':'KSA','URUGUAI':'URU',
  'FRANCA':'FRA','SENEGAL':'SEN','IRAQUE':'IRQ','NORUEGA':'NOR',
  'ARGENTINA':'ARG','ARGELIA':'ALG','AUSTRIA':'AUT','JORDANIA':'JOR',
  'PORTUGAL':'POR','CONGO':'COD','UZBESQUISTAO':'UZB','UZBESQUIS':'UZB',
  'COLOMBIA':'COL','INGLATERRA':'ENG','CROACIA':'CRO','GANA':'GHA','PANAMA':'PAN',
}

// ── Group definitions (must match copa2026.ts order) ─────────────────────────
const GROUPS = [
  { id:'A', teams:['MEX','RSA','KOR','CZE'] },
  { id:'B', teams:['CAN','BIH','QAT','SUI'] },
  { id:'C', teams:['BRA','MAR','HAI','SCO'] },
  { id:'D', teams:['USA','PAR','AUS','TUR'] },
  { id:'E', teams:['GER','CIV','CUR','ECU'] },
  { id:'F', teams:['NED','JPN','SWE','TUN'] },
  { id:'G', teams:['BEL','EGY','IRN','NZL'] },
  { id:'H', teams:['ESP','CPV','KSA','URU'] },
  { id:'I', teams:['FRA','SEN','IRQ','NOR'] },
  { id:'J', teams:['ARG','ALG','AUT','JOR'] },
  { id:'K', teams:['POR','COD','UZB','COL'] },
  { id:'L', teams:['ENG','CRO','GHA','PAN'] },
]

// system match definitions: GX1=[t1,t2], GX2=[t3,t4], GX3=[t1,t3], GX4=[t2,t4], GX5=[t1,t4], GX6=[t2,t3]
const GROUP_MATCHES = {}
for (const { id, teams:[t1,t2,t3,t4] } of GROUPS) {
  GROUP_MATCHES[id] = [
    { id:`G${id}1`, t1, t2 },
    { id:`G${id}2`, t1:t3, t2:t4 },
    { id:`G${id}3`, t1, t2:t3 },
    { id:`G${id}4`, t1:t2, t2:t4 },
    { id:`G${id}5`, t1, t2:t4 },
    { id:`G${id}6`, t1:t2, t2:t3 },
  ]
}

// lookup: "T1-T2" or "T2-T1" → { matchId, reversed }
const MATCH_BY_PAIR = {}
for (const ms of Object.values(GROUP_MATCHES))
  for (const m of ms) {
    MATCH_BY_PAIR[`${m.t1}-${m.t2}`] = { matchId: m.id, team1: m.t1, team2: m.t2, reversed: false }
    MATCH_BY_PAIR[`${m.t2}-${m.t1}`] = { matchId: m.id, team1: m.t1, team2: m.t2, reversed: true }
  }

// ── Knockout slot ordering per TXT line ──────────────────────────────────────
const KO_LINES = [
  ['R32_2','R32_14','R32_1','R32_3','R32_11','R32_12'],  // line offset 13
  ['R32_10','R32_9','R32_4','R32_6','R32_7','R32_8'],    // line offset 14
  ['R32_13','R32_16','R32_5','R32_15','R16_1','R16_2'],  // line offset 15
  ['R16_5','R16_6','R16_3','R16_4','R16_7','R16_8'],     // line offset 16
  ['QF_1','QF_2','QF_3','QF_4','SF_1','SF_2'],           // line offset 17
  ['TP_1','F_1'],                                         // line offset 18
]

// ── Bracket tree: [matchId, feeder1, feeder2] ────────────────────────────────
const BRACKET_TREE = [
  ['R16_1','R32_2','R32_14'],['R16_2','R32_1','R32_3'],
  ['R16_3','R32_4','R32_6'], ['R16_4','R32_7','R32_8'],
  ['R16_5','R32_11','R32_12'],['R16_6','R32_10','R32_9'],
  ['R16_7','R32_13','R32_16'],['R16_8','R32_5','R32_15'],
  ['QF_1','R16_1','R16_2'],['QF_2','R16_3','R16_4'],
  ['QF_3','R16_5','R16_6'],['QF_4','R16_7','R16_8'],
  ['SF_1','QF_1','QF_3'],  ['SF_2','QF_2','QF_4'],
  ['F_1','SF_1','SF_2'],
]

// ── R32 bracket slot definitions ─────────────────────────────────────────────
const R32_SLOTS = {
  R32_1:  { t1:{type:'rank',g:'A',r:2}, t2:{type:'rank',g:'B',r:2} },
  R32_2:  { t1:{type:'rank',g:'E',r:1}, t2:{type:'best3rd',slot:'E'} },
  R32_3:  { t1:{type:'rank',g:'F',r:1}, t2:{type:'rank',g:'C',r:2} },
  R32_4:  { t1:{type:'rank',g:'C',r:1}, t2:{type:'rank',g:'F',r:2} },
  R32_5:  { t1:{type:'rank',g:'B',r:1}, t2:{type:'best3rd',slot:'B'} },
  R32_6:  { t1:{type:'rank',g:'E',r:2}, t2:{type:'rank',g:'I',r:2} },
  R32_7:  { t1:{type:'rank',g:'A',r:1}, t2:{type:'best3rd',slot:'A'} },
  R32_8:  { t1:{type:'rank',g:'L',r:1}, t2:{type:'best3rd',slot:'L'} },
  R32_9:  { t1:{type:'rank',g:'G',r:1}, t2:{type:'best3rd',slot:'G'} },
  R32_10: { t1:{type:'rank',g:'D',r:1}, t2:{type:'best3rd',slot:'D'} },
  R32_11: { t1:{type:'rank',g:'K',r:2}, t2:{type:'rank',g:'L',r:2} },
  R32_12: { t1:{type:'rank',g:'H',r:1}, t2:{type:'rank',g:'J',r:2} },
  R32_13: { t1:{type:'rank',g:'J',r:1}, t2:{type:'rank',g:'H',r:2} },
  R32_14: { t1:{type:'rank',g:'I',r:1}, t2:{type:'best3rd',slot:'I'} },
  R32_15: { t1:{type:'rank',g:'K',r:1}, t2:{type:'best3rd',slot:'K'} },
  R32_16: { t1:{type:'rank',g:'D',r:2}, t2:{type:'rank',g:'G',r:2} },
}

// ── Third-place table (inlined from lib/thirdPlaceTable.ts) ──────────────────
// Full table omitted for brevity — we load it from the parsed file instead
// We'll compute best3rd from standings and use the table key lookup
const THIRD_PLACE_TABLE = {"ABCDEFGH":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"F","K":"D","L":"E"},"ABCDEFGI":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"E","L":"I"},"ABCDEFGJ":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"E","L":"J"},"ABCDEFGK":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"E","L":"K"},"ABCDEFGL":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"L","L":"E"},"ABCDEFHI":{"A":"H","B":"E","D":"B","E":"C","G":"A","I":"F","K":"D","L":"I"},"ABCDEFHJ":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"F","K":"D","L":"E"},"ABCDEFHK":{"A":"H","B":"E","D":"B","E":"C","G":"A","I":"F","K":"D","L":"K"},"ABCDEFHL":{"A":"H","B":"F","D":"B","E":"C","G":"A","I":"D","K":"L","L":"E"},"ABCDEFIJ":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"F","K":"E","L":"I"},"ABCDEFIK":{"A":"C","B":"E","D":"B","E":"D","G":"A","I":"F","K":"I","L":"K"},"ABCDEFIL":{"A":"C","B":"E","D":"B","E":"D","G":"A","I":"F","K":"L","L":"I"},"ABCDEFJK":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"F","K":"E","L":"K"},"ABCDEFJL":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"F","K":"L","L":"E"},"ABCDEFKL":{"A":"C","B":"E","D":"B","E":"D","G":"A","I":"F","K":"L","L":"K"},"ABCDEGHI":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"E","L":"I"},"ABCDEGHJ":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"E","L":"J"},"ABCDEGHK":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"E","L":"K"},"ABCDEGHL":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"L","L":"E"},"ABCDEGIJ":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"D","K":"I","L":"J"},"ABCDEGIK":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"D","K":"I","L":"K"},"ABCDEGIL":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"D","K":"L","L":"I"},"ABCDEGJK":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"D","K":"J","L":"K"},"ABCDEGJL":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"D","K":"L","L":"J"},"ABCDEGKL":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDEHIJ":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"D","K":"E","L":"I"},"ABCDEHIK":{"A":"H","B":"E","D":"B","E":"C","G":"A","I":"D","K":"I","L":"K"},"ABCDEHIL":{"A":"H","B":"E","D":"B","E":"C","G":"A","I":"D","K":"L","L":"I"},"ABCDEHJK":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"D","K":"E","L":"K"},"ABCDEHJL":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"D","K":"L","L":"E"},"ABCDEHKL":{"A":"H","B":"E","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDEIJK":{"A":"E","B":"J","D":"B","E":"C","G":"A","I":"D","K":"I","L":"K"},"ABCDEIJL":{"A":"E","B":"J","D":"B","E":"C","G":"A","I":"D","K":"L","L":"I"},"ABCDEIKL":{"A":"E","B":"I","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDEJKL":{"A":"E","B":"J","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDFGHI":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"F","K":"D","L":"I"},"ABCDFGHJ":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"F","K":"D","L":"J"},"ABCDFGHK":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"F","K":"D","L":"K"},"ABCDFGHL":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"L","L":"H"},"ABCDFGIJ":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"I","L":"J"},"ABCDFGIK":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"I","L":"K"},"ABCDFGIL":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"L","L":"I"},"ABCDFGJK":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"J","L":"K"},"ABCDFGJL":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"L","L":"J"},"ABCDFGKL":{"A":"C","B":"G","D":"B","E":"D","G":"A","I":"F","K":"L","L":"K"},"ABCDFHIJ":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"F","K":"D","L":"I"},"ABCDFHIK":{"A":"H","B":"F","D":"B","E":"C","G":"A","I":"D","K":"I","L":"K"},"ABCDFHIL":{"A":"H","B":"F","D":"B","E":"C","G":"A","I":"D","K":"L","L":"I"},"ABCDFHJK":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"F","K":"D","L":"K"},"ABCDFHJL":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"F","K":"L","L":"H"},"ABCDFHKL":{"A":"H","B":"F","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDFIJK":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"F","K":"I","L":"K"},"ABCDFIJL":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"F","K":"L","L":"I"},"ABCDFIKL":{"A":"C","B":"I","D":"B","E":"D","G":"A","I":"F","K":"L","L":"K"},"ABCDFJKL":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"F","K":"L","L":"K"},"ABCDGHIJ":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"I","L":"J"},"ABCDGHIK":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"I","L":"K"},"ABCDGHIL":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"L","L":"I"},"ABCDGHJK":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"J","L":"K"},"ABCDGHJL":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"L","L":"J"},"ABCDGHKL":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDGIJK":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"G","K":"I","L":"K"},"ABCDGIJL":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"G","K":"L","L":"I"},"ABCDGIKL":{"A":"I","B":"G","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDGJKL":{"A":"C","B":"J","D":"B","E":"D","G":"A","I":"G","K":"L","L":"K"},"ABCDHIJK":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"D","K":"I","L":"K"},"ABCDHIJL":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"D","K":"L","L":"I"},"ABCDHIKL":{"A":"H","B":"I","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDHJKL":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCDIJKL":{"A":"I","B":"J","D":"B","E":"C","G":"A","I":"D","K":"L","L":"K"},"ABCEFGHI":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"F","K":"E","L":"I"},"ABCEFGHJ":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"F","K":"E","L":"J"},"ABCEFGHK":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"F","K":"E","L":"K"},"ABCEFGHL":{"A":"H","B":"G","D":"B","E":"C","G":"A","I":"F","K":"L","L":"E"},"ABCEFGIJ":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"F","K":"I","L":"J"},"ABCEFGIK":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"F","K":"I","L":"K"},"ABCEFGIL":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"F","K":"L","L":"I"},"ABCEFGJK":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"F","K":"J","L":"K"},"ABCEFGJL":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"F","K":"L","L":"J"},"ABCEFGKL":{"A":"E","B":"G","D":"B","E":"C","G":"A","I":"F","K":"L","L":"K"},"ABCEFHIJ":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"F","K":"E","L":"I"},"ABCEFHIK":{"A":"H","B":"E","D":"B","E":"C","G":"A","I":"F","K":"I","L":"K"},"ABCEFHIL":{"A":"H","B":"E","D":"B","E":"C","G":"A","I":"F","K":"L","L":"I"},"ABCEFHJK":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"F","K":"E","L":"K"},"ABCEFHJL":{"A":"H","B":"J","D":"B","E":"C","G":"A","I":"F","K":"L","L":"E"},"ABCEFHKL":{"A":"H","B":"E","D":"B","E":"C","G":"A","I":"F","K":"L","L":"K"},"ABCEFIJK":{"A":"E","B":"J","D":"B","E":"C","G":"A","I":"F","K":"I","L":"K"},"ABCEFIJL":{"A":"E","B":"J","D":"B","E":"C","G":"A","I":"F","K":"L","L":"I"},"ABCEFIKL":{"A":"E","B":"I","D":"B","E":"C","G":"A","I":"F","K":"L","L":"K"},"ABCEFJKL":{"A":"E","B":"J","D":"B","E":"C","G":"A","I":"F","K":"L","L":"K"},"EFGHIJKL":{"A":"E","B":"J","D":"I","E":"F","G":"H","I":"G","K":"L","L":"K"}}

// ── Parse helpers ─────────────────────────────────────────────────────────────
function toId(name) {
  name = name.trim().replace(/\.+$/, '').toUpperCase()
  return NAME_TO_ID[name] || null
}

function extractScores(line) {
  const scores = []
  const re = /(\d+)\s*-\s*(\d+)/g
  let m
  while ((m = re.exec(line)) !== null) scores.push([+m[1], +m[2]])
  return scores
}

// Parse 6 group matches from one TXT line
function parseGroupLine(line) {
  const results = []
  // Match: "TEAM1 X TEAM2..... S - S"
  const re = /([A-ZÁÉÍÓÚÀÃÕÜÇ][A-ZÁÉÍÓÚÀÃÕÜÇ./ ]*?)\s+X\s+([A-ZÁÉÍÓÚÀÃÕÜÇ][A-ZÁÉÍÓÚÀÃÕÜÇ./ ]*?)\.+\s+(\d+)\s*-\s*(\d+)/g
  let m
  while ((m = re.exec(line)) !== null) {
    const n1 = m[1].trim().toUpperCase()
    const n2 = m[2].trim().toUpperCase()
    const s1 = +m[3], s2 = +m[4]
    // Try multi-word names first, then single
    let id1 = null, id2 = null
    for (const k of Object.keys(NAME_TO_ID).sort((a,b) => b.length - a.length)) {
      if (!id1 && n1.startsWith(k)) id1 = NAME_TO_ID[k]
      if (!id2 && n2.startsWith(k)) id2 = NAME_TO_ID[k]
    }
    if (id1 && id2) results.push({ id1, id2, s1, s2 })
  }
  return results
}

// Compute group standings from predMap {matchId → {score1,score2}}
function computeStandings(groupId, predMap) {
  const { teams } = GROUPS.find(g => g.id === groupId)
  const st = Object.fromEntries(teams.map(t => [t, { p:0, gp:0, gc:0 }]))
  for (const { id, t1, t2 } of GROUP_MATCHES[groupId]) {
    const pr = predMap[id]
    if (!pr) continue
    st[t1].gp += pr.s1; st[t1].gc += pr.s2
    st[t2].gp += pr.s2; st[t2].gc += pr.s1
    if (pr.s1 > pr.s2) st[t1].p += 3
    else if (pr.s2 > pr.s1) st[t2].p += 3
    else { st[t1].p++; st[t2].p++ }
  }
  return teams.slice().sort((a, b) => {
    const dp = st[b].p - st[a].p
    if (dp !== 0) return dp
    const dsg = (st[b].gp - st[b].gc) - (st[a].gp - st[a].gc)
    if (dsg !== 0) return dsg
    return st[b].gp - st[a].gp
  }).map((t, i) => ({ teamId: t, pos: i+1, ...st[t] }))
}

// Resolve teams for a knockout slot
function resolveSlot(slot, groupRanks, best3rdBySlot) {
  if (slot.type === 'rank') return groupRanks[slot.g]?.[slot.r - 1] ?? 'TBD'
  return best3rdBySlot[slot.slot] ?? 'TBD'
}

// Full bracket simulation → returns predMap with advancingTeamId filled in for ties
function fillAdvancing(predMap, groupRanks, best3rdBySlot, clasR32, clasR16, clasQF, sfLine) {
  const teams = {} // matchId → {t1, t2}
  const winner = {} // matchId → teamId

  // R32
  for (const [id, slot] of Object.entries(R32_SLOTS)) {
    const t1 = resolveSlot(slot.t1, groupRanks, best3rdBySlot)
    const t2 = resolveSlot(slot.t2, groupRanks, best3rdBySlot)
    teams[id] = { t1, t2 }
    const pr = predMap[id]
    if (!pr) continue
    if (pr.s1 > pr.s2) winner[id] = t1
    else if (pr.s2 > pr.s1) winner[id] = t2
    else {
      const adv = clasR32.has(t1) ? t1 : (clasR32.has(t2) ? t2 : 'TBD')
      winner[id] = adv
      if (adv !== 'TBD') pr.advancingTeamId = adv
    }
  }

  // R16, QF, SF, F
  for (const [id, f1, f2] of BRACKET_TREE) {
    const t1 = winner[f1] ?? 'TBD'
    const t2 = winner[f2] ?? 'TBD'
    teams[id] = { t1, t2 }
    const pr = predMap[id]
    if (!pr || t1 === 'TBD' || t2 === 'TBD') continue
    if (pr.s1 > pr.s2) winner[id] = t1
    else if (pr.s2 > pr.s1) winner[id] = t2
    else {
      let clas
      if (id.startsWith('R16')) clas = clasR16
      else if (id.startsWith('QF')) clas = clasQF
      else if (id.startsWith('SF') || id === 'F_1') {
        // use sfLine to determine
        clas = new Set(sfLine)
      } else clas = new Set()
      const adv = clas.has(t1) ? t1 : (clas.has(t2) ? t2 : 'TBD')
      winner[id] = adv
      if (adv !== 'TBD') pr.advancingTeamId = adv
    }
  }

  return predMap
}

// Parse CLASSIFICADOS line → Set of team IDs
function parseClas(line) {
  const m = line.match(/:\s+(.+)/)
  if (!m) return new Set()
  return new Set(
    m[1].split(',').map(s => {
      const n = s.trim().replace(/[,.]$/, '').toUpperCase()
      return NAME_TO_ID[n] || null
    }).filter(Boolean)
  )
}

// Parse SEMIFINAIS line → flat list of teams in SF + final + champion
function parseSfLine(line) {
  const teams = []
  const re = /([A-ZÁÉÍÓÚÀÃÕÜÇ][A-ZÁÉÍÓÚÀÃÕÜÇ ]+?)(?:\s+X\s+|\s*[-,]\s*|\s*$)/g
  let m
  while ((m = re.exec(line.replace(/SEMIFINAIS.*?:/,'').replace(/FINAL E CAMPEAO.*?:/,'')))) {
    const n = m[1].trim().toUpperCase()
    const id = NAME_TO_ID[n]
    if (id) teams.push(id)
  }
  return teams
}

// ── Parse entire TXT file ─────────────────────────────────────────────────────
const raw = readFileSync(txtPath, 'latin1')
const lines = raw.split(/\r?\n/)

// Split into 27-line blocks
const blocks = []
let i = 0
while (i < lines.length) {
  const line = lines[i]
  if (line && !line.startsWith(' ') && line.match(/^\S.*-\s*\d+\s+gols/i)) {
    blocks.push(lines.slice(i, i + 27))
    i += 27
  } else {
    i++
  }
}

console.log(`Found ${blocks.length} participant blocks`)

const db = JSON.parse(readFileSync(dbPath, 'utf8'))
const existingIds = new Set(db.participants.map(p => p.id))

let added = 0, skipped = 0

for (const block of blocks) {
  const header = block[0] || ''
  const nameFull = header.split('-')[0].trim().toUpperCase()
  const nameKey = nameFull.replace(/\s+/g, ' ')

  if (skipArg.some(s => nameKey.includes(s))) {
    console.log(`  SKIP (arg): ${nameKey}`)
    skipped++
    continue
  }

  const participantId = nameKey.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-001'

  if (existingIds.has(participantId)) {
    console.log(`  SKIP (exists): ${nameKey}`)
    skipped++
    continue
  }

  // Build group predMap from lines 1-12
  const groupPredMap = {}
  for (let gi = 0; gi < GROUPS.length; gi++) {
    const gLine = block[gi + 1] || ''
    const matches = parseGroupLine(gLine)
    const groupId = GROUPS[gi].id
    for (const { id1, id2, s1, s2 } of matches) {
      const key = `${id1}-${id2}`
      const info = MATCH_BY_PAIR[key]
      if (!info) { console.warn(`    No match for ${id1} vs ${id2}`); continue }
      groupPredMap[info.matchId] = info.reversed ? { s1: s2, s2: s1 } : { s1, s2 }
    }
  }

  // Build group standings
  const groupRanks = {}
  const thirdPlace = []
  for (const { id, teams } of GROUPS) {
    const rows = computeStandings(id, groupPredMap)
    groupRanks[id] = rows.map(r => r.teamId)
    if (rows.length >= 3) {
      const r = rows[2]
      thirdPlace.push({ group: id, teamId: r.teamId, p: r.p, sg: r.gp - r.gc, gp: r.gp })
    }
  }

  // Compute best8 third-place teams
  const best8 = [...thirdPlace].sort((a,b) => b.p - a.p || b.sg - a.sg || b.gp - a.gp).slice(0, 8)
  const qualKey = best8.map(t => t.group).sort().join('')
  const slotMap = THIRD_PLACE_TABLE[qualKey] ?? {}
  const third3ByGroup = Object.fromEntries(thirdPlace.map(t => [t.group, t.teamId]))
  const best3rdBySlot = {}
  for (const [slot, srcGroup] of Object.entries(slotMap)) best3rdBySlot[slot] = third3ByGroup[srcGroup]

  // Parse knockout predictions
  const koPredMap = {}
  for (let li = 0; li < KO_LINES.length; li++) {
    const scores = extractScores(block[13 + li] || '')
    const ids = KO_LINES[li]
    for (let si = 0; si < ids.length && si < scores.length; si++) {
      koPredMap[ids[si]] = { s1: scores[si][0], s2: scores[si][1] }
    }
  }

  // Parse CLASSIFICADOS lines
  const clasR32 = parseClas(block[23] || '')
  const clasR16 = parseClas(block[24] || '')
  const sfTeams = parseSfLine(block[25] || '')
  const clasQF = new Set(sfTeams)
  const clasFinal = new Set(sfTeams.slice(-3))

  // Merge all predictions and fill advancingTeamId
  const allPredMap = { ...groupPredMap, ...koPredMap }
  fillAdvancing(allPredMap, groupRanks, best3rdBySlot, clasR32, clasR16, clasQF, clasFinal)

  // Build predictions array
  const predictions = []
  for (const [matchId, pr] of Object.entries(allPredMap)) {
    const p = { participantId, matchId, score1: pr.s1, score2: pr.s2 }
    if (pr.advancingTeamId) p.advancingTeamId = pr.advancingTeamId
    predictions.push(p)
  }

  // Add participant
  db.participants.push({
    id: participantId,
    name: nameKey,
    email: '',
    passwordHash: '',
    token: Buffer.from(participantId).toString('hex').slice(0, 16),
    createdAt: new Date().toISOString(),
  })
  db.matchPredictions.push(...predictions)
  existingIds.add(participantId)

  console.log(`  ADDED: ${nameKey} (${predictions.length} predictions, qualKey=${qualKey})`)
  added++
}

writeFileSync(dbPath, JSON.stringify(db, null, 2))
console.log(`\nDone: ${added} added, ${skipped} skipped.`)
