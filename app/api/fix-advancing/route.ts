import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import { computeFullBracket } from '@/lib/bracket'
import { MatchPrediction } from '@/lib/types'

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'admin123'

// One-time migration: fill in advancingTeamId for knockout draw predictions.
// The TXT import never saved who advances on a draw; we reconstruct it from each
// participant's knockoutPhasePicks (r16/qf/sf/finalists/champion lists).
// GET /api/fix-advancing?key=...        → dry-run (reports what would change)
// GET /api/fix-advancing?key=...&apply=1 → applies the changes
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  const apply = req.nextUrl.searchParams.get('apply') === '1'
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const db = await readDB()

  // Which picks list decides a draw at each phase (winner belongs to the NEXT phase)
  const phaseOfMatch = (matchId: string): 'r32' | 'r16' | 'qf' | 'sf' | 'f' | 'tp' | null => {
    if (matchId.startsWith('R32_')) return 'r32'
    if (matchId.startsWith('R16_')) return 'r16'
    if (matchId.startsWith('QF_')) return 'qf'
    if (matchId.startsWith('SF_')) return 'sf'
    if (matchId === 'F_1') return 'f'
    if (matchId === 'TP_1') return 'tp'
    return null
  }

  const changes: { participantId: string; name: string; matchId: string; teams: string; advancingTeamId: string }[] = []
  const unresolved: { participantId: string; name: string; matchId: string; teams: string; reason: string }[] = []

  const fixedPreds: MatchPrediction[] = db.matchPredictions.map(p => ({ ...p }))
  const byParticipant = new Map<string, MatchPrediction[]>()
  for (const p of fixedPreds) {
    if (!byParticipant.has(p.participantId)) byParticipant.set(p.participantId, [])
    byParticipant.get(p.participantId)!.push(p)
  }

  for (const participant of db.participants) {
    const preds = byParticipant.get(participant.id) ?? []
    if (preds.length === 0) continue
    const kp = db.knockoutPhasePicks?.find(k => k.participantId === participant.id)

    const listFor = (phase: string): Set<string> | null => {
      if (!kp) return null
      if (phase === 'r32') return new Set(kp.r16 ?? [])
      if (phase === 'r16') return new Set(kp.qf ?? [])
      if (phase === 'qf') return new Set(kp.sf ?? [])
      if (phase === 'sf') return new Set(kp.finalists ?? [])
      if (phase === 'f') return kp.champion ? new Set([kp.champion]) : null
      return null // tp: no list to decide the 3rd-place winner
    }

    // Fill phase by phase so later rounds' teams resolve from earlier draws
    for (const phase of ['r32', 'r16', 'qf', 'sf', 'f'] as const) {
      const predMap = Object.fromEntries(preds.map(p => [p.matchId, p]))
      const bracket = computeFullBracket(predMap)
      for (const p of preds) {
        if (phaseOfMatch(p.matchId) !== phase) continue
        if (p.score1 !== p.score2) continue
        if (p.advancingTeamId) continue // never overwrite an existing pick
        const teams = bracket[p.matchId]
        const t1 = teams?.team1Id ?? 'TBD'
        const t2 = teams?.team2Id ?? 'TBD'
        const label = `${t1} x ${t2}`
        if (t1 === 'TBD' || t2 === 'TBD') {
          unresolved.push({ participantId: participant.id, name: participant.name, matchId: p.matchId, teams: label, reason: 'times não resolvidos' })
          continue
        }
        const list = listFor(phase)
        if (!list) {
          unresolved.push({ participantId: participant.id, name: participant.name, matchId: p.matchId, teams: label, reason: 'sem lista de picks' })
          continue
        }
        const in1 = list.has(t1)
        const in2 = list.has(t2)
        if (in1 === in2) {
          unresolved.push({ participantId: participant.id, name: participant.name, matchId: p.matchId, teams: label, reason: in1 ? 'ambos na lista' : 'nenhum na lista' })
          continue
        }
        p.advancingTeamId = in1 ? t1 : t2
        changes.push({ participantId: participant.id, name: participant.name, matchId: p.matchId, teams: label, advancingTeamId: p.advancingTeamId })
      }
    }

    // TP_1 draws: no picks list exists for the 3rd-place winner — report only
    for (const p of preds) {
      if (p.matchId === 'TP_1' && p.score1 === p.score2 && !p.advancingTeamId) {
        unresolved.push({ participantId: participant.id, name: participant.name, matchId: 'TP_1', teams: '-', reason: '3º lugar não tem lista de picks' })
      }
    }
  }

  if (apply && changes.length > 0) {
    await updateDB(d => ({ ...d, matchPredictions: fixedPreds }))
  }

  return NextResponse.json({
    mode: apply ? 'APLICADO' : 'dry-run (use &apply=1 para gravar)',
    fixed: changes.length,
    unresolvedCount: unresolved.length,
    changes,
    unresolved,
  })
}
