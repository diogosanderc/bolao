'use client'

import { useEffect, useRef, useState } from 'react'
import { Flag } from '@/components/Flag'
import { PHASE_LABELS, Phase } from '@/lib/types'

type TeamRef = { id: string; name: string; flag: string }

type PredEntry = {
  matchId: string
  matchNumber: number
  phase: Phase
  groupId?: string
  team1: TeamRef
  team2: TeamRef
  date: string | null
  dateBRT: string | null
  prediction: { score1: number; score2: number } | null
  result: { score1: number; score2: number } | null
  points?: number
  correctResult?: boolean
  correctScore?: boolean
  correctGoals?: [boolean, boolean]
}

type GroupDetail = {
  groupId: string
  predicted: TeamRef[]
  actual: TeamRef[]
  correct: boolean
  pts: number
}

type R32Entry = {
  teamId: string
  name: string
  flag: string
  groupId: string
  pts: number
}

type GroupPredRow = {
  groupId: string
  predicted: TeamRef[]
  actual: TeamRef[] | null
  complete: boolean
  r32Qualified: boolean[]
}

type ParticipantData = {
  participant: { id: string; name: string }
  predictions: PredEntry[]
  summary: {
    totalPoints: number
    matchPoints: number
    correctResults: number
    correctScores: number
    matchesPlayed: number
    groupOrderPoints: number
    r32Points: number
    phasePoints: number
  }
  groupDetail: GroupDetail[]
  r32Detail: R32Entry[]
  groupPredictions: GroupPredRow[]
}

type Props = { participantId: string; name: string; onClose: () => void }

export function ParticipantModal({ participantId, name, onClose }: Props) {
  const [data, setData] = useState<ParticipantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'played' | 'selecoes' | 'upcoming'>('played')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch(`/api/participante/${participantId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
        })
      })
      .catch(() => setLoading(false))
  }, [participantId])

  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.width = ''
      document.body.style.overflow = ''
      window.scrollTo(0, scrollY)
    }
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const played = data?.predictions.filter(p => p.result !== null) ?? []
  const upcoming = (data?.predictions.filter(p => p.result === null && p.prediction !== null) ?? [])
    .slice()
    .sort((a, b) => {
      if (a.date && !b.date) return -1
      if (!a.date && b.date) return 1
      if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1
      return a.matchNumber - b.matchNumber
    })

  function rowColor(p: PredEntry) {
    if (!p.result) return ''
    if (p.correctScore) return 'bg-green-100 dark:bg-green-950/50 border-l-2 border-green-500'
    if (p.correctResult) return 'bg-blue-100 dark:bg-blue-950/30 border-l-2 border-blue-500 dark:border-blue-700'
    return 'border-l-2 border-transparent'
  }

  const hasPhaseBonus = (data?.summary.phasePoints ?? 0) > 0
  const hasGroupDetail = (data?.groupDetail.length ?? 0) > 0
  const hasR32Detail = (data?.r32Detail.length ?? 0) > 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
      style={{ touchAction: 'none' }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Sheet */}
      <div
        className="relative bg-gray-950 border border-gray-800 border-b-0 rounded-t-2xl w-full max-w-2xl flex flex-col animate-slide-up"
        style={{ maxHeight: '82vh', paddingBottom: 'env(safe-area-inset-bottom)', touchAction: 'pan-y' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-700" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-3 border-b border-gray-800 shrink-0">
          <div className="flex-1 min-w-0 pr-3">
            <h2 className="text-lg font-bold text-white">{name}</h2>
            {data && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                <span><span className="text-yellow-600 dark:text-yellow-400 font-bold">{data.summary.totalPoints}pts</span> totais</span>
                <span><span className="text-green-700 dark:text-green-400 font-semibold">{data.summary.correctResults}</span> resultados certos</span>
                <span><span className="text-yellow-700 dark:text-yellow-300 font-semibold">{data.summary.correctScores}</span> placares exatos</span>
                {data.summary.phasePoints > 0 && (
                  <span><span className="text-gray-300 font-semibold">+{data.summary.phasePoints}</span> bônus fase</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xl font-bold transition-colors"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-800 shrink-0">
          <button
            onClick={() => { setTab('played'); requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }) }}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'played' ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Jogados ({played.length})
          </button>
          <button
            onClick={() => { setTab('selecoes'); requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }) }}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'selecoes' ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Seleções
          </button>
          <button
            onClick={() => { setTab('upcoming'); requestAnimationFrame(() => { if (scrollRef.current) scrollRef.current.scrollTop = 0 }) }}
            className={`flex-1 py-2.5 text-xs font-medium transition-colors ${tab === 'upcoming' ? 'text-yellow-600 dark:text-yellow-400 border-b-2 border-yellow-600 dark:border-yellow-400' : 'text-gray-500 hover:text-gray-300'}`}
          >
            Próximos ({upcoming.length})
          </button>
        </div>

        {/* Body */}
        <div ref={scrollRef} className="overflow-y-auto flex-1 px-1">
          {loading && <div className="text-center py-12 text-gray-500">Carregando...</div>}

          {!loading && tab === 'played' && (
            <div className="divide-y divide-gray-800/60">
              {played.length === 0 && <p className="text-center py-10 text-gray-600">Nenhum jogo disputado ainda.</p>}
              {played.map(p => (
                <div key={p.matchId} className={`px-3 py-2.5 ${rowColor(p)}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-xs min-w-0 shrink-0">
                      <Flag teamId={p.team1.id} size={14} />
                      <span className="text-gray-300 font-semibold">{p.team1.id}</span>
                      <span className="text-gray-600 mx-0.5">×</span>
                      <Flag teamId={p.team2.id} size={14} />
                      <span className="text-gray-300 font-semibold">{p.team2.id}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-xs">
                      <span className="text-gray-500">{p.result!.score1}–{p.result!.score2}</span>
                      <span className={`font-bold px-2 py-0.5 rounded ${
                        p.correctScore ? 'text-green-800 bg-green-200 dark:text-green-300 dark:bg-green-950' :
                        p.correctResult ? 'text-blue-800 bg-blue-200 dark:text-blue-300 dark:bg-blue-950/50' :
                        'text-gray-400 bg-gray-800'
                      }`}>
                        {p.prediction ? `${p.prediction.score1}–${p.prediction.score2}` : '—'}
                      </span>
                      <span className={`w-8 text-right font-bold ${(p.points ?? 0) > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-600'}`}>
                        {p.points !== undefined ? `+${p.points}` : '—'}
                      </span>
                    </div>
                  </div>
                  {p.correctScore && <p className="text-[10px] text-green-700 dark:text-green-400 mt-0.5 pl-0.5">🎯 Placar exato!</p>}
                  {!p.correctScore && p.correctResult && <p className="text-[10px] text-blue-700 dark:text-blue-400 mt-0.5 pl-0.5">✅ Resultado certo</p>}
                  {!p.correctResult && p.result && <p className="text-[10px] text-red-600 dark:text-red-500 mt-0.5 pl-0.5">✗ Errou</p>}
                </div>
              ))}

              {/* Group order bonus section */}
              {hasGroupDetail && (
                <div className="px-3 pt-4 pb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">📊 Ordem dos Grupos</span>
                    <span className="text-xs font-bold text-gray-300">+{data!.summary.groupOrderPoints} pts</span>
                  </div>
                  <div className="space-y-1.5">
                    {data!.groupDetail.map(g => (
                      <div key={g.groupId} className="rounded-lg px-3 py-2 text-xs bg-gray-900 border border-gray-800">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-400">Grupo {g.groupId}</span>
                          <span className={`font-bold ${g.correct ? 'text-green-400' : 'text-red-500'}`}>
                            {g.correct ? '✓ +2' : '✗ 0'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          <div>
                            <p className="text-gray-600 mb-0.5">Seu palpite</p>
                            <div className="flex gap-1 flex-wrap">
                              {g.predicted.map((t, i) => (
                                <span key={t.id} className={i < 2 ? 'text-gray-300' : 'text-gray-500'}>
                                  {i + 1}º {t.flag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-gray-600 mb-0.5">Real</p>
                            <div className="flex gap-1 flex-wrap">
                              {g.actual.map((t, i) => (
                                <span key={t.id} className={i < 2 ? 'text-gray-300' : 'text-gray-500'}>
                                  {i + 1}º {t.flag}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* R32 advancement bonus section */}
              {hasR32Detail && (
                <div className="px-3 pt-3 pb-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">🏆 Classificados para 16-avos</span>
                    <span className="text-xs font-bold text-gray-300">+{data!.summary.r32Points} pts</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {data!.r32Detail.map(t => (
                      <div key={`${t.groupId}-${t.teamId}`} className="flex items-center gap-1 bg-gray-900 border border-gray-800 rounded-lg px-2.5 py-1.5 text-xs">
                        <span>{t.flag}</span>
                        <span className="text-gray-300 font-medium">{t.name}</span>
                        <span className="text-gray-400 font-bold ml-1">+3</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {!loading && tab === 'selecoes' && (
            <div className="p-3 space-y-3">
              {(!data?.groupPredictions?.length) && (
                <p className="text-center py-10 text-gray-600">Sem palpites de classificação registrados.</p>
              )}
              {/* Summary */}
              {data && (
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900 border border-gray-800">
                  <span className="text-xs text-gray-400">Bônus classificação 16-avos</span>
                  <span className="text-sm font-bold text-yellow-400">+{data.summary.r32Points} pts</span>
                </div>
              )}
              {data?.groupPredictions?.map(g => {
                const picks = g.predicted.slice(0, 3)
                if (picks.length === 0) return null
                return (
                  <div key={g.groupId} className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800/50">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Grupo {g.groupId}</span>
                      {!g.complete && <span className="text-[9px] font-semibold uppercase text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">em jogo</span>}
                    </div>
                    <div className="flex flex-col divide-y divide-gray-800/40">
                      {picks.map((team, i) => {
                        const qualified = g.r32Qualified[i]
                        const posLabel = ['1º', '2º', '3º'][i]
                        const posColor = i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : 'text-amber-600'
                        return (
                          <div key={team.id} className={`flex items-center gap-2.5 px-3 py-2 ${qualified ? 'bg-green-950/20' : ''}`}>
                            <span className={`text-[11px] font-bold w-5 shrink-0 ${posColor}`}>{posLabel}</span>
                            <span>{team.flag}</span>
                            <span className={`text-xs font-semibold flex-1 ${qualified ? 'text-green-300' : g.complete ? 'text-gray-500' : 'text-gray-300'}`}>
                              {team.name}
                            </span>
                            {qualified
                              ? <span className="text-xs font-bold text-green-400 bg-green-900/40 px-2 py-0.5 rounded">+3 pts</span>
                              : g.complete
                              ? <span className="text-xs text-gray-600">✗</span>
                              : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!loading && tab === 'upcoming' && (
            <div className="divide-y divide-gray-800/60">
              {upcoming.length === 0 && <p className="text-center py-10 text-gray-600">Sem palpites futuros registrados.</p>}
              {upcoming.map(p => (
                <div key={p.matchId} className="px-3 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-xs min-w-0 shrink-0">
                    <Flag teamId={p.team1.id} size={14} />
                    <span className="text-gray-300 font-semibold">{p.team1.id}</span>
                    <span className="text-gray-600 mx-0.5">×</span>
                    <Flag teamId={p.team2.id} size={14} />
                    <span className="text-gray-300 font-semibold">{p.team2.id}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {p.dateBRT && <span className="text-xs text-gray-600">{p.dateBRT}</span>}
                    <span className="font-bold text-yellow-800 bg-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/40 text-xs px-2 py-0.5 rounded">
                      {p.prediction ? `${p.prediction.score1}–${p.prediction.score2}` : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 px-5 py-3 shrink-0 space-y-2">
          <div className="flex gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> Placar exato</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-700 inline-block" /> Resultado certo</span>
            <span>Resultado | Palpite | Pts</span>
          </div>
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold text-sm transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
