'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { GROUPS, GROUP_MATCHES, KNOCKOUT_MATCHES, teamById, groupById } from '@/lib/copa2026'
import { Match, MatchPrediction, GroupPrediction, Participant, PHASE_LABELS, KNOCKOUT_PHASES } from '@/lib/types'

interface PredictionsData {
  participant: Participant
  matchPredictions: MatchPrediction[]
  groupPredictions: GroupPrediction[]
}

// Calculates predicted group standings from match predictions
function computeStandings(groupId: string, predMap: Record<string, MatchPrediction>) {
  const group = groupById[groupId]
  const stats: Record<string, { p: number; j: number; v: number; e: number; d: number; gp: number; gc: number }> =
    Object.fromEntries(group.teamIds.map(id => [id, { p: 0, j: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0 }]))

  const matches = GROUP_MATCHES.filter(m => m.groupId === groupId)
  for (const m of matches) {
    const pred = predMap[m.id]
    if (!pred) continue
    const { score1, score2 } = pred
    stats[m.team1Id].j++; stats[m.team2Id].j++
    stats[m.team1Id].gp += score1; stats[m.team1Id].gc += score2
    stats[m.team2Id].gp += score2; stats[m.team2Id].gc += score1
    if (score1 > score2) { stats[m.team1Id].p += 3; stats[m.team1Id].v++; stats[m.team2Id].d++ }
    else if (score2 > score1) { stats[m.team2Id].p += 3; stats[m.team2Id].v++; stats[m.team1Id].d++ }
    else { stats[m.team1Id].p++; stats[m.team1Id].e++; stats[m.team2Id].p++; stats[m.team2Id].e++ }
  }

  return group.teamIds
    .slice()
    .sort((a, b) => {
      if (stats[b].p !== stats[a].p) return stats[b].p - stats[a].p
      const sgB = stats[b].gp - stats[b].gc
      const sgA = stats[a].gp - stats[a].gc
      if (sgB !== sgA) return sgB - sgA
      return stats[b].gp - stats[a].gp
    })
    .map((id, idx) => ({ teamId: id, pos: idx + 1, sg: stats[id].gp - stats[id].gc, ...stats[id] }))
}

function MatchCard({
  match, prediction, result, isKnockout, onSave, saving,
}: {
  match: Match
  prediction?: MatchPrediction
  result?: { score1?: number; score2?: number; advancingTeamId?: string }
  isKnockout: boolean
  onSave: (matchId: string, s1: number, s2: number, adv?: string) => void
  saving: boolean
}) {
  const [s1, setS1] = useState<string>(prediction?.score1 !== undefined ? String(prediction.score1) : '')
  const [s2, setS2] = useState<string>(prediction?.score2 !== undefined ? String(prediction.score2) : '')
  const [adv, setAdv] = useState(prediction?.advancingTeamId ?? '')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)

  const team1 = teamById[match.team1Id]
  const team2 = teamById[match.team2Id]
  const isDraw = s1 !== '' && s2 !== '' && Number(s1) === Number(s2)
  const locked = result?.score1 !== undefined
  const isTBD = match.team1Id === 'TBD' || match.team2Id === 'TBD'

  function handle(field: 'a' | 'b', val: string) {
    if (!/^\d*$/.test(val) || Number(val) > 20) return
    if (field === 'a') setS1(val)
    else setS2(val)
    setDirty(true)
    setSaved(false)
  }

  async function save() {
    if (s1 === '' || s2 === '') return
    const advance = isKnockout && isDraw ? adv || undefined : undefined
    await onSave(match.id, Number(s1), Number(s2), advance)
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (isTBD) return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-600 text-sm italic">
      Jogo {match.matchNumber} — seleções a definir
    </div>
  )

  return (
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-all ${locked ? 'border-green-900/50' : dirty ? 'border-yellow-700' : saved ? 'border-green-700' : 'border-gray-800 hover:border-gray-700'}`}>
      {/* Header */}
      {(match.venue || match.date) && (
        <div className="text-center text-xs text-gray-500 pt-2.5 pb-1 px-3">
          {match.venue && <span className="font-medium text-gray-400">{match.venue}</span>}
          {match.venue && match.date && <span className="mx-1.5 text-gray-700">•</span>}
          {match.date && <span>{match.date}</span>}
        </div>
      )}

      {/* Score row */}
      <div className="flex items-center gap-2 px-4 py-3">
        {/* Team 1 */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <span className="text-xl shrink-0">{team1?.flag}</span>
          <span className="text-sm font-semibold truncate">{team1?.name}</span>
        </div>

        {/* Inputs */}
        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="text" inputMode="numeric" value={s1}
            disabled={locked}
            onChange={e => handle('a', e.target.value)}
            className="w-10 h-10 text-center text-xl font-bold rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-yellow-500 disabled:opacity-40 transition-colors"
          />
          <span className="text-gray-600 font-bold text-lg">×</span>
          <input
            type="text" inputMode="numeric" value={s2}
            disabled={locked}
            onChange={e => handle('b', e.target.value)}
            className="w-10 h-10 text-center text-xl font-bold rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-yellow-500 disabled:opacity-40 transition-colors"
          />
        </div>

        {/* Team 2 */}
        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <span className="text-sm font-semibold truncate text-right">{team2?.name}</span>
          <span className="text-xl shrink-0">{team2?.flag}</span>
        </div>
      </div>

      {/* Knockout draw selector */}
      {isKnockout && isDraw && !locked && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-blue-950/40 border border-blue-800 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-300 text-xs whitespace-nowrap">Quem avança?</span>
          <select value={adv} onChange={e => setAdv(e.target.value)}
            className="ml-auto bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-yellow-500">
            <option value="">Selecione...</option>
            <option value={match.team1Id}>{team1?.flag} {team1?.name}</option>
            <option value={match.team2Id}>{team2?.flag} {team2?.name}</option>
          </select>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-3 flex items-center justify-between">
        {locked ? (
          <span className="text-xs text-green-500 flex items-center gap-1">
            <span>✓</span> Resultado: {result?.score1}×{result?.score2}
          </span>
        ) : saved ? (
          <span className="text-xs text-green-400 flex items-center gap-1"><span>✓</span> Salvo</span>
        ) : (
          <span className="text-xs text-gray-600">
            {prediction !== undefined ? `Palpite: ${prediction.score1}×${prediction.score2}` : 'Sem palpite'}
          </span>
        )}
        {!locked && dirty && (
          <button onClick={save} disabled={saving || s1 === '' || s2 === '' || (isKnockout && isDraw && !adv)}
            className="text-xs bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg px-3 py-1.5 font-semibold transition-colors">
            Salvar
          </button>
        )}
      </div>
    </div>
  )
}

function GroupTab({ groupId, isActive, filledCount, onClick }: {
  groupId: string; isActive: boolean; filledCount: number; onClick: () => void
}) {
  const done = filledCount === 6
  return (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-lg text-sm font-bold border transition-all ${
        isActive ? 'bg-green-700 border-green-600 text-white shadow-lg shadow-green-900/30' :
        done ? 'bg-gray-800 border-green-800 text-green-400' :
        'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-white'
      }`}>
      {groupId}
      {done && <span className="ml-1 text-xs">✓</span>}
    </button>
  )
}

export default function PalpitePage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<PredictionsData | null>(null)
  const [results, setResults] = useState<Record<string, { score1?: number; score2?: number; advancingTeamId?: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'groups' | 'knockout'>('groups')
  const [activeGroup, setActiveGroup] = useState('A')
  const [activeRound, setActiveRound] = useState(1)
  const [toast, setToast] = useState('')

  useEffect(() => {
    Promise.all([
      fetch(`/api/predictions?token=${token}`).then(r => r.json()),
      fetch('/api/results').then(r => r.json()),
    ]).then(([preds, res]) => {
      if (preds.error) { setError(preds.error); setLoading(false); return }
      setData(preds)
      const m: typeof results = {}
      for (const r of (res as Array<{ matchId: string; score1: number; score2: number; advancingTeamId?: string }>)) m[r.matchId] = r
      setResults(m)
      setLoading(false)
    }).catch(() => { setError('Erro ao carregar'); setLoading(false) })
  }, [token])

  const savePrediction = useCallback(async (matchId: string, s1: number, s2: number, adv?: string) => {
    setSaving(true)
    try {
      await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, matchId, score1: s1, score2: s2, advancingTeamId: adv }),
      })
      setData(prev => {
        if (!prev) return prev
        const filtered = prev.matchPredictions.filter(p => p.matchId !== matchId)
        return { ...prev, matchPredictions: [...filtered, { participantId: prev.participant.id, matchId, score1: s1, score2: s2, ...(adv ? { advancingTeamId: adv } : {}) }] }
      })
    } finally {
      setSaving(false)
    }
  }, [token])

  if (loading) return <div className="text-center py-20 text-gray-400 animate-pulse">Carregando...</div>
  if (error) return <div className="text-center py-20"><p className="text-red-400 text-lg">{error}</p></div>
  if (!data) return null

  const predMap = Object.fromEntries(data.matchPredictions.map(p => [p.matchId, p]))

  const groupMatchesByGroup = GROUP_MATCHES.reduce((acc, m) => {
    if (!acc[m.groupId!]) acc[m.groupId!] = []
    acc[m.groupId!].push(m)
    return acc
  }, {} as Record<string, Match[]>)

  // Rounds: pairs of 2 matches per round
  const roundMatches = (gId: string, round: number) => {
    const all = groupMatchesByGroup[gId] ?? []
    return all.slice((round - 1) * 2, round * 2)
  }

  const totalPredicted = data.matchPredictions.length
  const totalGroupMatches = GROUP_MATCHES.length

  const knockoutByPhase = KNOCKOUT_MATCHES.reduce((acc, m) => {
    if (!acc[m.phase]) acc[m.phase] = []
    acc[m.phase].push(m)
    return acc
  }, {} as Record<string, Match[]>)

  const standings = computeStandings(activeGroup, predMap)

  return (
    <div className="space-y-5">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-green-700 text-white px-4 py-2 rounded-xl shadow-xl z-50 text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{data.participant.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-40 bg-gray-800 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalPredicted / totalGroupMatches) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500">{totalPredicted}/{totalGroupMatches} jogos</span>
          </div>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-white transition-colors">← Classificação</a>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('groups')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'groups' ? 'bg-green-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
          ⚽ Fase de Grupos
        </button>
        <button onClick={() => setActiveTab('knockout')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'knockout' ? 'bg-green-700 text-white shadow' : 'text-gray-400 hover:text-white'}`}>
          🏆 Mata-Mata
        </button>
      </div>

      {/* GROUP STAGE */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Group selector */}
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => (
              <GroupTab key={g.id} groupId={g.id} isActive={activeGroup === g.id}
                filledCount={(groupMatchesByGroup[g.id] ?? []).filter(m => predMap[m.id]).length}
                onClick={() => { setActiveGroup(g.id); setActiveRound(1) }} />
            ))}
          </div>

          {/* Group content */}
          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left: standings table */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
                <h3 className="font-bold text-sm uppercase tracking-wider text-gray-300">
                  {groupById[activeGroup]?.name} — Classificação Prevista
                </h3>
                <span className="text-xs text-gray-600">baseada nos seus palpites</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-600 uppercase">
                    <th className="px-3 py-2 text-left w-6"></th>
                    <th className="px-3 py-2 text-left">Time</th>
                    <th className="px-2 py-2 text-center w-8">P</th>
                    <th className="px-2 py-2 text-center w-8">J</th>
                    <th className="px-2 py-2 text-center w-8">V</th>
                    <th className="px-2 py-2 text-center w-8">E</th>
                    <th className="px-2 py-2 text-center w-8">D</th>
                    <th className="px-2 py-2 text-center w-8">GP</th>
                    <th className="px-2 py-2 text-center w-8">GC</th>
                    <th className="px-2 py-2 text-center w-8">SG</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800/50">
                  {standings.map((row, idx) => {
                    const team = teamById[row.teamId]
                    const qualifies = idx < 2
                    return (
                      <tr key={row.teamId} className={`transition-colors ${qualifies ? 'bg-green-950/20' : ''}`}>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-bold w-5 h-5 rounded-full inline-flex items-center justify-center ${qualifies ? 'bg-green-700 text-white' : 'text-gray-600'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{team?.flag}</span>
                            <span className="font-medium text-sm">{team?.name}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-white">{row.p}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.j}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.v}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.e}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.d}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.gp}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.gc}</td>
                        <td className={`px-2 py-3 text-center font-medium ${row.sg > 0 ? 'text-green-400' : row.sg < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                          {row.sg > 0 ? `+${row.sg}` : row.sg}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="px-4 py-2 border-t border-gray-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-700 inline-block"></span>
                <span className="text-xs text-gray-600">Classificados (top 2 + melhores 3ºs)</span>
              </div>
            </div>

            {/* Right: match cards */}
            <div className="space-y-3">
              {/* Round navigation */}
              <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                <button onClick={() => setActiveRound(r => Math.max(1, r - 1))} disabled={activeRound === 1}
                  className="text-gray-400 hover:text-white disabled:opacity-20 text-lg px-2">‹</button>
                <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                  {activeRound}ª Rodada
                </span>
                <button onClick={() => setActiveRound(r => Math.min(3, r + 1))} disabled={activeRound === 3}
                  className="text-gray-400 hover:text-white disabled:opacity-20 text-lg px-2">›</button>
              </div>

              {roundMatches(activeGroup, activeRound).map(m => (
                <MatchCard key={m.id} match={m} prediction={predMap[m.id]} result={results[m.id]}
                  isKnockout={false} onSave={savePrediction} saving={saving} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KNOCKOUT STAGE */}
      {activeTab === 'knockout' && (
        <div className="space-y-8">
          <div className="bg-blue-950/30 border border-blue-900 rounded-xl p-4 text-sm text-blue-200">
            <strong>Mata-mata:</strong> Em empate no tempo regulamentar, selecione quem avança (prorrogação/pênaltis). Apenas o placar dos 90 minutos conta para a pontuação.
          </div>
          {KNOCKOUT_PHASES.map(phase => {
            const phaseMatches = knockoutByPhase[phase] ?? []
            if (phaseMatches.length === 0) return null
            const hasTeams = phaseMatches.some(m => m.team1Id !== 'TBD')
            return (
              <div key={phase}>
                <h3 className="font-bold text-base text-yellow-300 uppercase tracking-wider mb-3">{PHASE_LABELS[phase]}</h3>
                {!hasTeams ? (
                  <p className="text-gray-700 text-sm italic">Seleções definidas após a fase de grupos.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {phaseMatches.map(m => (
                      <MatchCard key={m.id} match={m} prediction={predMap[m.id]} result={results[m.id]}
                        isKnockout={true} onSave={savePrediction} saving={saving} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
