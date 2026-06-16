'use client'

import { useEffect, useState } from 'react'
import { Flag } from '@/components/Flag'
import { PHASE_LABELS, Phase } from '@/lib/types'

type PredEntry = {
  matchId: string
  matchNumber: number
  phase: Phase
  groupId?: string
  team1: { id: string; name: string; flag: string }
  team2: { id: string; name: string; flag: string }
  dateBRT: string | null
  prediction: { score1: number; score2: number } | null
  result: { score1: number; score2: number } | null
  points?: number
  correctResult?: boolean
  correctScore?: boolean
  correctGoals?: [boolean, boolean]
}

type ParticipantData = {
  participant: { id: string; name: string }
  predictions: PredEntry[]
  summary: { totalPoints: number; correctResults: number; correctScores: number; matchesPlayed: number }
}

type Props = { participantId: string; name: string; onClose: () => void }

export function ParticipantModal({ participantId, name, onClose }: Props) {
  const [data, setData] = useState<ParticipantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'played' | 'upcoming'>('played')

  useEffect(() => {
    fetch(`/api/participante/${participantId}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [participantId])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const played = data?.predictions.filter(p => p.result !== null) ?? []
  const upcoming = data?.predictions.filter(p => p.result === null && p.prediction !== null) ?? []

  function rowColor(p: PredEntry) {
    if (!p.result) return ''
    if (p.correctScore) return 'bg-green-950/50 border-l-2 border-green-500'
    if (p.correctResult) return 'bg-blue-950/30 border-l-2 border-blue-700'
    return 'border-l-2 border-transparent'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative bg-gray-950 border border-gray-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">{name}</h2>
            {data && (
              <div className="flex gap-4 mt-1 text-xs text-gray-500">
                <span><span className="text-yellow-400 font-bold">{data.summary.totalPoints}pts</span> totais</span>
                <span><span className="text-green-400 font-semibold">{data.summary.correctResults}</span> resultados certos</span>
                <span><span className="text-yellow-300 font-semibold">{data.summary.correctScores}</span> placares exatos</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-2xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
          <button
            onClick={() => setTab('played')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'played' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Jogados ({played.length})
          </button>
          <button
            onClick={() => setTab('upcoming')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'upcoming' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Próximos palpites ({upcoming.length})
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-1">
          {loading && <div className="text-center py-12 text-gray-500">Carregando...</div>}

          {!loading && tab === 'played' && (
            <div className="divide-y divide-gray-800/60">
              {played.length === 0 && <p className="text-center py-10 text-gray-600">Nenhum jogo disputado ainda.</p>}
              {played.map(p => (
                <div key={p.matchId} className={`px-4 py-3 ${rowColor(p)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm min-w-0">
                      <Flag teamId={p.team1.id} size={16} />
                      <span className="text-gray-300 truncate">{p.team1.name}</span>
                      <span className="text-gray-600 text-xs mx-1">vs</span>
                      <Flag teamId={p.team2.id} size={16} />
                      <span className="text-gray-300 truncate">{p.team2.name}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 text-sm">
                      {/* Result */}
                      <span className="text-gray-500 text-xs">
                        {p.result!.score1} × {p.result!.score2}
                      </span>
                      {/* Prediction */}
                      <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                        p.correctScore ? 'text-green-300 bg-green-950' :
                        p.correctResult ? 'text-blue-300 bg-blue-950/50' :
                        'text-gray-400 bg-gray-800'
                      }`}>
                        {p.prediction ? `${p.prediction.score1} × ${p.prediction.score2}` : '—'}
                      </span>
                      {/* Points */}
                      <span className={`w-10 text-right font-bold ${(p.points ?? 0) > 0 ? 'text-yellow-400' : 'text-gray-600'}`}>
                        {p.points !== undefined ? `+${p.points}` : '—'}
                      </span>
                    </div>
                  </div>
                  {p.correctScore && <p className="text-xs text-green-500 mt-0.5 pl-0.5">🎯 Placar exato!</p>}
                  {!p.correctScore && p.correctResult && <p className="text-xs text-blue-400 mt-0.5 pl-0.5">✅ Resultado certo</p>}
                  {!p.correctResult && p.result && <p className="text-xs text-red-800 mt-0.5 pl-0.5">✗ Errou</p>}
                </div>
              ))}
            </div>
          )}

          {!loading && tab === 'upcoming' && (
            <div className="divide-y divide-gray-800/60">
              {upcoming.length === 0 && <p className="text-center py-10 text-gray-600">Sem palpites futuros registrados.</p>}
              {upcoming.map(p => (
                <div key={p.matchId} className="px-4 py-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-sm min-w-0">
                    <Flag teamId={p.team1.id} size={16} />
                    <span className="text-gray-300 truncate">{p.team1.name}</span>
                    <span className="text-gray-600 text-xs mx-1">vs</span>
                    <Flag teamId={p.team2.id} size={16} />
                    <span className="text-gray-300 truncate">{p.team2.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {p.dateBRT && <span className="text-xs text-gray-600">{p.dateBRT}</span>}
                    <span className="font-bold text-yellow-400 text-sm px-2 py-0.5 bg-yellow-950/40 rounded">
                      {p.prediction ? `${p.prediction.score1} × ${p.prediction.score2}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex gap-4 px-5 py-3 border-t border-gray-800 text-xs text-gray-600 shrink-0">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-600 inline-block"></span> Placar exato</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-700 inline-block"></span> Resultado certo</span>
          <span className="text-gray-700">Resultado | Palpite | Pontos</span>
        </div>
      </div>
    </div>
  )
}
