'use client'

import { useEffect, useState } from 'react'
import { LeaderboardEntry } from '@/lib/types'

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => { setData(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const trophies: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  // unique sorted point totals → position tier (1st, 2nd, 3rd group of scores)
  const uniquePoints = [...new Set(data.map(e => e.totalPoints))].sort((a, b) => b - a)
  const tierOf = (pts: number) => uniquePoints.indexOf(pts) + 1

  // rank = quantos participantes têm mais pontos + 1 (empates compartilham o mesmo rank)
  const ranks = data.map((entry) =>
    data.filter(e => e.totalPoints > entry.totalPoints).length + 1
  )

  // últimos 7 (ou mais, em caso de empate) pagam — "rebaixados"
  const cutoffScore = data.length >= 7 ? data[data.length - 7].totalPoints : -Infinity
  const isRelated = (pts: number) => data.length >= 7 && pts <= cutoffScore

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-yellow-400">Classificação</h2>
        <button
          onClick={() => location.reload()}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ↻ Atualizar
        </button>
      </div>

      {loading && (
        <div className="text-center py-20 text-gray-400">Carregando...</div>
      )}

      {!loading && data.length === 0 && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">📋</p>
          <p>Nenhum participante cadastrado ainda.</p>
          <p className="text-sm mt-1">
            <a href="/admin" className="text-yellow-400 hover:underline">Acesse o painel admin</a> para adicionar participantes.
          </p>
        </div>
      )}

      {!loading && data.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-4 py-3 text-left w-10">#</th>
                <th className="px-4 py-3 text-left">Participante</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Jogos</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Fases</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Resultados</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Placares exatos</th>
                <th className="px-4 py-3 text-center hidden lg:table-cell">Palpites</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.map((entry, idx) => {
                const rank = ranks[idx]
                const tier = tierOf(entry.totalPoints)
                return (
                <tr
                  key={entry.participant.id}
                  className={`transition-colors ${
                    isRelated(entry.totalPoints) ? 'bg-red-950/50 hover:bg-red-950/70' :
                    tier === 1 ? 'bg-yellow-950/40' :
                    tier === 2 ? 'bg-gray-800/30' :
                    tier === 3 ? 'bg-orange-950/30' :
                    'hover:bg-gray-900/50'
                  }`}
                >
                  <td className="px-4 py-3 text-center font-bold text-lg">
                    {isRelated(entry.totalPoints)
                      ? '💸'
                      : (trophies[tier] ?? <span className="text-gray-500 text-sm">{rank}</span>)}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${
                    isRelated(entry.totalPoints) ? 'text-red-300' :
                    tier === 1 ? 'text-yellow-300' :
                    tier === 2 ? 'text-gray-300' :
                    tier === 3 ? 'text-amber-600' :
                    ''
                  }`}>
                    {entry.participant.name}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-base ${isRelated(entry.totalPoints) ? 'text-red-400' : 'text-yellow-400'}`}>
                    {entry.totalPoints}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
                    {entry.matchPoints}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell">
                    {entry.phasePoints}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">
                    {entry.breakdown.correctResults}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">
                    {entry.breakdown.correctScores}
                  </td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    <a
                      href={`/palpite/${entry.participant.token}`}
                      className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
                    >
                      Ver palpites
                    </a>
                  </td>
                </tr>
              )}
            )}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        {[
          { label: 'Resultado certo', pts: '4 pts', icon: '✅' },
          { label: 'Placar exato', pts: '+2 pts', icon: '🎯' },
          { label: 'Gols de um time', pts: '1 pt/time', icon: '⚽' },
          { label: 'Placar c/ 3+ gols', pts: '+2 pts', icon: '🔥' },
        ].map(item => (
          <div key={item.label} className="bg-gray-900 rounded-lg p-3 text-center border border-gray-800">
            <div className="text-2xl mb-1">{item.icon}</div>
            <div className="text-xs text-gray-400">{item.label}</div>
            <div className="text-green-400 font-bold text-sm">{item.pts}</div>
          </div>
        ))}
      </div>

      <div className="text-center text-xs text-gray-600 mt-4">
        Classificação atualizada em tempo real conforme resultados são lançados
      </div>
    </div>
  )
}
