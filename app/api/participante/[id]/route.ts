import { NextRequest, NextResponse } from 'next/server'
import { readDB } from '@/lib/db'
import { matchById, teamById, ALL_MATCHES, GROUP_MATCHES, GROUPS } from '@/lib/copa2026'
import { scoreMatch } from '@/lib/scoring'

function deriveGroupStandings(predMap: Record<string, { score1: number; score2: number }>) {
  const standings: Record<string, string[]> = {}
  for (const group of GROUPS) {
    const pts: Record<string, number> = {}
    const gd: Record<string, number> = {}
    const gf: Record<string, number> = {}
    for (const id of group.teamIds) { pts[id] = 0; gd[id] = 0; gf[id] = 0 }
    let hasAny = false
    for (const m of GROUP_MATCHES.filter(mm => mm.groupId === group.id)) {
      const pred = predMap[m.id]
      if (!pred) continue
      hasAny = true
      gf[m.team1Id] += pred.score1; gf[m.team2Id] += pred.score2
      gd[m.team1Id] += pred.score1 - pred.score2; gd[m.team2Id] += pred.score2 - pred.score1
      if (pred.score1 > pred.score2) pts[m.team1Id] += 3
      else if (pred.score2 > pred.score1) pts[m.team2Id] += 3
      else { pts[m.team1Id] += 1; pts[m.team2Id] += 1 }
    }
    if (!hasAny) continue
    standings[group.id] = [...group.teamIds].sort((a, b) =>
      pts[b] !== pts[a] ? pts[b] - pts[a] : gd[b] !== gd[a] ? gd[b] - gd[a] : gf[b] - gf[a]
    )
  }
  return standings
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  try {
    const db = await readDB()
    const participant = db.participants.find(p => p.id === id)
    if (!participant) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const matchDates = db.matchDates ?? {}
    const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    const myPreds = Object.fromEntries(
      db.matchPredictions.filter(p => p.participantId === id).map(p => [p.matchId, p])
    )

    const sortedMatches = [...ALL_MATCHES].sort((a, b) => {
      const dateA = matchDates[a.id]?.date ?? ''
      const dateB = matchDates[b.id]?.date ?? ''
      return dateA.localeCompare(dateB) || a.matchNumber - b.matchNumber
    })

    const predictions = sortedMatches
      .filter(m => myPreds[m.id] || resultMap[m.id])
      .map(m => {
        const pred = myPreds[m.id]
        const result = resultMap[m.id]
        const match = matchById[m.id]!
        let points: number | undefined
        let correctResult: boolean | undefined
        let correctScore: boolean | undefined

        if (pred && result && match) {
          const sc = scoreMatch(pred, result, match)
          points = sc.total
          correctResult = sc.correctResult
          correctScore = sc.correctScore
        }

        return {
          matchId: m.id,
          matchNumber: m.matchNumber,
          phase: m.phase,
          groupId: m.groupId,
          team1: { id: m.team1Id, name: teamById[m.team1Id]?.name ?? m.team1Id, flag: teamById[m.team1Id]?.flag ?? '🏳' },
          team2: { id: m.team2Id, name: teamById[m.team2Id]?.name ?? m.team2Id, flag: teamById[m.team2Id]?.flag ?? '🏳' },
          date: matchDates[m.id]?.date ?? null,
          dateBRT: matchDates[m.id]?.dateBRT ?? null,
          prediction: pred ? { score1: pred.score1, score2: pred.score2 } : null,
          result: result ? { score1: result.score1, score2: result.score2 } : null,
          points,
          correctResult,
          correctScore,
        }
      })

    const played = predictions.filter(p => p.result !== null)
    const matchPoints = played.reduce((sum, p) => sum + (p.points ?? 0), 0)
    const correctResults = played.filter(p => p.correctResult).length
    const correctScores = played.filter(p => p.correctScore).length

    // --- Group standings from actual results ---
    const groupStandings: Record<string, string[]> = {}
    for (const group of GROUPS) {
      const pts: Record<string, number> = {}
      const gd: Record<string, number> = {}
      const gf: Record<string, number> = {}
      for (const id of group.teamIds) { pts[id] = 0; gd[id] = 0; gf[id] = 0 }
      const groupMatchList = GROUP_MATCHES.filter(m => m.groupId === group.id)
      let allPlayed = true
      for (const m of groupMatchList) {
        const res = resultMap[m.id]
        if (!res) { allPlayed = false; continue }
        gf[m.team1Id] += res.score1; gf[m.team2Id] += res.score2
        gd[m.team1Id] += res.score1 - res.score2; gd[m.team2Id] += res.score2 - res.score1
        if (res.score1 > res.score2) pts[m.team1Id] += 3
        else if (res.score2 > res.score1) pts[m.team2Id] += 3
        else { pts[m.team1Id] += 1; pts[m.team2Id] += 1 }
      }
      if (!allPlayed) continue
      groupStandings[group.id] = [...group.teamIds].sort((a, b) =>
        pts[b] !== pts[a] ? pts[b] - pts[a] : gd[b] !== gd[a] ? gd[b] - gd[a] : gf[b] - gf[a]
      )
    }

    // --- Predicted group standings ---
    const predictedStandings = deriveGroupStandings(myPreds)

    // --- Group order bonus: +2 per group where all 4 positions match exactly ---
    type TeamRef = { id: string; name: string; flag: string }
    const groupDetail: { groupId: string; predicted: TeamRef[]; actual: TeamRef[]; correct: boolean; pts: number }[] = []
    let groupOrderPoints = 0
    for (const [groupId, predicted] of Object.entries(predictedStandings)) {
      const actual = groupStandings[groupId]
      if (!actual) continue
      const correct = JSON.stringify(predicted) === JSON.stringify(actual)
      if (correct) groupOrderPoints += 2
      const toRef = (ids: string[]) => ids.map(tid => ({ id: tid, name: teamById[tid]?.name ?? tid, flag: teamById[tid]?.flag ?? '🏳' }))
      groupDetail.push({ groupId, predicted: toRef(predicted), actual: toRef(actual), correct, pts: correct ? 2 : 0 })
    }

    // --- Champion bonus: +6 ---
    const finalResult = db.results.find(r => {
      const m = matchById[r.matchId]
      return m?.phase === 'final'
    })
    let championPoints = 0
    let champion: string | null = null
    if (finalResult) {
      const finalMatch = matchById[finalResult.matchId]
      champion = finalResult.score1 > finalResult.score2
        ? (finalMatch?.team1Id ?? null)
        : finalResult.score2 > finalResult.score1
        ? (finalMatch?.team2Id ?? null)
        : (finalResult.advancingTeamId ?? null)
      const myFinalPred = myPreds[finalResult.matchId]
      if (myFinalPred && champion) {
        const finalMatch2 = matchById[myFinalPred.matchId]
        const predictedChampion =
          myFinalPred.score1 > myFinalPred.score2
            ? finalMatch2?.team1Id
            : myFinalPred.score2 > myFinalPred.score1
            ? finalMatch2?.team2Id
            : myFinalPred.advancingTeamId
        if (predictedChampion === champion) championPoints = 6
      }
    }

    const phasePoints = groupOrderPoints + championPoints
    const totalPoints = matchPoints + phasePoints

    return NextResponse.json({
      participant: { id: participant.id, name: participant.name },
      predictions,
      summary: { totalPoints, matchPoints, correctResults, correctScores, matchesPlayed: played.length, groupOrderPoints, championPoints, phasePoints },
      groupDetail,
    })
  } catch (err) {
    console.error('[participante]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
