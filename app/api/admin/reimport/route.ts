import { NextRequest, NextResponse } from 'next/server'
import { readDB, updateDB } from '@/lib/db'
import payload from '@/lib/reimportGeraljog.json'

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'admin123'

type Row = {
  participantId: string
  name: string
  predictions: { matchId: string; score1: number; score2: number; advancingTeamId?: string }[]
  groupPredictions: { groupId: string; order: string[] }[]
  r32TeamIds: string[]
  knockoutPhasePicks: { r16: string[]; qf: string[]; sf: string[]; finalists: string[]; champion: string | null }
}

// One-time reimport from the GERALJOG spreadsheet export (bundled payload).
// GET /api/admin/reimport?key=...         → dry-run (reports what would change)
// GET /api/admin/reimport?key=...&apply=1 → applies
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get('key')
  const apply = req.nextUrl.searchParams.get('apply') === '1'
  if (key !== ADMIN_KEY) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const rows = payload as Row[]
  const db = await readDB()
  const known = new Set(db.participants.map(p => p.id))

  let scoreChanges = 0, advBackfill = 0, advReplace = 0, groupChanges = 0, unknown = 0
  const samples: string[] = []
  for (const r of rows) {
    if (!known.has(r.participantId)) { unknown++; continue }
    const dbPreds = Object.fromEntries(
      db.matchPredictions.filter(x => x.participantId === r.participantId).map(x => [x.matchId, x])
    )
    for (const pr of r.predictions) {
      const d = dbPreds[pr.matchId]
      if (!d) continue
      if (d.score1 !== pr.score1 || d.score2 !== pr.score2) {
        scoreChanges++
        if (samples.length < 20) samples.push(`${r.name} ${pr.matchId}: ${d.score1}x${d.score2} → ${pr.score1}x${pr.score2}`)
      }
      const a = d.advancingTeamId ?? null, b = pr.advancingTeamId ?? null
      if (a !== b) {
        if (!a && b) advBackfill++
        else advReplace++
        if (samples.length < 20) samples.push(`${r.name} ${pr.matchId} (${pr.score1}x${pr.score2}): avança ${a ?? '—'} → ${b ?? '—'}`)
      }
    }
    const dbGroups = Object.fromEntries(
      (db.groupPredictions ?? []).filter(x => x.participantId === r.participantId).map(x => [x.groupId, x.order])
    )
    for (const g of r.groupPredictions) {
      if (JSON.stringify(dbGroups[g.groupId] ?? []) !== JSON.stringify(g.order)) groupChanges++
    }
  }

  if (apply) {
    await updateDB(d => {
      const byId = new Map(rows.filter(r => known.has(r.participantId)).map(r => [r.participantId, r]))
      const matchPredictions = [
        // Predictions of participants not in the payload stay untouched
        ...d.matchPredictions.filter(p => !byId.has(p.participantId)),
        ...[...byId.values()].flatMap(r =>
          r.predictions.map(pr => ({
            participantId: r.participantId,
            matchId: pr.matchId,
            score1: pr.score1,
            score2: pr.score2,
            ...(pr.advancingTeamId ? { advancingTeamId: pr.advancingTeamId } : {}),
          }))
        ),
      ]
      const groupPredictions = [
        ...(d.groupPredictions ?? []).filter(p => !byId.has(p.participantId)),
        ...[...byId.values()].flatMap(r =>
          r.groupPredictions.map(g => ({ participantId: r.participantId, groupId: g.groupId, order: g.order }))
        ),
      ]
      const r32TeamPicks = [
        ...(d.r32TeamPicks ?? []).filter(p => !byId.has(p.participantId)),
        ...[...byId.values()].map(r => ({ participantId: r.participantId, teamIds: r.r32TeamIds })),
      ]
      const knockoutPhasePicks = [
        ...(d.knockoutPhasePicks ?? []).filter(p => !byId.has(p.participantId)),
        ...[...byId.values()].map(r => ({
          participantId: r.participantId,
          r16: r.knockoutPhasePicks.r16,
          qf: r.knockoutPhasePicks.qf,
          sf: r.knockoutPhasePicks.sf,
          finalists: r.knockoutPhasePicks.finalists,
          champion: r.knockoutPhasePicks.champion ?? '',
        })),
      ]
      return { ...d, matchPredictions, groupPredictions, r32TeamPicks, knockoutPhasePicks }
    })
  }

  return NextResponse.json({
    mode: apply ? 'APLICADO' : 'dry-run (use &apply=1 para gravar)',
    participants: rows.length,
    unknownParticipants: unknown,
    scoreChanges,
    advancingBackfilled: advBackfill,
    advancingReplaced: advReplace,
    groupOrderChanges: groupChanges,
    samples,
  })
}
