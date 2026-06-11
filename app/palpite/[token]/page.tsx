'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { GROUPS, GROUP_MATCHES, KNOCKOUT_MATCHES, teamById, groupById, matchById } from '@/lib/copa2026'
import { Match, MatchPrediction, GroupPrediction, Participant, PHASE_LABELS, KNOCKOUT_PHASES } from '@/lib/types'

interface PredictionsData {
  participant: Participant
  matchPredictions: MatchPrediction[]
  groupPredictions: GroupPrediction[]
}

function ScoreInput({
  matchId,
  team1Id,
  team2Id,
  isKnockout,
  prediction,
  result,
  onSave,
  saving,
}: {
  matchId: string
  team1Id: string
  team2Id: string
  isKnockout: boolean
  prediction?: MatchPrediction
  result?: { score1?: number; score2?: number }
  onSave: (matchId: string, s1: number, s2: number, advancingTeamId?: string) => void
  saving: boolean
}) {
  const [s1, setS1] = useState(prediction?.score1 ?? '')
  const [s2, setS2] = useState(prediction?.score2 ?? '')
  const [adv, setAdv] = useState(prediction?.advancingTeamId ?? '')
  const [dirty, setDirty] = useState(false)

  const team1 = teamById[team1Id]
  const team2 = teamById[team2Id]

  const isDraw = s1 !== '' && s2 !== '' && Number(s1) === Number(s2)
  const locked = result?.score1 !== undefined

  function handle(field: 'a' | 'b' | 'adv', val: string) {
    if (field === 'a') setS1(val)
    else if (field === 'b') setS2(val)
    else setAdv(val)
    setDirty(true)
  }

  function save() {
    if (s1 === '' || s2 === '') return
    const advance = isKnockout && isDraw ? adv : undefined
    onSave(matchId, Number(s1), Number(s2), advance || undefined)
    setDirty(false)
  }

  if (!team1 || !team2) {
    return (
      <div className="flex items-center gap-2 text-gray-600 text-sm italic py-2">
        <span>A definir...</span>
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 p-3 rounded-lg border ${locked ? 'border-gray-700 bg-gray-900/40' : 'border-gray-700 bg-gray-900 hover:border-gray-600'} transition-colors`}>
      <div className="flex items-center gap-2">
        <span className="text-sm w-28 truncate" title={team1.name}>
          {team1.flag} {team1.name}
        </span>
        <input
          type="number"
          min="0"
          max="20"
          value={s1}
          disabled={locked}
          onChange={e => handle('a', e.target.value)}
          className="w-12 text-center rounded bg-gray-800 border border-gray-600 py-1 text-lg font-bold focus:outline-none focus:border-yellow-500 disabled:opacity-50"
        />
        <span className="text-gray-500 font-bold">×</span>
        <input
          type="number"
          min="0"
          max="20"
          value={s2}
          disabled={locked}
          onChange={e => handle('b', e.target.value)}
          className="w-12 text-center rounded bg-gray-800 border border-gray-600 py-1 text-lg font-bold focus:outline-none focus:border-yellow-500 disabled:opacity-50"
        />
        <span className="text-sm w-28 truncate text-right" title={team2.name}>
          {team2.name} {team2.flag}
        </span>
      </div>

      {/* Knockout draw: select who advances */}
      {isKnockout && isDraw && !locked && (
        <div className="flex items-center gap-2 text-sm bg-blue-950/40 border border-blue-800 rounded p-2">
          <span className="text-blue-300 text-xs">Empate — quem avança?</span>
          <select
            value={adv}
            onChange={e => handle('adv', e.target.value)}
            className="ml-auto bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-yellow-500"
          >
            <option value="">Selecione...</option>
            <option value={team1Id}>{team1.flag} {team1.name}</option>
            <option value={team2Id}>{team2.flag} {team2.name}</option>
          </select>
        </div>
      )}

      {locked && (
        <div className="text-xs text-green-400 flex items-center gap-1">
          <span>✓</span>
          <span>Resultado oficial: {result?.score1} × {result?.score2}</span>
        </div>
      )}

      {!locked && dirty && (
        <button
          onClick={save}
          disabled={saving || s1 === '' || s2 === '' || (isKnockout && isDraw && !adv)}
          className="self-end text-xs bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded px-3 py-1 font-semibold transition-colors"
        >
          {saving ? '...' : 'Salvar'}
        </button>
      )}

      {!locked && !dirty && prediction !== undefined && (
        <div className="text-xs text-gray-500 flex items-center gap-1">
          <span>✓</span>
          <span>Salvo: {prediction.score1} × {prediction.score2}{prediction.advancingTeamId ? ` (avança: ${teamById[prediction.advancingTeamId]?.name})` : ''}</span>
        </div>
      )}
    </div>
  )
}

function GroupOrderPicker({
  groupId,
  prediction,
  onSave,
}: {
  groupId: string
  prediction?: GroupPrediction
  onSave: (groupId: string, order: string[]) => void
}) {
  const group = groupById[groupId]
  const [order, setOrder] = useState<string[]>(prediction?.order ?? group.teamIds)
  const [dirty, setDirty] = useState(false)

  function move(idx: number, dir: -1 | 1) {
    const next = [...order]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= next.length) return
    ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
    setOrder(next)
    setDirty(true)
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-2">
      <p className="text-xs text-gray-400 mb-2">Arraste ou use as setas para ordenar a classificação final do grupo:</p>
      {order.map((teamId, idx) => {
        const team = teamById[teamId]
        return (
          <div key={teamId} className="flex items-center gap-2 bg-gray-800 rounded px-3 py-2">
            <span className="text-xs text-gray-500 w-4 font-bold">{idx + 1}º</span>
            <span className="flex-1 text-sm">{team?.flag} {team?.name}</span>
            <button onClick={() => move(idx, -1)} disabled={idx === 0} className="text-gray-500 hover:text-white disabled:opacity-20 px-1">↑</button>
            <button onClick={() => move(idx, 1)} disabled={idx === order.length - 1} className="text-gray-500 hover:text-white disabled:opacity-20 px-1">↓</button>
          </div>
        )
      })}
      {dirty && (
        <button
          onClick={() => { onSave(groupId, order); setDirty(false) }}
          className="w-full mt-2 text-sm bg-yellow-600 hover:bg-yellow-500 text-white rounded py-1.5 font-semibold transition-colors"
        >
          Salvar ordem
        </button>
      )}
      {!dirty && prediction && (
        <p className="text-xs text-gray-500 text-center">✓ Ordem salva</p>
      )}
    </div>
  )
}

export default function PalpitePage() {
  const params = useParams()
  const token = params.token as string

  const [data, setData] = useState<PredictionsData | null>(null)
  const [results, setResults] = useState<Record<string, { score1?: number; score2?: number }>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'groups' | 'knockout'>('groups')
  const [activeGroup, setActiveGroup] = useState('A')
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/predictions?token=${token}`).then(r => r.json()),
      fetch('/api/results').then(r => r.json()),
    ]).then(([preds, res]) => {
      if (preds.error) { setError(preds.error); setLoading(false); return }
      setData(preds)
      const resMap: Record<string, { score1?: number; score2?: number }> = {}
      for (const r of res) resMap[r.matchId] = r
      setResults(resMap)
      setLoading(false)
    }).catch(() => { setError('Erro ao carregar'); setLoading(false) })
  }, [token])

  const savePrediction = useCallback(async (matchId: string, s1: number, s2: number, advancingTeamId?: string) => {
    setSaving(true)
    try {
      const r = await fetch('/api/predictions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, matchId, score1: s1, score2: s2, advancingTeamId }),
      })
      if (r.ok) {
        setData(prev => {
          if (!prev) return prev
          const filtered = prev.matchPredictions.filter(p => p.matchId !== matchId)
          return {
            ...prev,
            matchPredictions: [
              ...filtered,
              { participantId: prev.participant.id, matchId, score1: s1, score2: s2, ...(advancingTeamId ? { advancingTeamId } : {}) },
            ],
          }
        })
        showToast('✓ Palpite salvo!')
      }
    } finally {
      setSaving(false)
    }
  }, [token])

  const saveGroupOrder = useCallback(async (groupId: string, order: string[]) => {
    await fetch('/api/group-predictions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, groupId, order }),
    })
    setData(prev => {
      if (!prev) return prev
      const filtered = prev.groupPredictions.filter(p => p.groupId !== groupId)
      return {
        ...prev,
        groupPredictions: [
          ...filtered,
          { participantId: prev.participant.id, groupId, order },
        ],
      }
    })
    showToast('✓ Ordem do grupo salva!')
  }, [token])

  if (loading) return <div className="text-center py-20 text-gray-400">Carregando...</div>
  if (error) return (
    <div className="text-center py-20">
      <p className="text-red-400 text-lg">{error}</p>
      <p className="text-gray-500 text-sm mt-2">Verifique o link e tente novamente.</p>
    </div>
  )
  if (!data) return null

  const predMap = Object.fromEntries(data.matchPredictions.map(p => [p.matchId, p]))
  const groupPredMap = Object.fromEntries(data.groupPredictions.map(p => [p.groupId, p]))

  const groupMatchesByGroup = GROUP_MATCHES.reduce((acc, m) => {
    const g = m.groupId!
    if (!acc[g]) acc[g] = []
    acc[g].push(m)
    return acc
  }, {} as Record<string, Match[]>)

  const knockoutByPhase = KNOCKOUT_MATCHES.reduce((acc, m) => {
    if (!acc[m.phase]) acc[m.phase] = []
    acc[m.phase].push(m)
    return acc
  }, {} as Record<string, Match[]>)

  const totalPredicted = data.matchPredictions.length
  const totalMatches = GROUP_MATCHES.length + KNOCKOUT_MATCHES.filter(m => m.team1Id !== 'TBD').length

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-4 right-4 bg-green-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 text-sm animate-bounce">
          {toast}
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-yellow-400">{data.participant.name}</h2>
          <p className="text-gray-400 text-sm mt-1">
            {totalPredicted} de {totalMatches} palpites preenchidos
          </p>
          <div className="w-48 bg-gray-800 rounded-full h-1.5 mt-2">
            <div
              className="bg-yellow-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(100, (totalPredicted / totalMatches) * 100)}%` }}
            />
          </div>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-white">← Classificação</a>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 border-b border-gray-800">
        <button
          onClick={() => setActiveTab('groups')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'groups' ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          ⚽ Fase de Grupos
        </button>
        <button
          onClick={() => setActiveTab('knockout')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'knockout' ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-gray-400 hover:text-white'}`}
        >
          🏆 Mata-Mata
        </button>
      </div>

      {/* GROUP STAGE */}
      {activeTab === 'groups' && (
        <div className="space-y-4">
          {/* Group selector */}
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => {
              const matches = groupMatchesByGroup[g.id] ?? []
              const filled = matches.filter(m => predMap[m.id]).length
              return (
                <button
                  key={g.id}
                  onClick={() => setActiveGroup(g.id)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
                    activeGroup === g.id
                      ? 'bg-yellow-600 border-yellow-500 text-white'
                      : filled === 6
                      ? 'bg-green-900/40 border-green-700 text-green-300'
                      : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                  }`}
                >
                  {g.id} {filled === 6 ? '✓' : `${filled}/6`}
                </button>
              )
            })}
          </div>

          {/* Active group */}
          {(() => {
            const group = groupById[activeGroup]
            const matches = groupMatchesByGroup[activeGroup] ?? []
            return (
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="font-bold text-lg">{group.name}</h3>
                    <div className="flex gap-1">
                      {group.teamIds.map(id => (
                        <span key={id} title={teamById[id]?.name} className="text-lg">{teamById[id]?.flag}</span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {matches.map(m => (
                      <ScoreInput
                        key={m.id}
                        matchId={m.id}
                        team1Id={m.team1Id}
                        team2Id={m.team2Id}
                        isKnockout={false}
                        prediction={predMap[m.id]}
                        result={results[m.id]}
                        onSave={savePrediction}
                        saving={saving}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg mb-3">Ordem final do grupo</h3>
                  <GroupOrderPicker
                    groupId={activeGroup}
                    prediction={groupPredMap[activeGroup]}
                    onSave={saveGroupOrder}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Acerto da ordem completa = <span className="text-yellow-400">+2 pts</span>
                  </p>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* KNOCKOUT STAGE */}
      {activeTab === 'knockout' && (
        <div className="space-y-8">
          <div className="bg-blue-950/30 border border-blue-800 rounded-lg p-3 text-sm text-blue-200">
            <strong>Regras do mata-mata:</strong> Em caso de empate no tempo regulamentar, selecione qual equipe você acha que avança (prorrogação/pênaltis). O palpite de <em>quem avança</em> não gera pontos extras — apenas o placar do tempo regulamentar é pontuado.
          </div>
          {KNOCKOUT_PHASES.map(phase => {
            const phaseMatches = knockoutByPhase[phase] ?? []
            if (phaseMatches.length === 0) return null
            const hasAnyTeam = phaseMatches.some(m => m.team1Id !== 'TBD')
            return (
              <div key={phase}>
                <h3 className="font-bold text-lg text-yellow-300 mb-3">{PHASE_LABELS[phase]}</h3>
                {!hasAnyTeam ? (
                  <p className="text-gray-600 text-sm italic">As seleções serão definidas após a fase de grupos.</p>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {phaseMatches.map(m => (
                      <ScoreInput
                        key={m.id}
                        matchId={m.id}
                        team1Id={m.team1Id}
                        team2Id={m.team2Id}
                        isKnockout={true}
                        prediction={predMap[m.id]}
                        result={results[m.id]}
                        onSave={savePrediction}
                        saving={saving}
                      />
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
