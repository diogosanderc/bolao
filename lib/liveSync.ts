import { updateDB, readDB } from './db'
import { ALL_MATCHES, teamById } from './copa2026'
import { resolveTeam } from './espn'
import { sendPushToAll } from './push'
import { notifyPositionChanges } from './positionNotify'
import { computeBracketFromResults } from './bracket'

type MatchState = {
  status: 'pre' | 'in' | 'halftime' | 'suspended' | 'extratime' | 'et_halftime' | 'penalties' | 'completed'
  score1: number
  score2: number
  sentStarted?: boolean
  sentHalftime?: boolean
  sentSecondHalf?: boolean
  sentSuspended?: boolean
  sentFinal?: boolean
  sentGoals?: number
  sentVARKeys?: string[]
  sentRedCardKeys?: string[]
  sentExtraTime?: boolean
  sentETHalftime?: boolean
  sentETSecondHalf?: boolean
  sentPenalties?: boolean
  sentPenaltyGoals?: number
  penaltyScore1?: number
  penaltyScore2?: number
  regScore1?: number
  regScore2?: number
  regulationScore1?: number
  regulationScore2?: number
}

type ESPNProcessed = {
  matchId: string
  newStatus: MatchState['status']
  score1: number
  score2: number
  team1Id: string
  team2Id: string
  t1: string
  t2: string
  clock: string
  varKeys: string[]
  redCardKeys: string[]
  espnStatusName: string
  phase: string
  winnerTeamId?: string
  penaltyScore1?: number
  penaltyScore2?: number
}

let lastRunAt = 0

export type SyncResult = { ok: boolean; notifications?: number; skipped?: boolean; error?: string }

export async function runLiveSync(): Promise<SyncResult> {
  const now = Date.now()
  if (now - lastRunAt < 8_000) {
    return { ok: true, skipped: true }
  }
  lastRunAt = now

  // 1. Fetch ESPN data (outside DB lock)
  let espnData: any
  try {
    const res = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; bolao-sync/1.0)' }, cache: 'no-store' }
    )
    if (!res.ok) return { ok: false, error: `ESPN ${res.status}` }
    espnData = await res.json()
  } catch (err: any) {
    return { ok: false, error: err.message }
  }

  // 2. Pre-process ESPN events into matchId-keyed data
  // Resolve knockout teams from current results so live knockout matches can be matched
  const currentDB = await readDB()
  const resolvedKnockout = computeBracketFromResults(currentDB.results)

  const espnProcessed: ESPNProcessed[] = []
  for (const event of espnData.events ?? []) {
    const competition = event.competitions?.[0]
    if (!competition) continue

    const status = competition.status ?? event.status
    const typeName: string = status?.type?.name ?? ''
    const completed = status?.type?.completed === true || typeName === 'STATUS_FINAL'
    const halftime = typeName === 'STATUS_HALFTIME'
    const extratime = typeName === 'STATUS_EXTRA_TIME' || typeName === 'STATUS_OVERTIME'
    const etHalftime = typeName === 'STATUS_HALFTIME_ET' || typeName === 'STATUS_HALFTIME_EXTRATIME'
    const penalties = typeName === 'STATUS_SHOOTOUT' || typeName === 'STATUS_PENALTY' || typeName === 'STATUS_PENALTY_KICK' || typeName === 'STATUS_PENALTY_SHOOTOUT'
    const suspended =
      typeName === 'STATUS_RAIN_DELAY' ||
      typeName === 'STATUS_DELAYED' ||
      typeName === 'STATUS_SUSPENDED' ||
      typeName === 'STATUS_POSTPONED' ||
      (status?.type?.description ?? '').toLowerCase().includes('delay') ||
      (status?.type?.description ?? '').toLowerCase().includes('suspend')
    const inProgress = !completed && !suspended && (
      status?.type?.state === 'in' ||
      typeName === 'STATUS_IN_PROGRESS' ||
      typeName === 'STATUS_SECOND_HALF' ||
      extratime || etHalftime || penalties || halftime
    )

    const competitors: any[] = competition.competitors ?? []
    if (competitors.length !== 2) continue

    const c1 = competitors.find((c: any) => c.homeAway === 'home') ?? competitors[0]
    const c2 = competitors.find((c: any) => c.homeAway === 'away') ?? competitors[1]
    const id1 = resolveTeam(c1.team?.abbreviation ?? '', c1.team?.displayName ?? '')
    const id2 = resolveTeam(c2.team?.abbreviation ?? '', c2.team?.displayName ?? '')
    if (!id1 || !id2) continue

    let match = ALL_MATCHES.find(m => {
      const t1 = m.team1Id !== 'TBD' ? m.team1Id : resolvedKnockout[m.id]?.team1Id
      const t2 = m.team2Id !== 'TBD' ? m.team2Id : resolvedKnockout[m.id]?.team2Id
      if (!t1 || !t2 || t1 === 'TBD' || t2 === 'TBD') return false
      return (t1 === id1 && t2 === id2) || (t1 === id2 && t2 === id1)
    })
    // Fallback: for knockout matches where one slot is still TBD (best-3rd not yet resolved),
    // match using the single confirmed team — it uniquely identifies the match.
    if (!match) {
      match = ALL_MATCHES.find(m => {
        if (m.phase === 'group') return false
        const t1 = m.team1Id !== 'TBD' ? m.team1Id : resolvedKnockout[m.id]?.team1Id
        const t2 = m.team2Id !== 'TBD' ? m.team2Id : resolvedKnockout[m.id]?.team2Id
        const t1Known = t1 && t1 !== 'TBD'
        const t2Known = t2 && t2 !== 'TBD'
        if (t1Known && !t2Known) return t1 === id1 || t1 === id2
        if (t2Known && !t1Known) return t2 === id1 || t2 === id2
        return false
      })
    }
    if (!match) continue

    const resolvedM = resolvedKnockout[match.id]
    const effectiveTeam1 = match.team1Id !== 'TBD' ? match.team1Id : resolvedM?.team1Id ?? match.team1Id
    const flipped = effectiveTeam1 === id2
    const rawS1 = parseInt(c1.score ?? '0', 10)
    const rawS2 = parseInt(c2.score ?? '0', 10)
    const score1 = flipped ? rawS2 : rawS1
    const score2 = flipped ? rawS1 : rawS2
    const newStatus: MatchState['status'] = completed ? 'completed' : penalties ? 'penalties' : etHalftime ? 'et_halftime' : extratime ? 'extratime' : halftime ? 'halftime' : inProgress ? 'in' : suspended ? 'suspended' : 'pre'
    const clock: string = halftime || etHalftime ? 'Intervalo' : suspended ? (status?.type?.shortDetail ?? status?.type?.description ?? 'Paralisado') : (status?.displayClock ?? '')

    const varKeys: string[] = []
    const redCardKeys: string[] = []
    let penaltyScore1: number | undefined
    let penaltyScore2: number | undefined
    const c1TeamId = String(c1.team?.id ?? '')
    const c2TeamId = String(c2.team?.id ?? '')
    for (const detail of competition?.details ?? []) {
      const typeText: string = detail.type?.text ?? ''
      const typeLower = typeText.toLowerCase()

      if (
        typeLower.includes('var') ||
        typeLower.includes('review') ||
        typeLower.includes('cancel') ||
        typeLower.includes('disallow') ||
        typeLower.includes('offside - goal')
      ) {
        const minute = detail.clock?.displayValue ?? ''
        varKeys.push(`${typeText}|${minute}`)
      }

      if (typeLower === 'red card' || typeLower === 'yellow card - red') {
        const player: string = detail.athletesInvolved?.[0]?.displayName ?? '?'
        const minute = detail.clock?.displayValue ?? ''
        const detailTeamId = String(detail.team?.id ?? '')
        redCardKeys.push(`${detailTeamId}|${player}|${minute}`)
      }

      // Count penalty goals from details even when status is already 'completed'
      // so cold-start and post-completion polls can still determine the shootout winner.
      if (typeText === 'Penalty - Scored') {
        const detailTeamId = String(detail.team?.id ?? '')
        if (penaltyScore1 === undefined) penaltyScore1 = 0
        if (penaltyScore2 === undefined) penaltyScore2 = 0
        if (detailTeamId === c1TeamId) penaltyScore1++
        else if (detailTeamId === c2TeamId) penaltyScore2++
      }
    }
    if (penaltyScore1 !== undefined) {
      if (flipped) { const tmp = penaltyScore1; penaltyScore1 = penaltyScore2; penaltyScore2 = tmp }
    }

    // Determine advancing team: try multiple sources in priority order.
    // 1) ESPN's explicit competitor.winner flag
    // 2) Penalty goal count from details (works even when status is already 'completed')
    // 3) Score-based derivation for non-draw knockout results
    const espnWinnerId = c1.winner === true ? id1 : c2.winner === true ? id2 : undefined
    const effT1 = resolvedM?.team1Id ?? match.team1Id
    const effT2 = resolvedM?.team2Id ?? match.team2Id
    const penWinnerId = !espnWinnerId
      && penaltyScore1 !== undefined && penaltyScore2 !== undefined
      && penaltyScore1 !== penaltyScore2
      ? (penaltyScore1 > penaltyScore2 ? effT1 : effT2)
      : undefined
    const scoreWinnerId = !espnWinnerId && !penWinnerId && match.phase !== 'group' && score1 !== score2
      ? (score1 > score2 ? effT1 : effT2)
      : undefined
    const winnerTeamId = espnWinnerId ?? penWinnerId ?? scoreWinnerId

    espnProcessed.push({
      matchId: match.id, newStatus, score1, score2, phase: match.phase,
      team1Id: effT1,
      team2Id: effT2,
      t1: teamById[effT1]?.name ?? effT1,
      t2: teamById[effT2]?.name ?? effT2,
      clock, varKeys, redCardKeys, espnStatusName: typeName, winnerTeamId, penaltyScore1, penaltyScore2,
    })
  }

  // 3. All state transitions and notification decisions happen atomically inside the DB lock
  const pushQueue: { title: string; body: string }[] = []

  await updateDB(db => {
    const resultMap = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    const persistedStates: Record<string, MatchState> = (db as any).liveMatchStates ?? {}
    const newPersistedStates: Record<string, MatchState> = { ...persistedStates }
    const dbResultUpdates: { matchId: string; score1: number; score2: number; advancingTeamId?: string; regulationScore1?: number; regulationScore2?: number }[] = []

    pushQueue.length = 0

    for (const { matchId, newStatus, score1, score2, phase, team1Id, team2Id, t1, t2, clock, varKeys, redCardKeys, espnStatusName, winnerTeamId, penaltyScore1, penaltyScore2 } of espnProcessed) {
      const prev = persistedStates[matchId]

      if (prev?.status === 'completed') continue

      const matchDate = db.matchDates?.[matchId]?.date
      if (matchDate) {
        const hoursSince = (Date.now() - new Date(matchDate).getTime()) / 3_600_000
        if (hoursSince > 5) continue
      }

      const scoreStr = `${t1} ${score1}×${score2} ${t2}`
      const dbResult = resultMap[matchId]

      if (newStatus === 'completed' && dbResult && dbResult.score1 === score1 && dbResult.score2 === score2) {
        newPersistedStates[matchId] = { ...prev, status: 'completed', score1, score2, sentStarted: true, sentFinal: true, sentGoals: score1 + score2 }
        // Back-fill advancingTeamId for all knockout matches, not just draws
        if (phase !== 'group' && winnerTeamId && !dbResult.advancingTeamId) {
          dbResultUpdates.push({ matchId, score1, score2, advancingTeamId: winnerTeamId })
        }
        continue
      }

      if (!prev) {
        if (newStatus === 'completed') {
          // Match already finished on first encounter — save result silently
          newPersistedStates[matchId] = { status: 'completed', score1, score2, sentStarted: true, sentFinal: true, sentGoals: score1 + score2 }
          const coldAdvancing = phase !== 'group' && winnerTeamId ? winnerTeamId : undefined
          const advancing = coldAdvancing ?? dbResult?.advancingTeamId
          if (!dbResult || dbResult.score1 !== score1 || dbResult.score2 !== score2) {
            dbResultUpdates.push({ matchId, score1, score2, ...(advancing ? { advancingTeamId: advancing } : {}) })
          } else if (advancing && !dbResult.advancingTeamId) {
            dbResultUpdates.push({ matchId, score1, score2, advancingTeamId: advancing })
          }
        } else if (newStatus === 'in' || newStatus === 'halftime') {
          // Match already in progress on first encounter — notify immediately.
          // sentGoals = current score so we don't re-alert for goals already scored.
          const currentGoals = score1 + score2
          pushQueue.push({ title: '🟢 Jogo em andamento!', body: `${t1} ${score1}×${score2} ${t2}` })
          newPersistedStates[matchId] = {
            status: newStatus, score1, score2,
            sentStarted: true,
            sentHalftime: newStatus === 'halftime',
            sentGoals: currentGoals,
            sentFinal: false,
          }
        } else {
          // 'pre' — upcoming match seen for the first time
          newPersistedStates[matchId] = { status: 'pre', score1: 0, score2: 0 }
        }
        continue
      }

      if (prev.status !== 'pre' && newStatus === 'pre') continue

      // ── Suspended / rain delay ────────────────────────────────────────────
      // Must be checked BEFORE score regression — ESPN often resets scores to
      // 0-0 during a delay, which would otherwise trigger a false "gol anulado".
      if (newStatus === 'suspended') {
        if (!prev.sentSuspended) {
          // Use prev scores: ESPN may have zeroed them during the delay
          const s1 = prev.score1, s2 = prev.score2
          pushQueue.push({ title: '⛈️ Jogo paralisado', body: `${t1} ${s1}×${s2} ${t2} · ${clock}` })
          // Preserve prev scores and sentGoals so resumption doesn't re-notify old goals
          newPersistedStates[matchId] = { ...prev, status: 'suspended', sentSuspended: true }
        }
        continue
      }

      // ── Match resumed after suspension ────────────────────────────────────
      if (prev.status === 'suspended' && (newStatus === 'in' || newStatus === 'halftime')) {
        pushQueue.push({ title: '▶️ Jogo retomado!', body: `${t1} ${score1}×${score2} ${t2}` })
        // Restore correct scores from ESPN now that match is live again.
        // Keep sentGoals from prev so goals scored before delay aren't re-notified.
        newPersistedStates[matchId] = {
          ...prev,
          status: newStatus,
          score1,
          score2,
          sentSuspended: false,
          sentGoals: Math.max(prev.sentGoals ?? 0, score1 + score2),
        }
        continue
      }

      if (score1 < prev.score1 || score2 < prev.score2) {
        const sentGoalsNow = prev.sentGoals ?? (prev.score1 + prev.score2)
        const currentGoals = score1 + score2
        if (newStatus !== 'pre' && !prev.sentFinal && currentGoals < sentGoalsNow) {
          const clockLabel = clock && clock !== 'Intervalo' ? ` · ${clock}` : ''
          pushQueue.push({ title: '🔍 Gol anulado!', body: `${t1} ${score1}×${score2} ${t2}${clockLabel}` })
          newPersistedStates[matchId] = { ...prev, score1, score2, sentGoals: currentGoals }
        }
        continue
      }

      const sentStarted = prev.sentStarted ?? (prev.status !== 'pre')
      const sentHalftime = prev.sentHalftime ?? false
      const sentSecondHalf = prev.sentSecondHalf ?? false
      const sentGoals = prev.sentGoals ?? (prev.score1 + prev.score2)
      const sentFinal = prev.sentFinal ?? false
      const sentExtraTime = prev.sentExtraTime ?? false
      const sentETHalftime = prev.sentETHalftime ?? false
      const sentETSecondHalf = prev.sentETSecondHalf ?? false
      const sentPenalties = prev.sentPenalties ?? false
      const sentPenaltyGoals = prev.sentPenaltyGoals ?? 0
      const regScore1 = prev.regScore1
      const regScore2 = prev.regScore2
      const regulationScore1 = prev.regulationScore1
      const regulationScore2 = prev.regulationScore2

      const newState: MatchState = {
        status: newStatus, score1, score2, sentStarted, sentHalftime, sentSecondHalf, sentGoals, sentFinal,
        sentVARKeys: prev.sentVARKeys,
        sentRedCardKeys: prev.sentRedCardKeys,
        sentExtraTime, sentETHalftime, sentETSecondHalf, sentPenalties, sentPenaltyGoals,
        penaltyScore1: newStatus === 'penalties' ? (penaltyScore1 ?? prev.penaltyScore1) : undefined,
        penaltyScore2: newStatus === 'penalties' ? (penaltyScore2 ?? prev.penaltyScore2) : undefined,
        regScore1, regScore2, regulationScore1, regulationScore2,
      }

      if (newStatus === 'in' && !sentStarted) {
        pushQueue.push({ title: '🟢 Jogo começou!', body: `${t1} x ${t2}` })
        newState.sentStarted = true
      }

      if (newStatus === 'halftime' && !sentHalftime) {
        pushQueue.push({ title: '⏸ Intervalo', body: scoreStr })
        newState.sentHalftime = true
      }

      if (newStatus === 'in' && prev.status === 'halftime' && !sentSecondHalf) {
        pushQueue.push({ title: '▶️ Segundo tempo!', body: scoreStr })
        newState.sentSecondHalf = true
      }

      // ── Extra time ───────────────────────────────────────────────────────────
      if (newStatus === 'extratime' && !sentExtraTime) {
        pushQueue.push({ title: '⏱ Prorrogação!', body: scoreStr })
        newState.sentExtraTime = true
        // Lock in the 90-min score — only regulation goals count for prediction points
        newState.regulationScore1 = score1
        newState.regulationScore2 = score2
      }

      if (newStatus === 'et_halftime' && !sentETHalftime) {
        pushQueue.push({ title: '⏸ Intervalo da prorrogação', body: scoreStr })
        newState.sentETHalftime = true
      }

      if (newStatus === 'extratime' && prev.status === 'et_halftime' && !sentETSecondHalf) {
        pushQueue.push({ title: '▶️ Volta da prorrogação!', body: scoreStr })
        newState.sentETSecondHalf = true
      }

      // ESPN sometimes goes straight from 'in' (90+) to 'extratime' — also handle
      // halftime → extratime transition (ESPN may skip et_halftime state)
      // and 'completed' with ET flag coming before penalties

      // ── Penalties ────────────────────────────────────────────────────────────
      if (newStatus === 'penalties' && !sentPenalties) {
        pushQueue.push({ title: '🥅 Disputa de pênaltis!', body: scoreStr })
        newState.sentPenalties = true
        // Reset penalty goals counter to current match score (pre-shootout)
        newState.sentPenaltyGoals = 0
        // Lock in the regulation/ET draw score — this is what counts for scoring,
        // the shootout only decides who advances (set separately via advancingTeamId)
        newState.regScore1 = score1
        newState.regScore2 = score2
      }

      // Track individual penalty goals (score changes during shootout)
      if (newStatus === 'penalties') {
        const currentPenGoals = score1 + score2
        if (currentPenGoals > sentPenaltyGoals) {
          pushQueue.push({ title: '⚽ Pênalti marcado!', body: scoreStr })
          newState.sentPenaltyGoals = currentPenGoals
        }
      }

      // Regular & ET goals (not during penalties)
      const currentGoals = score1 + score2
      if (newStatus !== 'pre' && newStatus !== 'penalties' && currentGoals > sentGoals) {
        const alreadyFinal = dbResult && dbResult.score1 === score1 && dbResult.score2 === score2
        if (!alreadyFinal) {
          const clockLabel = clock && clock !== 'Intervalo' ? ` · ${clock}` : ''
          const inET = newStatus === 'extratime' || newStatus === 'et_halftime'
          pushQueue.push({ title: `⚽ Gol!${inET ? ' (Prorrogação)' : ''}${clockLabel}`, body: scoreStr })
        }
        newState.sentGoals = currentGoals
      }

      if (newStatus === 'completed') {
        if (!sentFinal) {
          const hadET = sentExtraTime
          const hadPen = sentPenalties
          const suffix = hadPen ? ' (pênaltis)' : hadET ? ' (prorrogação)' : ''
          pushQueue.push({ title: `🏁 Resultado final${suffix}`, body: scoreStr })
          newState.sentFinal = true
        }
        // score1/score2 = full final score for display (includes ET goals).
        // regulationScore1/2 = 90-min score only, used for prediction points.
        const regS1 = sentExtraTime && regulationScore1 !== undefined ? regulationScore1
          : sentPenalties && regScore1 !== undefined ? regScore1
          : undefined
        const regS2 = sentExtraTime && regulationScore2 !== undefined ? regulationScore2
          : sentPenalties && regScore2 !== undefined ? regScore2
          : undefined
        const wentBeyondRegulation = regS1 !== undefined
        const advancingTeamId = phase !== 'group' ? winnerTeamId : undefined
        const advancing = advancingTeamId ?? dbResult?.advancingTeamId
        if (!dbResult
          || dbResult.score1 !== score1
          || dbResult.score2 !== score2
          || (advancing && dbResult.advancingTeamId !== advancing)
          || (wentBeyondRegulation && (dbResult.regulationScore1 !== regS1 || dbResult.regulationScore2 !== regS2))) {
          dbResultUpdates.push({
            matchId,
            score1,
            score2,
            ...(advancing ? { advancingTeamId: advancing } : {}),
            ...(wentBeyondRegulation ? { regulationScore1: regS1!, regulationScore2: regS2! } : {}),
          })
        }
      }

      if (newStatus === 'in' && varKeys.length > 0) {
        const alreadySent = new Set(prev.sentVARKeys ?? [])
        const newVARKeys: string[] = []
        for (const key of varKeys) {
          if (!alreadySent.has(key)) newVARKeys.push(key)
        }
        if (newVARKeys.length > 0) {
          pushQueue.push({ title: '🔍 VAR em andamento', body: `${t1} x ${t2}` })
          newState.sentVARKeys = [...Array.from(alreadySent), ...newVARKeys]
        }
      }

      if (newStatus !== 'pre' && redCardKeys.length > 0) {
        const alreadySentRed = new Set(prev.sentRedCardKeys ?? [])
        const newRedKeys: string[] = []
        for (const key of redCardKeys) {
          if (!alreadySentRed.has(key)) {
            const [, player, minute] = key.split('|')
            const clockLabel = minute ? ` · ${minute}` : ''
            pushQueue.push({ title: `🟥 Cartão vermelho${clockLabel}`, body: `${player} — ${t1} x ${t2}` })
            newRedKeys.push(key)
          }
        }
        if (newRedKeys.length > 0) {
          newState.sentRedCardKeys = [...Array.from(alreadySentRed), ...newRedKeys]
        }
      }

      newPersistedStates[matchId] = newState
    }

    const map = Object.fromEntries(db.results.map(r => [r.matchId, r]))
    for (const u of dbResultUpdates) map[u.matchId] = { ...map[u.matchId], ...u }
    return { ...db, results: Object.values(map), liveMatchStates: newPersistedStates, lastPollerRun: new Date().toISOString() } as any
  })

  // 4. Send notifications after DB write committed
  for (const p of pushQueue) {
    sendPushToAll({ ...p, icon: '/icon-192.png' }).catch(() => {})
  }

  if (pushQueue.length > 0) {
    console.log(`[liveSync] ${pushQueue.length} notification(s):`, pushQueue.map(p => p.title))
  }

  // 5. Per-participant "you moved" position alerts (background push)
  notifyPositionChanges().catch(() => {})

  return { ok: true, notifications: pushQueue.length }
}
