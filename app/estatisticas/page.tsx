'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts'

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

type EstatisticasData = {
  participants: ParticipantInfo[]
  snapshots: Snapshot[]
  participantStats: ParticipantStat[]
  classificationStats: ClassificationStat[]
  popularPredictions: PopularPrediction[]
  surprises: string[]
  matchesPlayed: number
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
  const [showAllClass, setShowAllClass] = useState(false)

  useEffect(() => {
    fetch('/api/estatisticas')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setActiveIds(new Set())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const chartData = useMemo(() => {
    if (!data || data.snapshots.length === 0) return []
    return data.snapshots.map((snap, idx) => {
      const row: Record<string, string | number> = {
        name: `J${idx + 1}`,
        label: snap.label,
        dateBRT: snap.dateBRT,
      }
      for (const p of data.participants) row[p.id] = snap.points[p.id] ?? 0
      return row
    })
  }, [data])

  const rankChartData = useMemo(() => {
    if (!data || data.snapshots.length === 0) return []
    return data.snapshots.map((snap, idx) => {
      const sorted = [...data.participants].sort(
        (a, b) => (snap.points[b.id] ?? 0) - (snap.points[a.id] ?? 0)
      )
      const row: Record<string, string | number> = { name: `J${idx + 1}`, label: snap.label }
      sorted.forEach((p, rankIdx) => { row[p.id] = rankIdx + 1 })
      return row
    })
  }, [data])

  function toggleParticipant(id: string) {
    setActiveIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearChart() { setActiveIds(new Set()) }

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

  const { participants, participantStats, classificationStats, popularPredictions, surprises, matchesPlayed, snapshots } = data

  if (matchesPlayed === 0) {
    return (
      <div className="text-center py-20 text-gray-500">
        <p className="text-4xl mb-3">📊</p>
        <p>Nenhum resultado registrado ainda.</p>
        <p className="text-sm mt-1 text-gray-600">As estatísticas aparecerão conforme os jogos forem registrados.</p>
      </div>
    )
  }

  const sortedStats = [...participantStats].sort((a, b) => b.totalPoints - a.totalPoints)
  const surpriseSet = new Set(surprises)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null
    const snap = snapshots[chartData.findIndex(d => d.name === label)]
    const sorted = [...payload].sort((a, b) => (b.value as number) - (a.value as number))
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs max-w-xs shadow-lg">
        <p className="text-gray-200 font-semibold mb-1 truncate">{snap?.label ?? label}</p>
        {snap?.dateBRT && <p className="text-gray-400 mb-2">{snap.dateBRT}</p>}
        {sorted.map((entry: any) => (
          <div key={entry.dataKey} className="flex justify-between gap-4 items-center">
            <span style={{ color: entry.color }} className="truncate">{entry.name}</span>
            <span className="font-bold text-gray-200">{entry.value}pts</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-gray-200 dark:text-yellow-400">Estatísticas do Bolão</h2>

      {/* Evolution Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Evolução da Classificação</h3>

        {/* Participant toggles */}
        <div className="flex flex-wrap gap-1.5 mb-1">
          {participants.map((p, idx) => {
            const color = LINE_COLORS[idx % LINE_COLORS.length]
            const active = activeIds.has(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggleParticipant(p.id)}
                className={`text-xs px-3 py-1 rounded-full border transition-all font-medium ${
                  active
                    ? ''
                    : 'border-gray-300 dark:border-gray-700 text-gray-500 dark:text-gray-500 hover:border-gray-400 dark:hover:border-gray-600 hover:text-gray-200'
                }`}
                style={active ? { borderColor: color, color: color, backgroundColor: `${color}20` } : {}}
              >
                {p.name}
              </button>
            )
          })}
        </div>
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500">Clique no participante para incluir no gráfico</p>
          {activeIds.size > 0 && (
            <button onClick={clearChart} className="text-xs px-2.5 py-1 rounded-full border border-gray-400 dark:border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-500 transition-colors">
              ✕ Limpar gráfico
            </button>
          )}
        </div>

        {activeIds.size === 0 ? (
          <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
            Selecione um participante acima para visualizar a evolução
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-700)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--color-gray-500)', fontSize: 11 }} />
              <YAxis tick={{ fill: 'var(--color-gray-500)', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              {participants.map((p, idx) =>
                activeIds.has(p.id) ? (
                  <Line
                    key={p.id}
                    type="monotone"
                    dataKey={p.id}
                    name={p.name}
                    stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                    strokeWidth={2}
                    dot={{ r: 3, fill: LINE_COLORS[idx % LINE_COLORS.length] }}
                    activeDot={{ r: 5 }}
                  />
                ) : null
              )}
            </LineChart>
          </ResponsiveContainer>
        )}

        <p className="text-xs text-gray-600 text-center mt-2">
          Cada ponto representa um jogo finalizado · Passe o mouse para ver os detalhes
        </p>
      </div>

      {/* Rank History Chart */}
      {rankChartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Histórico de Posições</h3>
          <p className="text-xs text-gray-600 mb-4">Selecione participantes acima para ver a evolução da posição no ranking (1º = topo)</p>

          {activeIds.size === 0 ? (
            <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
              Selecione um participante acima para visualizar
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={rankChartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-700)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--color-gray-500)', fontSize: 11 }} />
                <YAxis
                  reversed
                  domain={[1, participants.length]}
                  tickCount={Math.min(participants.length, 8)}
                  allowDecimals={false}
                  tick={{ fill: 'var(--color-gray-500)', fontSize: 11 }}
                  tickFormatter={(v: number) => `#${v}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null
                    const snap = rankChartData[rankChartData.findIndex(d => d.name === label)]
                    const sorted = [...payload].sort((a, b) => (a.value as number) - (b.value as number))
                    return (
                      <div className="bg-white dark:bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs max-w-xs shadow-lg">
                        <p className="text-gray-200 font-semibold mb-2 truncate">{snap?.label ?? label}</p>
                        {sorted.map((entry: any) => (
                          <div key={entry.dataKey} className="flex justify-between gap-4 items-center">
                            <span style={{ color: entry.color }} className="truncate">{entry.name}</span>
                            <span className="font-bold text-gray-200">#{entry.value}</span>
                          </div>
                        ))}
                      </div>
                    )
                  }}
                />
                {participants.map((p, idx) =>
                  activeIds.has(p.id) ? (
                    <Line
                      key={p.id}
                      type="monotone"
                      dataKey={p.id}
                      name={p.name}
                      stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                      strokeWidth={2}
                      dot={{ r: 3, fill: LINE_COLORS[idx % LINE_COLORS.length] }}
                      activeDot={{ r: 5 }}
                    />
                  ) : null
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Comparison panel — shown when exactly 2 participants selected */}
      {activeIds.size === 2 && (() => {
        const ids = [...activeIds]
        const s1 = participantStats.find(s => s.id === ids[0])
        const s2 = participantStats.find(s => s.id === ids[1])
        if (!s1 || !s2) return null
        const p1idx = participants.findIndex(p => p.id === ids[0])
        const p2idx = participants.findIndex(p => p.id === ids[1])
        const c1 = LINE_COLORS[p1idx % LINE_COLORS.length]
        const c2 = LINE_COLORS[p2idx % LINE_COLORS.length]
        const leader = s1.totalPoints > s2.totalPoints ? 0 : s2.totalPoints > s1.totalPoints ? 1 : -1
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">⚔️ Comparação Direta</h3>
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
                  {win && <div className="mt-3 text-xs text-green-600 dark:text-green-400 font-semibold">👑 Na frente</div>}
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Classification bonus chart — group order + qualified-team points only */}
      {classificationStats && classificationStats.some(c => c.total > 0) && (() => {
        // Order by the bolão's overall leaderboard ranking (participants comes sorted by it)
        const rankOrder = new Map(participants.map((p, i) => [p.id, i]))
        const rankedAll = classificationStats
          .filter(c => c.total > 0)
          .sort((a, b) => (rankOrder.get(a.id) ?? 999) - (rankOrder.get(b.id) ?? 999))
        const ranked = showAllClass ? rankedAll : rankedAll.slice(0, 15)
        const chartHeight = Math.max(220, ranked.length * 22 + 40)
        const ClassTooltip = ({ active, payload }: any) => {
          if (!active || !payload || !payload.length) return null
          const d = payload[0].payload as ClassificationStat
          return (
            <div className="bg-white dark:bg-gray-800 border border-gray-700 rounded-lg p-3 text-xs shadow-lg">
              <p className="text-gray-200 font-semibold mb-2 truncate">{d.name}</p>
              <div className="flex justify-between gap-4"><span className="text-sky-400">Ordem dos grupos</span><span className="font-bold text-gray-200">{d.groupOrderPoints}</span></div>
              <div className="flex justify-between gap-4"><span className="text-emerald-400">Classificados 16-avos</span><span className="font-bold text-gray-200">{d.r32Points}</span></div>
              {d.knockoutPoints > 0 && <div className="flex justify-between gap-4"><span className="text-violet-400">Mata-mata</span><span className="font-bold text-gray-200">{d.knockoutPoints}</span></div>}
              <div className="flex justify-between gap-4 border-t border-gray-700 mt-1 pt-1"><span className="text-yellow-400">Total</span><span className="font-bold text-yellow-400">{d.total}</span></div>
            </div>
          )
        }
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pontuação de Classificação</h3>
              {rankedAll.length > 15 && (
                <button
                  onClick={() => setShowAllClass(v => !v)}
                  className="shrink-0 text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-500 transition-colors"
                >
                  {showAllClass ? 'Ver top 15' : `Ver todos (${rankedAll.length})`}
                </button>
              )}
            </div>
            <p className="text-xs text-gray-600 mb-3">Ordem dos grupos (+2/grupo) + seleções classificadas para as 16-avos (+3 cada){!showAllClass && rankedAll.length > 15 ? ' · top 15 da classificação geral' : ''}</p>
            <div className="flex items-center gap-4 mb-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#38bdf8' }} /> Ordem dos grupos</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#34d399' }} /> Classificados</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: '#a78bfa' }} /> Mata-mata</span>
            </div>
            <ResponsiveContainer width="100%" height={chartHeight}>
              <BarChart data={ranked} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }} barCategoryGap={3}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-gray-700)" horizontal={false} />
                <XAxis type="number" tick={{ fill: 'var(--color-gray-500)', fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fill: 'var(--color-gray-400)', fontSize: 10 }} interval={0} />
                <Tooltip content={<ClassTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="groupOrderPoints" stackId="a" fill="#38bdf8" />
                <Bar dataKey="r32Points" stackId="a" fill="#34d399" />
                <Bar dataKey="knockoutPoints" stackId="a" fill="#a78bfa" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )
      })()}

      {/* Points distribution donut — match points vs classification bonus (aggregate) */}
      {classificationStats && participantStats.length > 0 && (() => {
        const classTotal = classificationStats.reduce((sum, c) => sum + c.total, 0)
        const grandTotal = participantStats.reduce((sum, s) => sum + s.totalPoints, 0)
        const matchTotal = Math.max(0, grandTotal - classTotal)
        if (grandTotal === 0) return null
        const pie = [
          { name: 'Jogos (placares)', value: matchTotal, color: '#facc15' },
          { name: 'Classificação', value: classTotal, color: '#34d399' },
        ]
        const pct = (v: number) => Math.round((v / grandTotal) * 100)
        return (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Distribuição dos Pontos</h3>
            <p className="text-xs text-gray-600 mb-3">De onde vêm os pontos somados de todos os participantes</p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <ResponsiveContainer width="100%" height={200} className="max-w-[260px]">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2} stroke="none">
                    {pie.map(s => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }: any) => {
                      if (!active || !payload || !payload.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-white dark:bg-gray-800 border border-gray-700 rounded-lg p-2.5 text-xs shadow-lg">
                          <span style={{ color: d.color }} className="font-semibold">{d.name}</span>
                          <span className="text-gray-200 font-bold ml-2">{d.value} pts ({pct(d.value)}%)</span>
                        </div>
                      )
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 w-full sm:w-auto">
                {pie.map(s => (
                  <div key={s.name} className="flex items-center gap-2 text-sm">
                    <span className="w-3 h-3 rounded-sm inline-block shrink-0" style={{ background: s.color }} />
                    <span className="text-gray-300 flex-1">{s.name}</span>
                    <span className="font-score font-bold text-gray-200">{s.value}</span>
                    <span className="text-gray-500 text-xs w-10 text-right">{pct(s.value)}%</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-sm border-t border-gray-800 pt-2">
                  <span className="w-3 h-3 inline-block shrink-0" />
                  <span className="text-gray-400 flex-1">Total</span>
                  <span className="font-score font-bold text-yellow-400">{grandTotal}</span>
                  <span className="w-10" />
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Participant Stats */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Desempenho por Participante</h3>
          <p className="text-xs text-gray-600 mt-0.5">{matchesPlayed} jogo{matchesPlayed !== 1 ? 's' : ''} registrado{matchesPlayed !== 1 ? 's' : ''}</p>
        </div>
        <div>
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="text-[10px] sm:text-xs text-gray-500 tracking-wider border-b border-gray-800 bg-gray-950/50">
                <th className="pl-2 pr-1 py-2 text-left w-7">#</th>
                <th className="px-1 py-2 text-left">Participante</th>
                <th className="px-1 py-2 text-right w-14" title="Resultados certos (% de aproveitamento)">✅<span className="hidden sm:inline"> Result.</span></th>
                <th className="px-1 py-2 text-right w-10" title="Placares exatos">🎯<span className="hidden sm:inline"> Plac.</span></th>
                <th className="px-1 py-2 text-right w-10" title="Pontos por jogo">Méd.</th>
                <th className="pl-1 pr-2 py-2 text-right w-12 font-score">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedStats.map((s, idx) => {
                const pct = matchesPlayed > 0 ? Math.round((s.correctResults / matchesPlayed) * 100) : 0
                return (
                  <tr key={s.id} className={idx === 0 ? 'bg-yellow-50 dark:bg-yellow-950/30' : ''}>
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
        </div>
      </div>

      {/* Popular Predictions */}
      {popularPredictions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Palpite Mais Popular por Jogo</h3>
          </div>
          <div className="divide-y divide-gray-800">
            {popularPredictions.map(pp => {
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
                      {isSurprise && <span className="text-xs text-orange-600 dark:text-orange-400">😱 Surpresa!</span>}
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${topHit ? 'text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-950' : 'text-gray-300 bg-gray-800'}`}>
                        {pp.topPrediction}
                      </span>
                      <span className="text-xs text-gray-500">
                        {pp.count}/{pp.totalPredictions}
                        {topHit && <span className="ml-1 text-green-600 dark:text-green-500">✓</span>}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Surprise summary */}
      {surprises.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-xl px-4 py-3 text-sm text-orange-700 dark:text-orange-300">
          😱 <span className="font-semibold">{surprises.length} jogo{surprises.length !== 1 ? 's' : ''} sem nenhum palpite exato</span>
          {' '}— ninguém acertou o placar correto nesses jogos.
        </div>
      )}
    </div>
  )
}
