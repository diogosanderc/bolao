'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
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

type PopularPrediction = {
  matchId: string; label: string; dateBRT: string
  topPrediction: string; count: number; totalPredictions: number
  resultScore: string
}

type EstatisticasData = {
  participants: ParticipantInfo[]
  snapshots: Snapshot[]
  participantStats: ParticipantStat[]
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

  useEffect(() => {
    fetch('/api/estatisticas')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setActiveIds(new Set(d.participants.map((p: ParticipantInfo) => p.id)))
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

  function toggleParticipant(id: string) {
    setActiveIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) }
      else next.add(id)
      return next
    })
  }

  function selectAll() { if (data) setActiveIds(new Set(data.participants.map(p => p.id))) }
  function selectNone() { /* keep at least 1 */ }

  if (loading) return <div className="text-center py-20 text-gray-400">Carregando estatísticas...</div>
  if (!data) return <div className="text-center py-20 text-gray-500">Erro ao carregar dados.</div>

  const { participants, participantStats, popularPredictions, surprises, matchesPlayed, snapshots } = data

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
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 text-xs max-w-xs">
        <p className="text-gray-300 font-semibold mb-1 truncate">{snap?.label ?? label}</p>
        {snap?.dateBRT && <p className="text-gray-500 mb-2">{snap.dateBRT}</p>}
        {sorted.map((entry: any) => (
          <div key={entry.dataKey} className="flex justify-between gap-4 items-center">
            <span style={{ color: entry.color }} className="truncate">{entry.name}</span>
            <span className="font-bold text-white">{entry.value}pts</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">Estatísticas do Bolão</h2>

      {/* Evolution Chart */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Evolução da Classificação</h3>

        {/* Participant toggles */}
        <div className="flex flex-wrap gap-2 mb-4">
          {participants.map((p, idx) => {
            const color = LINE_COLORS[idx % LINE_COLORS.length]
            const active = activeIds.has(p.id)
            return (
              <button
                key={p.id}
                onClick={() => toggleParticipant(p.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-all font-medium ${
                  active ? 'opacity-100' : 'opacity-30'
                }`}
                style={{ borderColor: color, color: active ? color : '#6b7280', backgroundColor: active ? `${color}15` : 'transparent' }}
              >
                {p.name}
              </button>
            )
          })}
          <button onClick={selectAll} className="text-xs px-2.5 py-1 rounded-full border border-gray-700 text-gray-500 hover:text-gray-300 transition-colors">
            Todos
          </button>
        </div>

        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
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

        <p className="text-xs text-gray-600 text-center mt-2">
          Cada ponto representa um jogo finalizado. Passe o mouse para ver os detalhes.
        </p>
      </div>

      {/* Participant Stats */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider">Desempenho por Participante</h3>
          <p className="text-xs text-gray-600 mt-0.5">{matchesPlayed} jogo{matchesPlayed !== 1 ? 's' : ''} registrado{matchesPlayed !== 1 ? 's' : ''}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Participante</th>
                <th className="px-4 py-2 text-right" title="Resultados certos (vitória/empate/derrota)">✅ Resultados</th>
                <th className="px-4 py-2 text-right" title="Placares exatos">🎯 Placares</th>
                <th className="px-4 py-2 text-right" title="Média de pontos por jogo">Média/jogo</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {sortedStats.map((s, idx) => {
                const pct = matchesPlayed > 0 ? Math.round((s.correctResults / matchesPlayed) * 100) : 0
                return (
                  <tr key={s.id} className={idx === 0 ? 'bg-yellow-950/30' : ''}>
                    <td className="px-4 py-3 text-gray-500 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-white">{s.name}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-green-400">{s.correctResults}</span>
                      <span className="text-gray-600 text-xs ml-1">({pct}%)</span>
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-400 font-semibold">{s.correctScores}</td>
                    <td className="px-4 py-3 text-right text-gray-300">{s.pointsPerMatch}</td>
                    <td className="px-4 py-3 text-right font-bold text-yellow-500">{s.totalPoints}</td>
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
                      {isSurprise && <span className="text-xs text-orange-400">😱 Surpresa!</span>}
                      <span className={`text-sm font-bold px-2 py-0.5 rounded ${topHit ? 'text-green-400 bg-green-950' : 'text-gray-300 bg-gray-800'}`}>
                        {pp.topPrediction}
                      </span>
                      <span className="text-xs text-gray-500">
                        {pp.count}/{pp.totalPredictions}
                        {topHit && <span className="ml-1 text-green-500">✓</span>}
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
        <div className="bg-orange-950/30 border border-orange-900/50 rounded-xl px-4 py-3 text-sm text-orange-300">
          😱 <span className="font-semibold">{surprises.length} jogo{surprises.length !== 1 ? 's' : ''} sem nenhum palpite exato</span>
          {' '}— ninguém acertou o placar correto nesses jogos.
        </div>
      )}
    </div>
  )
}
