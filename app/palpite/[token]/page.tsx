'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { GROUPS, GROUP_MATCHES, KNOCKOUT_MATCHES, teamById, groupById } from '@/lib/copa2026'
import { Match, MatchPrediction, GroupPrediction, Participant, PHASE_LABELS, KNOCKOUT_PHASES } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { Icon } from '@/components/Icon'
import { computeGroupStandings, computeFullBracket } from '@/lib/bracket'

interface PredictionsData {
  participant: Participant
  matchPredictions: MatchPrediction[]
  groupPredictions: GroupPrediction[]
  knockoutPhasePicks?: {
    r16: string[]; qf: string[]; sf: string[]; finalists: string[]; champion: string
  } | null
}


function MatchCard({
  match, prediction, result, isKnockout, onSave, saving, team1IdOverride, team2IdOverride, adminMode,
}: {
  match: Match
  prediction?: MatchPrediction
  result?: { score1?: number; score2?: number; advancingTeamId?: string }
  isKnockout: boolean
  onSave: (matchId: string, s1: number, s2: number, adv?: string) => void
  saving: boolean
  team1IdOverride?: string
  team2IdOverride?: string
  adminMode?: boolean
}) {
  const [s1, setS1] = useState<string>(prediction?.score1 !== undefined ? String(prediction.score1) : '')
  const [s2, setS2] = useState<string>(prediction?.score2 !== undefined ? String(prediction.score2) : '')
  const [adv, setAdv] = useState(prediction?.advancingTeamId ?? '')
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync when prediction changes (admin editing another match updates state)
  useEffect(() => {
    if (prediction?.score1 !== undefined) setS1(String(prediction.score1))
    if (prediction?.score2 !== undefined) setS2(String(prediction.score2))
    if (prediction?.advancingTeamId) setAdv(prediction.advancingTeamId)
  }, [prediction?.score1, prediction?.score2, prediction?.advancingTeamId])

  const t1Id = team1IdOverride ?? match.team1Id
  const t2Id = team2IdOverride ?? match.team2Id
  const team1 = teamById[t1Id]
  const team2 = teamById[t2Id]
  const isDraw = s1 !== '' && s2 !== '' && Number(s1) === Number(s2)
  // 3rd-place match: only the score counts for points — a draw needs no advancing pick
  const needsAdvancing = isKnockout && isDraw && match.id !== 'TP_1'
  const officialResult = result?.score1 !== undefined
  // Admin mode: always unlocked. Participant: locked once prediction exists
  const locked = adminMode ? false : (officialResult || prediction !== undefined)
  const isTBD = t1Id === 'TBD' || t2Id === 'TBD'

  function handle(field: 'a' | 'b', val: string) {
    if (!/^\d*$/.test(val) || Number(val) > 20) return
    if (field === 'a') setS1(val)
    else setS2(val)
    setDirty(true)
    setSaved(false)
  }

  async function save() {
    if (s1 === '' || s2 === '') return
    const advance = needsAdvancing ? adv || undefined : undefined
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
    <div className={`bg-gray-900 border rounded-xl overflow-hidden transition-all ${locked ? 'border-green-600 dark:border-green-900/50' : dirty ? 'border-yellow-700' : saved ? 'border-green-700' : 'border-gray-800 hover:border-gray-700'}`}>
      {match.date && (
        <div className="text-center text-xs text-gray-500 pt-2.5 pb-1 px-3">{match.date}</div>
      )}

      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <Flag teamId={t1Id} size={24} />
          <span className="text-sm font-semibold truncate">{t1Id}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            ref={inputRef}
            type="text" inputMode="numeric" pattern="[0-9]*" value={s1}
            disabled={locked}
            onChange={e => handle('a', e.target.value)}
            className="w-10 h-10 text-center text-xl font-bold rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-yellow-500 disabled:opacity-40 transition-colors"
          />
          <span className="text-gray-600 font-bold text-lg">×</span>
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" value={s2}
            disabled={locked}
            onChange={e => handle('b', e.target.value)}
            className="w-10 h-10 text-center text-xl font-bold rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-yellow-500 disabled:opacity-40 transition-colors"
          />
        </div>

        <div className="flex-1 flex items-center gap-2 justify-end min-w-0">
          <span className="text-sm font-semibold truncate text-right">{t2Id}</span>
          <Flag teamId={t2Id} size={24} />
        </div>
      </div>

      {needsAdvancing && !locked && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-blue-50 dark:bg-blue-950/40 border border-blue-300 dark:border-blue-800 rounded-lg px-3 py-2 text-sm">
          <span className="text-blue-700 dark:text-blue-300 text-xs whitespace-nowrap">Quem avança?</span>
          <select value={adv} onChange={e => { setAdv(e.target.value); setDirty(true) }}
            className="ml-auto bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-yellow-500">
            <option value="">Selecione...</option>
            <option value={t1Id}>{team1?.name ?? t1Id}</option>
            <option value={t2Id}>{team2?.name ?? t2Id}</option>
          </select>
        </div>
      )}

      <div className="px-4 pb-3 flex items-center justify-between">
        {officialResult ? (
          <span className="text-xs text-green-600 dark:text-green-500 flex items-center gap-1">
            <Icon name="check" size={13} /> Resultado oficial: {result?.score1}×{result?.score2}
          </span>
        ) : prediction !== undefined ? (
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <Icon name="check" size={13} /> Palpite enviado
          </span>
        ) : (
          <span className="text-xs text-gray-600">Sem palpite</span>
        )}

        {!locked && (dirty || adminMode) && (
          <button onClick={save} disabled={saving || s1 === '' || s2 === '' || (needsAdvancing && !adv)}
            className="text-xs bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-800 disabled:text-gray-600 text-[white] rounded-lg px-3 py-1.5 font-semibold transition-colors">
            {adminMode && prediction !== undefined ? 'Atualizar' : 'Salvar'}
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
        isActive ? 'bg-green-700 border-green-600 text-[white] shadow-lg shadow-green-900/30' :
        done ? 'bg-gray-800 border-green-800 text-green-600 dark:text-green-400' :
        'bg-gray-900 border-gray-800 text-gray-400 hover:border-gray-600 hover:text-gray-200'
      }`}>
      {groupId}
      {done && <Icon name="check" size={12} className="ml-1 inline" />}
    </button>
  )
}

export default function PalpitePage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const token = params.token as string
  const [adminMode, setAdminMode] = useState(false)

  const [data, setData] = useState<PredictionsData | null>(null)
  const [results, setResults] = useState<Record<string, { score1?: number; score2?: number; advancingTeamId?: string }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'groups' | 'knockout'>('groups')
  const [activeGroup, setActiveGroup] = useState('A')
  const [activeRound, setActiveRound] = useState(1)

  // Detect admin mode via ?admin=1 + stored admin key
  useEffect(() => {
    if (searchParams.get('admin') !== '1') return
    const storedKey = localStorage.getItem('bolao_admin_key')
    if (!storedKey) return
    fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminKey: storedKey }),
    }).then(r => { if (r.ok) setAdminMode(true) })
  }, [searchParams])

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
    }).catch((e) => { setError('Erro ao carregar: ' + String(e)); setLoading(false) })
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

  const standings = computeGroupStandings(activeGroup, predMap)

  // Resolve the participant's predicted bracket. For knockout draws without a saved
  // advancingTeamId, infer the winner from his knockoutPhasePicks lists (display only)
  // so the bracket resolves all the way to the final.
  const kp = data.knockoutPhasePicks
  const effPredMap: typeof predMap = Object.fromEntries(
    Object.entries(predMap).map(([id, p]) => [id, { ...p }])
  )
  if (kp) {
    const listFor: Record<string, Set<string> | null> = {
      R32: new Set(kp.r16 ?? []),
      R16: new Set(kp.qf ?? []),
      QF: new Set(kp.sf ?? []),
      SF: new Set(kp.finalists ?? []),
      F_: kp.champion ? new Set([kp.champion]) : null,
    }
    for (const phase of ['R32', 'R16', 'QF', 'SF', 'F_']) {
      const bracket = computeFullBracket(effPredMap)
      for (const [id, p] of Object.entries(effPredMap)) {
        if (!id.startsWith(phase) || id === 'TP_1') continue
        if (p.score1 !== p.score2 || p.advancingTeamId) continue
        const t1 = bracket[id]?.team1Id ?? 'TBD'
        const t2 = bracket[id]?.team2Id ?? 'TBD'
        if (t1 === 'TBD' || t2 === 'TBD') continue
        const list = listFor[phase]
        if (!list) continue
        const in1 = list.has(t1), in2 = list.has(t2)
        if (in1 !== in2) p.advancingTeamId = in1 ? t1 : t2
      }
    }
  }
  const knockoutBracket = computeFullBracket(effPredMap)

  return (
    <div className="space-y-5">
      {/* Admin banner */}
      {adminMode && (
        <div className="bg-yellow-50 dark:bg-yellow-950/60 border border-yellow-400 dark:border-yellow-600 rounded-xl px-4 py-2.5 text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
          <Icon name="key" size={15} />
          <span>Modo Admin — editando palpites de <strong>{data.participant.name}</strong></span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{data.participant.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <div className="w-40 bg-gray-800 rounded-full h-1.5">
              <div className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${Math.min(100, (totalPredicted / totalGroupMatches) * 100)}%` }} />
            </div>
            <span className="text-xs text-gray-500">{totalPredicted}/{totalGroupMatches} jogos</span>
          </div>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors">← Classificação</a>
      </div>

      {/* Phase tabs */}
      <div className="flex gap-1 bg-gray-900 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab('groups')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-1.5 ${activeTab === 'groups' ? 'bg-green-700 text-[white] shadow' : 'text-gray-400 hover:text-gray-300'}`}>
          <Icon name="ball" size={15} /> Fase de Grupos
        </button>
        <button onClick={() => setActiveTab('knockout')}
          className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all inline-flex items-center gap-1.5 ${activeTab === 'knockout' ? 'bg-green-700 text-[white] shadow' : 'text-gray-400 hover:text-gray-300'}`}>
          <Icon name="trophy" size={15} /> Mata-Mata
        </button>
      </div>

      {/* GROUP STAGE */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => (
              <GroupTab key={g.id} groupId={g.id} isActive={activeGroup === g.id}
                filledCount={(groupMatchesByGroup[g.id] ?? []).filter(m => predMap[m.id]).length}
                onClick={() => { setActiveGroup(g.id); setActiveRound(1) }} />
            ))}
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {/* Left: standings */}
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
                      <tr key={row.teamId} className={`transition-colors ${qualifies ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                        <td className="px-3 py-3 text-center">
                          <span className={`text-xs font-bold w-5 h-5 rounded-full inline-flex items-center justify-center ${qualifies ? 'bg-green-700 text-[white]' : 'text-gray-600'}`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-2">
                            <Flag teamId={row.teamId} size={20} />
                            <span className="font-medium text-sm">{row.teamId}</span>
                          </div>
                        </td>
                        <td className="px-2 py-3 text-center font-bold text-gray-900 dark:text-white">{row.p}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.j}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.v}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.e}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.d}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.gp}</td>
                        <td className="px-2 py-3 text-center text-gray-400">{row.gc}</td>
                        <td className={`px-2 py-3 text-center font-medium ${row.sg > 0 ? 'text-green-600 dark:text-green-400' : row.sg < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
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
              <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-xl px-4 py-2.5">
                <button onClick={() => setActiveRound(r => Math.max(1, r - 1))} disabled={activeRound === 1}
                  className="text-gray-400 hover:text-gray-300 disabled:opacity-20 text-lg px-2">‹</button>
                <span className="text-sm font-bold text-gray-300 uppercase tracking-wider">
                  {activeRound}ª Rodada
                </span>
                <button onClick={() => setActiveRound(r => Math.min(3, r + 1))} disabled={activeRound === 3}
                  className="text-gray-400 hover:text-gray-300 disabled:opacity-20 text-lg px-2">›</button>
              </div>

              {roundMatches(activeGroup, activeRound).map(m => (
                <MatchCard key={m.id} match={m} prediction={predMap[m.id]} result={results[m.id]}
                  isKnockout={false} onSave={savePrediction} saving={saving} adminMode={adminMode} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KNOCKOUT STAGE */}
      {activeTab === 'knockout' && (
        <div className="space-y-8">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-4 text-sm text-blue-700 dark:text-blue-200">
            <strong>Mata-mata:</strong> Os times aparecem automaticamente conforme seus palpites da fase de grupos. Em empate no tempo regulamentar, selecione quem avança (prorrogação/pênaltis).
          </div>
          {KNOCKOUT_PHASES.map(phase => {
            const phaseMatches = knockoutByPhase[phase] ?? []
            if (phaseMatches.length === 0) return null
            const hasTeams = phaseMatches.some(m => (knockoutBracket[m.id]?.team1Id ?? 'TBD') !== 'TBD')
            return (
              <div key={phase} className="relative border border-yellow-600/25 rounded-2xl px-4 pb-4 pt-7 mt-6">
                <span className="absolute -top-3 left-4 bg-white dark:bg-[#030712] px-3 py-0.5 rounded-lg border border-yellow-600/30 text-yellow-700 dark:text-yellow-300 font-bold text-xs uppercase tracking-widest">
                  {PHASE_LABELS[phase]}
                </span>
                {!hasTeams ? (
                  <p className="text-gray-700 text-sm italic">Seleções definidas conforme seus palpites.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {phaseMatches.map(m => {
                      const computed = knockoutBracket[m.id]
                      return (
                        <MatchCard key={m.id} match={m} prediction={effPredMap[m.id]} result={results[m.id]}
                          isKnockout={true} onSave={savePrediction} saving={saving}
                          team1IdOverride={computed?.team1Id}
                          team2IdOverride={computed?.team2Id}
                          adminMode={adminMode} />
                      )
                    })}
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
