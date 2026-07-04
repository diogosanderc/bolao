'use client'

import { useEffect, useState } from 'react'
import { chipCode } from '@/lib/names'
import { Icon, IconName } from '@/components/Icon'
import { Flag } from '@/components/Flag'

type ParticipantInfo = { id: string; name: string }

type Snapshot = {
  matchId: string
  label: string
  dateBRT: string
  points: Record<string, number>
}

type ParticipantStat = {
  id: string; name: string
  correctResults: number; correctScores: number
  correctGoals: number; pointsPerMatch: number; totalPoints: number
}

type ClassificationStat = {
  id: string; name: string
  groupOrderPoints: number; r32Points: number
  knockoutPoints: number; total: number
}

type PopularPrediction = {
  matchId: string; label: string; dateBRT: string
  topPrediction: string; count: number; totalPredictions: number
  resultScore: string
}

type RecordItem = { icon: string; title: string; value: string; subtitle: string }

type EstatisticasData = {
  participants: ParticipantInfo[]
  snapshots: Snapshot[]
  participantStats: ParticipantStat[]
  classificationStats: ClassificationStat[]
  records: RecordItem[]
  popularPredictions: PopularPrediction[]
  surprises: string[]
  matchesPlayed: number
  championProjection?: { participantId: string; name: string; teamId: string; alive: boolean }[]
  extraStats?: {
    zebra: { id: string; name: string; pts: number; games: number }[]
    hardGames: number
    phaseSplit: { id: string; name: string; groupPct: number; koPct: number; koGames: number }[]
    brazil: { id: string; name: string; braAvg: number; otherAvg: number; diff: number; braGames: number }[]
    nearMiss: { id: string; name: string; count: number; ptsLost: number }[]
    titleRace: { id: string; name: string; points: number; gap: number; maxPossible: number; canReach: boolean }[]
    redZone?: { id: string; name: string; pos: number; points: number; status: string; gapToEscape: number }[]
    remainingMatches: number
    boldHits: { id: string; name: string; count: number; examples: string[] }[]
    hotStreak: { id: string; name: string; streak: number }[]
  }
}

const LINE_COLORS = [
  '#facc15', '#34d399', '#60a5fa', '#f87171', '#a78bfa',
  '#fb923c', '#38bdf8', '#f472b6', '#4ade80', '#c084fc',
  '#fbbf24', '#2dd4bf', '#818cf8', '#fb7185', '#86efac',
]

export default function EstatisticasPage() {
  const [data, setData] = useState<EstatisticasData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeIds, setActiveIds] = useState<Set<string>>(new Set())
  const [statsSearch, setStatsSearch] = useState('')
  const [showAllStats, setShowAllStats] = useState(false)
  const [partSearch, setPartSearch] = useState('')
  const [scenarioTeams, setScenarioTeams] = useState<string[]>([])
  const [scenarioTeam, setScenarioTeam] = useState('')
  const [scenarioRows, setScenarioRows] = useState<{ id: string; name: string; current: number; min: number; max: number }[]>([])
  const [scenarioLoading, setScenarioLoading] = useState(false)
  const [scenarioShowAll, setScenarioShowAll] = useState(false)
  const [odds, setOdds] = useState<Map<string, { championPct: number; redZonePct: number }> | null>(null)

  useEffect(() => {
    fetch('/api/champion-scenario')
      .then(r => r.json())
      .then(d => setScenarioTeams(d.aliveTeams ?? []))
      .catch(() => {})
    fetch('/api/odds')
      .then(r => r.json())
      .then(d => {
        if (d.ready && d.rows) setOdds(new Map(d.rows.map((r: any) => [r.id, { championPct: r.championPct, redZonePct: r.redZonePct }])))
      })
      .catch(() => {})
  }, [])

  function loadScenario(teamId: string) {
    setScenarioTeam(teamId)
    setScenarioRows([])
    if (!teamId) return
    setScenarioLoading(true)
    fetch(`/api/champion-scenario?teamId=${teamId}`)
      .then(r => r.json())
      .then(d => setScenarioRows(d.rows ?? []))
      .catch(() => {})
      .finally(() => setScenarioLoading(false))
  }

  useEffect(() => {
    fetch('/api/estatisticas')
      .then(r => r.json())
      .then(d => {
        setData(d)
        // Pre-select the top 2 so the comparison isn't empty on first load
        setActiveIds(new Set((d.participants as { id: string }[]).slice(0, 2).map(p => p.id)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function toggleParticipant(id: string) {
    setActiveIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) return (
    <div className="space-y-8">
      <div className="skeleton h-7 w-56" />
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="skeleton h-4 w-48" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton h-6 w-20 rounded-full" />)}
        </div>
        <div className="skeleton h-48 w-full" />
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
        <div className="skeleton h-4 w-48" />
        <div className="skeleton h-64 w-full" />
      </div>
    </div>
  )
  if (!data) return <div className="text-center py-20 text-gray-500">Erro ao carregar dados.</div>

  const { participants, participantStats, classificationStats, records, popularPredictions, surprises, matchesPlayed, snapshots } = data

  if (matchesPlayed === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <div className="flex justify-center mb-3"><Icon name="bars" size={40} className="text-gray-600" strokeWidth={1.4} /></div>
        <p>Nenhum resultado registrado ainda.</p>
        <p className="text-sm mt-1 text-gray-600">As estatísticas aparecerão conforme os jogos forem registrados.</p>
      </div>
    )
  }

  const sortedStats = [...participantStats]
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .filter(s => !statsSearch || s.name.toLowerCase().includes(statsSearch.toLowerCase()))
  const surpriseSet = new Set(surprises)

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-200 dark:text-yellow-400">Estatísticas do Bolão</h2>

      {/* Records & curiosities */}
      {records && records.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Icon name="medal" size={15} /> Recordes & Curiosidades</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {records.map(r => (
              <div key={r.title} className="flex items-start gap-3 bg-gray-900 border border-gray-800 rounded-xl px-3.5 py-3">
                <span className="mt-0.5 text-[#00bf63]"><Icon name={r.icon as IconName} size={24} strokeWidth={1.4} /></span>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">{r.title}</p>
                  <p className="text-sm font-bold text-gray-200 truncate">{r.value}</p>
                  <p className="text-[11px] text-gray-500">{r.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Champion projection — who can still hit their champion pick */}
      {data.championProjection && data.championProjection.length > 0 && (() => {
        const byTeam = new Map<string, { alive: boolean; names: string[] }>()
        for (const cp of data.championProjection) {
          if (!byTeam.has(cp.teamId)) byTeam.set(cp.teamId, { alive: cp.alive, names: [] })
          byTeam.get(cp.teamId)!.names.push(cp.name)
        }
        const teams = [...byTeam.entries()]
          .map(([teamId, v]) => ({ teamId, ...v }))
          .sort((a, b) => (Number(b.alive) - Number(a.alive)) || (b.names.length - a.names.length))
        const aliveCount = data.championProjection.filter(c => c.alive).length
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Icon name="crown" size={15} /> Projeção do Campeão</h3>
              <p className="text-xs text-gray-600 mt-0.5">
                {aliveCount} de {data.championProjection.length} participantes ainda podem acertar o campeão (+12 pts)
              </p>
            </div>
            <div className="divide-y divide-gray-800">
              {teams.map(t => (
                <details key={t.teamId} className="group">
                  <summary className="px-4 py-2.5 cursor-pointer select-none flex items-center gap-2 hover:bg-gray-800/50 transition-colors">
                    <Flag teamId={t.teamId} size={18} />
                    <span className={`text-sm font-semibold ${t.alive ? 'text-gray-200' : 'text-gray-600 line-through'}`}>{t.teamId}</span>
                    {t.alive
                      ? <span className="text-[10px] font-bold text-green-500 bg-green-950/50 border border-green-900 rounded-full px-2 py-0.5">vivo</span>
                      : <span className="text-[10px] font-bold text-red-500/80 bg-red-950/40 border border-red-900/50 rounded-full px-2 py-0.5">eliminado</span>}
                    <span className="ml-auto text-xs text-gray-500 flex items-center gap-2">
                      {t.names.length} participante{t.names.length !== 1 ? 's' : ''}
                      <Icon name="chevron-down" size={13} className="group-open:rotate-180 transition-transform" />
                    </span>
                  </summary>
                  <div className="px-4 pb-3 flex flex-wrap gap-1.5">
                    {t.names.map(n => (
                      <span key={n} className={`text-xs rounded-full px-2.5 py-1 border ${t.alive ? 'bg-gray-800 border-gray-700 text-gray-300' : 'bg-gray-900 border-gray-800 text-gray-600'}`}>{n}</span>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Champion scenario simulator */}
      {scenarioTeams.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Icon name="trophy" size={15} /> E se... fosse campeã?</h3>
            <p className="text-xs text-gray-600 mt-0.5">Escolha a seleção campeã e veja a projeção de pontos de cada participante nesse cenário — com os palpites deles até a final</p>
          </div>
          <div className="px-4 py-3 flex flex-wrap gap-1.5">
            {scenarioTeams.map(t => (
              <button
                key={t}
                onClick={() => loadScenario(scenarioTeam === t ? '' : t)}
                className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-semibold transition-colors ${
                  scenarioTeam === t
                    ? 'bg-yellow-500 text-black border-yellow-500'
                    : 'border-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <Flag teamId={t} size={14} /> {t}
              </button>
            ))}
          </div>
          {scenarioLoading && <p className="px-4 pb-4 text-xs text-gray-500 animate-pulse">Calculando…</p>}
          {!scenarioLoading && scenarioTeam && scenarioRows.length > 0 && (
            <div className="border-t border-gray-800">
              <div className="px-4 py-2.5 bg-yellow-950/20 border-b border-gray-800 text-xs text-yellow-500 flex items-center gap-1.5">
                <Icon name="crown" size={13} />
                Com <strong className="mx-1">{scenarioTeam}</strong> campeã, o líder projetado é <strong className="ml-1">{scenarioRows[0].name}</strong> ({scenarioRows[0].min} pts garantidos)
              </div>
              <table className="w-full text-sm table-fixed">
                <thead>
                  <tr className="text-[10px] sm:text-xs text-gray-500 tracking-wider border-b border-gray-800 bg-gray-950/50">
                    <th className="pl-3 pr-1 py-2 text-left w-8">#</th>
                    <th className="px-1 py-2 text-left">Participante</th>
                    <th className="px-1 py-2 text-right w-14">Atual</th>
                    <th className="px-1 py-2 text-right w-14" title="Atual + bônus garantidos pelo caminho do campeão">Mín.</th>
                    <th className="pl-1 pr-3 py-2 text-right w-14" title="Máximo teórico (acertando tudo que resta)">Máx.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {(scenarioShowAll ? scenarioRows : scenarioRows.slice(0, 10)).map((r, i) => (
                    <tr key={r.id} className={i === 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : ''}>
                      <td className="pl-3 pr-1 py-2 text-gray-500 text-xs">{i + 1}</td>
                      <td className="px-1 py-2 font-semibold text-gray-200 truncate">{r.name}{i === 0 && <Icon name="crown" size={12} className="inline ml-1.5 text-yellow-500" />}</td>
                      <td className="px-1 py-2 text-right text-gray-400">{r.current}</td>
                      <td className="px-1 py-2 text-right font-bold text-green-500">{r.min}</td>
                      <td className="pl-1 pr-3 py-2 text-right text-gray-300">{r.max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {scenarioRows.length > 10 && (
                <button
                  onClick={() => setScenarioShowAll(v => !v)}
                  className="w-full py-2.5 text-xs font-semibold text-gray-400 hover:text-gray-200 border-t border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  {scenarioShowAll ? 'Ver só o top 10' : `Ver todos (${scenarioRows.length})`}
                </button>
              )}
              <p className="px-4 py-2.5 text-[10px] text-gray-600 border-t border-gray-800">
                Mín. = pontos atuais + bônus garantidos dos palpites com esse campeão (fases + título). Máx. = teto teórico acertando todos os placares restantes e demais classificações possíveis.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Comparison panel — pick two participants to compare */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2"><Icon name="swords" size={15} /> Comparação Direta</h3>
          <p className="text-xs text-gray-600 mt-0.5">Escolha dois participantes para comparar</p>
        </div>
        <div className="px-4 py-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {participants.filter(p => activeIds.has(p.id)).map((p, i) => (
              <button
                key={p.id}
                onClick={() => toggleParticipant(p.id)}
                className="text-xs px-3 py-1 rounded-full border transition-all font-medium inline-flex items-center gap-1.5"
                style={{ borderColor: LINE_COLORS[i % LINE_COLORS.length], color: LINE_COLORS[i % LINE_COLORS.length], backgroundColor: `${LINE_COLORS[i % LINE_COLORS.length]}20` }}
                title={`Remover ${p.name}`}
              >
                {chipCode(p.name)} <Icon name="x" size={11} />
              </button>
            ))}
          </div>
          {activeIds.size < 2 && (
            <div className="relative">
              <input
                type="text"
                value={partSearch}
                onChange={e => setPartSearch(e.target.value)}
                placeholder="Buscar participante..."
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-2 pl-8 focus:outline-none focus:border-gray-500 placeholder-gray-600"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              {partSearch.trim() !== '' && (
                <div className="absolute z-10 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                  {participants
                    .filter(p => p.name.toLowerCase().includes(partSearch.toLowerCase()) && !activeIds.has(p.id))
                    .slice(0, 8)
                    .map(p => (
                      <button
                        key={p.id}
                        onClick={() => { toggleParticipant(p.id); setPartSearch('') }}
                        className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-800 transition-colors"
                      >
                        {p.name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      {activeIds.size === 2 && (() => {
        const ids = [...activeIds]
        const s1 = participantStats.find(s => s.id === ids[0])
        const s2 = participantStats.find(s => s.id === ids[1])
        if (!s1 || !s2) return null
        const c1 = LINE_COLORS[0]
        const c2 = LINE_COLORS[1]
        const leader = s1.totalPoints > s2.totalPoints ? 0 : s2.totalPoints > s1.totalPoints ? 1 : -1
        // Head-to-head rounds won: who scored more points on each finished game
        let w1 = 0, w2 = 0, ties = 0
        for (let i = 0; i < snapshots.length; i++) {
          const prevPts = i > 0 ? snapshots[i - 1].points : ({} as Record<string, number>)
          const d1 = (snapshots[i].points[ids[0]] ?? 0) - (prevPts[ids[0]] ?? 0)
          const d2 = (snapshots[i].points[ids[1]] ?? 0) - (prevPts[ids[1]] ?? 0)
          if (d1 > d2) w1++
          else if (d2 > d1) w2++
          else ties++
        }
        return (
          <div className="border-t border-gray-800">
            <div className="px-4 py-2 text-center text-xs text-gray-500 border-b border-gray-800">
              Rodadas vencidas: <span style={{ color: c1 }} className="font-bold">{w1}</span>
              <span className="mx-1">×</span>
              <span style={{ color: c2 }} className="font-bold">{w2}</span>
              <span className="text-gray-600 ml-1.5">({ties} empates)</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-gray-800">
              {[{ s: s1, c: c1, win: leader === 0 }, { s: s2, c: c2, win: leader === 1 }].map(({ s, c, win }) => (
                <div key={s.id} className={`p-4 text-center ${win ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                  <p className="font-bold text-sm mb-3 truncate" style={{ color: c }}>{s.name}</p>
                  <div className="space-y-2 text-sm">
                    <div className={`text-2xl font-black ${win ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-300'}`}>{s.totalPoints}<span className="text-xs font-normal text-gray-500 ml-1">pts</span></div>
                    <div className="flex justify-around text-xs text-gray-500 pt-1">
                      <span><span className="text-green-600 dark:text-green-400 font-bold text-base">{s.correctResults}</span><br/>resultados</span>
                      <span><span className="text-yellow-600 dark:text-yellow-400 font-bold text-base">{s.correctScores}</span><br/>placares</span>
                      <span><span className="text-gray-300 font-bold text-base">{s.pointsPerMatch}</span><br/>pts/jogo</span>
                    </div>
                  </div>
                  {win && <div className="mt-3 text-xs text-green-600 dark:text-green-400 font-semibold flex items-center justify-center gap-1"><Icon name="crown" size={13} /> Na frente</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}
      </div>

      {/* Participant Stats */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Desempenho por Participante</h3>
            <p className="text-xs text-gray-600 mt-0.5">
              {matchesPlayed} jogo{matchesPlayed !== 1 ? 's' : ''} registrado{matchesPlayed !== 1 ? 's' : ''}
              {(() => {
                const classTotal = classificationStats?.reduce((sum, c) => sum + c.total, 0) ?? 0
                const grandTotal = participantStats.reduce((sum, s) => sum + s.totalPoints, 0)
                if (grandTotal === 0) return null
                const pctClass = Math.round((classTotal / grandTotal) * 100)
                return <> · {100 - pctClass}% dos pontos vêm dos placares, {pctClass}% de classificação</>
              })()}
            </p>
          </div>
          <div className="relative shrink-0">
            <input
              type="text"
              value={statsSearch}
              onChange={e => setStatsSearch(e.target.value)}
              placeholder="Buscar..."
              className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded-lg px-3 py-1.5 pl-7 w-36 focus:outline-none focus:border-gray-500 placeholder-gray-600"
            />
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </div>
        </div>
        <div>
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-[10px] sm:text-xs text-gray-500 tracking-wider border-b border-gray-800 bg-gray-950/50">
                <th className="pl-2 pr-1 py-2 text-left w-7">#</th>
                <th className="px-1 py-2 text-left">Participante</th>
                <th className="px-1 py-2 text-right w-14" title="Resultados certos (% de aproveitamento)"><span className="inline-flex items-center justify-end gap-1"><Icon name="check" size={12} /><span className="hidden sm:inline">Result.</span></span></th>
                <th className="px-1 py-2 text-right w-10" title="Placares exatos"><span className="inline-flex items-center justify-end gap-1"><Icon name="target" size={12} /><span className="hidden sm:inline">Plac.</span></span></th>
                <th className="px-1 py-2 text-right w-10" title="Pontos por jogo">Méd.</th>
                <th className="pl-1 pr-2 py-2 text-right w-12 font-score">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedStats.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-gray-600 text-sm">Nenhum participante encontrado.</td></tr>
              )}
              {(statsSearch || showAllStats ? sortedStats : sortedStats.slice(0, 15)).map((s, idx) => {
                const pct = matchesPlayed > 0 ? Math.round((s.correctResults / matchesPlayed) * 100) : 0
                return (
                  <tr key={s.id} className={idx === 0 && !statsSearch ? 'bg-yellow-50 dark:bg-yellow-950/30' : ''}>
                    <td className="pl-2 pr-1 py-3 text-gray-500 text-xs">{idx + 1}</td>
                    <td className="px-1 py-3 font-semibold text-gray-200 truncate">{s.name}</td>
                    <td className="px-1 py-3 text-right whitespace-nowrap">
                      <span className="text-green-600 dark:text-green-400">{s.correctResults}</span>
                      <span className="text-gray-600 text-[10px] ml-0.5">({pct}%)</span>
                    </td>
                    <td className="px-1 py-3 text-right text-yellow-600 dark:text-yellow-400 font-semibold">{s.correctScores}</td>
                    <td className="px-1 py-3 text-right text-gray-300">{s.pointsPerMatch}</td>
                    <td className="pl-1 pr-2 py-3 text-right font-bold text-yellow-600 dark:text-yellow-500 font-score">{s.totalPoints}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {!statsSearch && sortedStats.length > 15 && (
            <button
              onClick={() => setShowAllStats(v => !v)}
              className="w-full py-2.5 text-xs font-semibold text-gray-400 hover:text-gray-200 border-t border-gray-800 hover:bg-gray-800/50 transition-colors"
            >
              {showAllStats ? 'Ver só o top 15' : `Ver todos (${sortedStats.length})`}
            </button>
          )}
        </div>
      </div>

      {/* Extra stats — collapsible cards */}
      {data.extraStats && (() => {
        const ex = data.extraStats
        const Section = ({ title, icon, subtitle, children }: { title: string; icon: IconName; subtitle: string; children: React.ReactNode }) => (
          <details className="group border-b border-gray-800 last:border-0">
            <summary className="px-4 py-3 cursor-pointer select-none flex items-center justify-between gap-2 hover:bg-gray-800/50 transition-colors">
              <span className="min-w-0">
                <span className="text-sm font-semibold text-gray-300 flex items-center gap-2"><Icon name={icon} size={14} className="text-yellow-500 shrink-0" /> {title}</span>
                <span className="block text-xs text-gray-600 mt-0.5">{subtitle}</span>
              </span>
              <Icon name="chevron-down" size={14} className="shrink-0 text-gray-500 group-open:rotate-180 transition-transform" />
            </summary>
            <div className="px-4 pb-4">{children}</div>
          </details>
        )
        const Row = ({ pos, name, right }: { pos: number; name: string; right: React.ReactNode }) => (
          <div className="flex items-center gap-2 py-1.5 border-b border-gray-800/50 last:border-0 text-sm">
            <span className="text-gray-600 text-xs w-5">{pos}º</span>
            <span className="text-gray-300 flex-1 truncate">{name}</span>
            <span className="shrink-0">{right}</span>
          </div>
        )
        const inRace = ex.titleRace.filter(t => t.canReach).length
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Mais Estatísticas</h3>
            </div>

            {ex.titleRace.length > 0 && (
              <Section title="Corrida pelo Título" icon="trophy" subtitle={`${inRace} de ${ex.titleRace.length} ainda alcançam o líder · ${ex.remainingMatches} jogos restantes${odds ? ' · % = chance de título em 3.000 simulações' : ''}`}>
                <div className="max-h-72 overflow-y-auto">
                  {ex.titleRace.map((t, i) => (
                    <Row key={t.id} pos={i + 1} name={t.name} right={
                      <span className="text-xs">
                        {odds?.get(t.id) !== undefined && (
                          <span className={`font-bold mr-2 ${(odds.get(t.id)!.championPct) >= 10 ? 'text-yellow-400' : 'text-gray-400'}`}>{odds.get(t.id)!.championPct}%</span>
                        )}
                        <span className="text-gray-500">-{t.gap} pts · máx </span>
                        <span className={t.canReach ? 'text-green-500 font-bold' : 'text-red-500/70 font-bold'}>{t.maxPossible}</span>
                        {!t.canReach && <span className="text-red-500/70 ml-1">fora</span>}
                      </span>
                    } />
                  ))}
                </div>
              </Section>
            )}

            {ex.redZone && ex.redZone.length > 0 && (
              <Section title="Disputa da Zona Vermelha" icon="alert" subtitle={`Os 7 últimos (pagões) e os 2 em alerta logo acima${odds ? ' · % = risco de terminar na zona (3.000 simulações)' : ''}`}>
                {ex.redZone.map(r => (
                  <div key={r.id} className="flex items-center gap-2 py-1.5 border-b border-gray-800/50 last:border-0 text-sm">
                    <span className="text-gray-600 text-xs w-7">{r.pos}º</span>
                    <span className={`flex-1 truncate ${r.status === 'zona' ? 'text-red-400' : 'text-yellow-500'}`}>{r.name}</span>
                    {odds?.get(r.id) !== undefined && (
                      <span className={`text-xs font-bold shrink-0 ${odds.get(r.id)!.redZonePct >= 50 ? 'text-red-500' : 'text-gray-400'}`}>{odds.get(r.id)!.redZonePct}%</span>
                    )}
                    <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 border shrink-0 ${r.status === 'zona' ? 'text-red-500 bg-red-950/40 border-red-900/50' : 'text-yellow-500 bg-yellow-950/40 border-yellow-900/50'}`}>
                      {r.status === 'zona' ? 'na zona' : 'alerta'}
                    </span>
                    <span className="text-xs text-gray-500 shrink-0 w-24 text-right">
                      {r.points} pts{r.status === 'zona' && r.gapToEscape > 0 ? ` · falta ${r.gapToEscape}` : ''}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-gray-600 mt-2">&quot;falta X&quot; = pontos para sair da zona (ultrapassar o primeiro fora dela)</p>
              </Section>
            )}

            {ex.zebra.length > 0 && (
              <Section title="Modo Zebra" icon="zap" subtitle={`Quem mais pontuou nos ${ex.hardGames} jogos em que a maioria errou o resultado`}>
                {ex.zebra.map((z, i) => (
                  <Row key={z.id} pos={i + 1} name={z.name} right={<span className="text-yellow-500 font-bold text-xs">{z.pts} pts <span className="text-gray-600 font-normal">em {z.games} jogos</span></span>} />
                ))}
              </Section>
            )}

            {ex.phaseSplit.length > 0 && (
              <Section title="Grupos vs Mata-Mata" icon="swords" subtitle="Aproveitamento de resultados certos em cada fase (top 10 no mata-mata)">
                {ex.phaseSplit.map((p, i) => (
                  <Row key={p.id} pos={i + 1} name={p.name} right={
                    <span className="text-xs tabular-nums">
                      <span className="text-gray-500">grupos </span><span className="text-gray-300 font-semibold">{p.groupPct}%</span>
                      <span className="text-gray-600 mx-1">·</span>
                      <span className="text-gray-500">mata-mata </span><span className={`font-bold ${p.koPct >= p.groupPct ? 'text-green-500' : 'text-red-500/80'}`}>{p.koPct}%</span>
                    </span>
                  } />
                ))}
              </Section>
            )}

            {ex.brazil.length > 0 && (
              <Section title="Coração vs Razão" icon="flame" subtitle="Média de pontos nos jogos do Brasil comparada aos demais jogos">
                {[...ex.brazil.slice(0, 5), ...ex.brazil.slice(-3)].filter((v, i, a) => a.findIndex(x => x.id === v.id) === i).map(b => (
                  <div key={b.id} className="flex items-center gap-2 py-1.5 border-b border-gray-800/50 last:border-0 text-sm">
                    <span className="text-gray-300 flex-1 truncate">{b.name}</span>
                    <span className="text-xs tabular-nums shrink-0">
                      <span className="text-green-600">BRA {b.braAvg}</span>
                      <span className="text-gray-600 mx-1">vs</span>
                      <span className="text-gray-400">{b.otherAvg}</span>
                      <span className={`ml-2 font-bold ${b.diff >= 0 ? 'text-green-500' : 'text-red-500/80'}`}>{b.diff > 0 ? '+' : ''}{b.diff}</span>
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-gray-600 mt-2">Top 5 que ganham pontos com o Brasil e os 3 que mais perdem</p>
              </Section>
            )}

            {ex.nearMiss.length > 0 && (
              <Section title="Pontos na Mesa" icon="target" subtitle="Acertou o vencedor mas errou o placar exato por 1 gol">
                {ex.nearMiss.map((n, i) => (
                  <Row key={n.id} pos={i + 1} name={n.name} right={<span className="text-xs"><span className="text-gray-300 font-bold">{n.count}×</span> <span className="text-gray-500">quase · ~{n.ptsLost} pts perdidos</span></span>} />
                ))}
              </Section>
            )}

            {ex.boldHits.length > 0 && (
              <Section title="Cravadas Raras" icon="medal" subtitle="Placares exatos que no máximo 3 pessoas acertaram juntas">
                {ex.boldHits.map((b, i) => (
                  <div key={b.id} className="py-1.5 border-b border-gray-800/50 last:border-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-600 text-xs w-5">{i + 1}º</span>
                      <span className="text-gray-300 flex-1 truncate">{b.name}</span>
                      <span className="text-yellow-500 font-bold text-xs shrink-0">{b.count} cravada{b.count !== 1 ? 's' : ''}</span>
                    </div>
                    {b.examples.length > 0 && <p className="text-[10px] text-gray-600 ml-7 mt-0.5 truncate">{b.examples.join(' · ')}</p>}
                  </div>
                ))}
              </Section>
            )}

            {ex.hotStreak.length > 0 && (
              <Section title="Quem Está Quente" icon="flame" subtitle="Sequência atual de resultados certos (em aberto)">
                {ex.hotStreak.map((h, i) => (
                  <Row key={h.id} pos={i + 1} name={h.name} right={<span className="text-orange-400 font-bold text-xs">🔥 {h.streak} seguidos</span>} />
                ))}
              </Section>
            )}
          </div>
        )
      })()}

      {/* Popular Predictions — grouped by phase, collapsed by default */}
      {popularPredictions.length > 0 && (() => {
        const phaseOf = (matchId: string): string => {
          if (matchId.startsWith('G')) return 'Fase de Grupos'
          if (matchId.startsWith('R32_')) return '16 avos de Final'
          if (matchId.startsWith('R16_')) return 'Oitavas de Final'
          if (matchId.startsWith('QF_')) return 'Quartas de Final'
          if (matchId.startsWith('SF_')) return 'Semifinal'
          if (matchId === 'TP_1') return '3º Lugar'
          return 'Final'
        }
        const PHASE_ORDER = ['Fase de Grupos', '16 avos de Final', 'Oitavas de Final', 'Quartas de Final', 'Semifinal', '3º Lugar', 'Final']
        const grouped = new Map<string, PopularPrediction[]>()
        for (const pp of popularPredictions) {
          const ph = phaseOf(pp.matchId)
          if (!grouped.has(ph)) grouped.set(ph, [])
          grouped.get(ph)!.push(pp)
        }
        const phases = PHASE_ORDER.filter(ph => grouped.has(ph))
        // Most recent phase (last with data) starts open
        const lastPhase = phases[phases.length - 1]
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Palpite Mais Popular por Jogo</h3>
            </div>
            {phases.map(ph => (
              <details key={ph} open={ph === lastPhase} className="group border-b border-gray-800 last:border-0">
                <summary className="px-4 py-3 cursor-pointer select-none flex items-center justify-between text-sm font-semibold text-gray-300 hover:bg-gray-800/50 transition-colors">
                  <span>{ph}</span>
                  <span className="text-xs text-gray-500 flex items-center gap-2">
                    {grouped.get(ph)!.length} jogo{grouped.get(ph)!.length !== 1 ? 's' : ''}
                    <Icon name="chevron-down" size={14} className="group-open:rotate-180 transition-transform" />
                  </span>
                </summary>
                <div className="divide-y divide-gray-800 border-t border-gray-800/60">
                  {grouped.get(ph)!.map(pp => {
                    const isSurprise = surpriseSet.has(pp.matchId)
                    const topHit = pp.topPrediction === pp.resultScore
                    return (
                      <div key={pp.matchId} className="px-4 py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm text-white font-medium truncate">{pp.label}</p>
                          <p className="text-xs text-gray-600 mt-0.5">{pp.dateBRT}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="flex items-center gap-2">
                            {isSurprise && <span className="text-xs text-orange-600 dark:text-orange-400 inline-flex items-center gap-1"><Icon name="alert" size={12} /> Surpresa!</span>}
                            <span className={`text-sm font-bold px-2 py-0.5 rounded ${topHit ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950' : 'text-gray-300 bg-gray-800'}`}>
                              {pp.topPrediction}
                            </span>
                            <span className="text-xs text-gray-500">
                              {pp.count}/{pp.totalPredictions}
                              {topHit && <Icon name="check" size={11} className="ml-1 inline text-green-600 dark:text-green-500" />}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </details>
            ))}
          </div>
        )
      })()}

      {/* Surprise summary */}
      {surprises.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-xl px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
          <Icon name="alert" size={14} className="inline -mt-0.5 mr-1" /> <span className="font-semibold">{surprises.length} jogo{surprises.length !== 1 ? 's' : ''} sem nenhum palpite exato</span>
          {' '}— ninguém acertou o placar correto nesses jogos.
        </div>
      )}
    </div>
  )
}
