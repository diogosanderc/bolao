'use client'

import { useEffect, useState } from 'react'
import { LeaderboardEntry } from '@/lib/types'
import { Flag } from '@/components/Flag'
import { ParticipantModal } from '@/components/ParticipantModal'

type LastMatch = {
  matchId: string
  score1: number
  score2: number
  team1: { id: string; name: string; flag: string }
  team2: { id: string; name: string; flag: string }
} | null

type ScheduleMatch = {
  matchId: string
  team1: { id: string; name: string; flag: string }
  team2: { id: string; name: string; flag: string }
  dateBRT: string
  venue: string
  inProgress: boolean
  liveScore1?: number
  liveScore2?: number
  clock?: string
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [lastMatch, setLastMatch] = useState<LastMatch>(null)
  const [nextMatch, setNextMatch] = useState<ScheduleMatch | null>(null)
  const [liveMatches, setLiveMatches] = useState<ScheduleMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedParticipant, setSelectedParticipant] = useState<{ id: string; name: string } | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  function fetchLeaderboard() {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        setData(Array.isArray(d.leaderboard) ? d.leaderboard : [])
        setLastMatch(d.lastMatch ?? null)
        setLastRefresh(new Date())
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchLeaderboard()

    // Count this session as a visit once (dedup via sessionStorage)
    if (!sessionStorage.getItem('bolao_visited')) {
      sessionStorage.setItem('bolao_visited', '1')
      fetch('/api/visit', { method: 'POST' }).catch(() => {})
    }

    function fetchSchedule() {
      fetch('/api/schedule')
        .then(r => r.json())
        .then(d => {
          setNextMatch(d.nextMatch ?? null)
          setLiveMatches(Array.isArray(d.live) ? d.live : [])
        })
        .catch(() => {})
    }
    fetchSchedule()
    const interval = setInterval(fetchSchedule, 30_000)
    return () => clearInterval(interval)
  }, [])

  // When there are live matches, refresh leaderboard every 30s and trigger ESPN sync every 60s
  useEffect(() => {
    if (liveMatches.length === 0) return
    const leaderboardInterval = setInterval(fetchLeaderboard, 30_000)
    const syncInterval = setInterval(() => {
      fetch('/api/sync/live', { method: 'POST' }).catch(() => {})
    }, 60_000)
    // Trigger sync immediately when a live match is first detected
    fetch('/api/sync/live', { method: 'POST' }).catch(() => {})
    return () => {
      clearInterval(leaderboardInterval)
      clearInterval(syncInterval)
    }
  }, [liveMatches.length])

  const trophies: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' }

  const uniquePoints = [...new Set(data.map(e => e.totalPoints))].sort((a, b) => b - a)
  const tierOf = (pts: number) => uniquePoints.indexOf(pts) + 1

  const ranks = data.map((entry) =>
    data.filter(e => e.totalPoints > entry.totalPoints).length + 1
  )

  const cutoffScore = data.length >= 7 ? data[data.length - 7].totalPoints : -Infinity
  const isRelated = (pts: number) => data.length >= 7 && pts <= cutoffScore
  const isWarning = (pts: number) => !isRelated(pts) && data.length >= 7 && pts <= cutoffScore + 2

  const isFirstOfRank = data.map((_, idx) => idx === 0 || ranks[idx] !== ranks[idx - 1])

  function shareWhatsApp() {
    const lines: string[] = ['🏆 *Classificação Bolão Copa 2026*']
    if (lastMatch) {
      lines.push(`⚽ Último jogo: ${lastMatch.team1.name} ${lastMatch.score1}×${lastMatch.score2} ${lastMatch.team2.name}`)
    }
    lines.push('')
    data.forEach((entry, idx) => {
      const rank = ranks[idx]
      const tier = tierOf(entry.totalPoints)
      const medal = isRelated(entry.totalPoints) ? '💸' : isWarning(entry.totalPoints) ? '⚠️' : (trophies[tier] ?? (rank >= 4 && rank <= 7 && isFirstOfRank[idx] ? '⭐' : (isFirstOfRank[idx] ? `${rank}.` : '   ')))
      const pts = `${entry.totalPoints}pts`
      const last = entry.lastMatchPoints > 0 ? ` (+${entry.lastMatchPoints})` : ''
      lines.push(`${medal} *${entry.participant.name}* — ${pts}${last}`)
    })
    lines.push('')
    lines.push(`_Classificação gerada em ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}_`)
    const text = encodeURIComponent(lines.join('\n'))
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">Classificação</h2>
        <div className="flex items-center gap-3">
          {!loading && data.length > 0 && (
            <button
              onClick={shareWhatsApp}
              className="flex items-center gap-1.5 text-sm bg-green-700 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg transition-colors font-semibold"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Compartilhar
            </button>
          )}
          <button
            onClick={() => location.reload()}
            className="text-sm text-gray-400 hover:text-gray-200 transition-colors"
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      {liveMatches.length > 0 && (
        <div className="space-y-1.5">
          {liveMatches.map(m => (
            <div key={m.matchId} className="bg-red-950/60 border border-red-700 rounded-lg px-4 py-2.5 animate-pulse">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-red-400 uppercase tracking-wider font-bold">🔴 Ao vivo</span>
                <span className="flex items-center gap-2">
                  {m.clock && <span className="text-xs text-red-300 font-semibold">{m.clock}</span>}
                  {lastRefresh && <span className="text-xs text-gray-500">atualizado {lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-white">
                <span className="flex items-center gap-1.5"><Flag teamId={m.team1.id} size={18} />{m.team1.name}</span>
                <span className="font-bold text-white text-base px-1">
                  {m.liveScore1 !== undefined && m.liveScore2 !== undefined
                    ? `${m.liveScore1} × ${m.liveScore2}`
                    : <span className="text-red-300">vs</span>}
                </span>
                <span className="flex items-center gap-1.5"><Flag teamId={m.team2.id} size={18} />{m.team2.name}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {lastMatch && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Último jogo</div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="flex items-center gap-1.5"><Flag teamId={lastMatch.team1.id} size={18} />{lastMatch.team1.name}</span>
            <span className="font-bold text-white">{lastMatch.score1} × {lastMatch.score2}</span>
            <span className="flex items-center gap-1.5"><Flag teamId={lastMatch.team2.id} size={18} />{lastMatch.team2.name}</span>
          </div>
        </div>
      )}

      {nextMatch && liveMatches.length === 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-2.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Próximo jogo</span>
            <span className="text-xs text-yellow-500 font-semibold">{nextMatch.dateBRT}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="flex items-center gap-1.5"><Flag teamId={nextMatch.team1.id} size={18} />{nextMatch.team1.name}</span>
            <span className="text-gray-600">vs</span>
            <span className="flex items-center gap-1.5"><Flag teamId={nextMatch.team2.id} size={18} />{nextMatch.team2.name}</span>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3 text-right">Último</th>
                <th className="px-4 py-3 text-right">Últ. 4</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.map((entry, idx) => {
                const rank = ranks[idx]
                const tier = tierOf(entry.totalPoints)
                return (
                <tr
                  key={entry.participant.id}
                  onClick={() => setSelectedParticipant({ id: entry.participant.id, name: entry.participant.name })}
                  className={`cursor-pointer transition-colors ${
                    isRelated(entry.totalPoints) ? 'bg-red-50 hover:bg-red-100 dark:bg-red-950/50 dark:hover:bg-red-950/70' :
                    isWarning(entry.totalPoints) ? 'bg-yellow-50 hover:bg-yellow-100 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/30' :
                    tier === 1 ? 'bg-yellow-100 hover:bg-yellow-200 dark:bg-yellow-950/40 dark:hover:bg-yellow-950/60' :
                    tier === 2 ? 'bg-gray-800/30 hover:bg-gray-800/60' :
                    tier === 3 ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50' :
                    'hover:bg-gray-900/50'
                  }`}
                >
                  <td className="px-4 py-3 text-center font-bold text-lg">
                    {isRelated(entry.totalPoints)
                      ? '💸'
                      : isWarning(entry.totalPoints)
                      ? (isFirstOfRank[idx] ? <span className="text-yellow-500 text-sm">{rank}</span> : null)
                      : trophies[tier]
                      ?? (rank >= 4 && rank <= 7
                          ? '⭐'
                          : (isFirstOfRank[idx] ? <span className="text-gray-500 text-sm">{rank}</span> : null))}
                  </td>
                  <td className={`px-4 py-3 font-semibold ${
                    isRelated(entry.totalPoints) ? 'text-red-700 dark:text-red-300' :
                    isWarning(entry.totalPoints) ? 'text-yellow-600 dark:text-yellow-400' :
                    tier === 1 ? 'text-yellow-700 dark:text-yellow-300' :
                    tier === 2 ? 'text-gray-300' :
                    tier === 3 ? 'text-amber-600' :
                    ''
                  }`}>
                    <span className="flex items-center gap-1.5">
                      {entry.participant.name}
                      {(() => {
                        const change = (entry as any).positionChange
                        if (!change) return null
                        return change > 0
                          ? <span className="text-green-400 text-[10px] font-bold">▲{change}</span>
                          : <span className="text-red-400 text-[10px] font-bold">▼{Math.abs(change)}</span>
                      })()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {entry.lastMatchPoints > 0
                      ? <span className="text-green-400 font-semibold">+{entry.lastMatchPoints}</span>
                      : <span className="text-gray-500">0</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(() => {
                      const pts = (entry as any).last4Points ?? 0
                      return <span className={pts > 0 ? 'text-blue-400 font-semibold' : 'text-gray-500'}>{pts}</span>
                    })()}
                  </td>
                  <td className={`px-4 py-3 text-right font-bold text-base ${isRelated(entry.totalPoints) ? 'text-red-600 dark:text-red-400' : isWarning(entry.totalPoints) ? 'text-yellow-500 dark:text-yellow-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                    {entry.totalPoints}
                  </td>
                </tr>
              )}
            )}
            </tbody>
          </table>
          <p className="text-xs text-gray-700 text-center py-2">Clique num participante para ver seus palpites</p>
        </div>
      )}

      {selectedParticipant && (
        <ParticipantModal
          participantId={selectedParticipant.id}
          name={selectedParticipant.name}
          onClose={() => setSelectedParticipant(null)}
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-8">
        {[
          { label: 'Resultado certo', pts: '4 pts', icon: '✅' },
          { label: 'Placar exato', pts: '+2 pts', icon: '🎯' },
          { label: 'Gols de um time', pts: '1 pt/time', icon: '⚽' },
          { label: 'Acertar gols do vencedor (≥ 4 gols)', pts: '+2 pts', icon: '🔥' },
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
