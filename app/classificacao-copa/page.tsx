'use client'

import { useEffect, useState } from 'react'
import { Flag } from '@/components/Flag'
import { teamById } from '@/lib/copa2026'

type GroupRow = {
  teamId: string
  pos: number
  p: number; j: number; v: number; e: number; d: number
  gp: number; gc: number; sg: number
}

type MatchInfo = {
  matchId: string
  matchNumber: number
  team1Id: string
  team2Id: string
  date: string | null
  venue: string | null
  score1: number | null
  score2: number | null
  status: 'played' | 'live' | 'upcoming'
  clock: string | null
}

type GroupData = {
  id: string
  name: string
  standings: GroupRow[]
  matches: MatchInfo[]
}

function GroupCard({ group }: { group: GroupData }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
      {/* Group title */}
      <div className="bg-green-800 px-4 py-2">
        <h3 className="font-bold text-white text-sm tracking-wide uppercase">{group.name}</h3>
      </div>

      {/* Standings table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-900 text-gray-500 uppercase tracking-wider">
            <th className="px-2 py-1.5 text-left w-5">#</th>
            <th className="px-1 py-1.5 text-left">Time</th>
            <th className="px-1 py-1.5 text-center w-6" title="Jogos">J</th>
            <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Vitórias">V</th>
            <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Empates">E</th>
            <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Derrotas">D</th>
            <th className="px-1 py-1.5 text-center w-7" title="Saldo de gols">SG</th>
            <th className="px-2 py-1.5 text-right w-8 text-yellow-500" title="Pontos">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {group.standings.map(row => {
            const team = teamById[row.teamId]
            // pos 1-2 qualify directly (green), pos 3 may advance as best 3rd (amber)
            const border =
              row.pos <= 2 ? 'border-l-2 border-green-500' :
              row.pos === 3 ? 'border-l-2 border-amber-500/60' :
              'border-l-2 border-transparent'
            return (
              <tr key={row.teamId} className={`${border}`}>
                <td className="px-2 py-1.5 text-gray-500 font-semibold">{row.pos}</td>
                <td className="px-1 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Flag teamId={row.teamId} size={16} />
                    <span className="text-gray-200 font-semibold truncate">
                      <span className="sm:hidden">{row.teamId}</span>
                      <span className="hidden sm:inline">{team?.name ?? row.teamId}</span>
                    </span>
                  </div>
                </td>
                <td className="px-1 py-1.5 text-center text-gray-400">{row.j}</td>
                <td className="px-1 py-1.5 text-center text-gray-400 hidden sm:table-cell">{row.v}</td>
                <td className="px-1 py-1.5 text-center text-gray-400 hidden sm:table-cell">{row.e}</td>
                <td className="px-1 py-1.5 text-center text-gray-400 hidden sm:table-cell">{row.d}</td>
                <td className="px-1 py-1.5 text-center text-gray-400">{row.sg > 0 ? `+${row.sg}` : row.sg}</td>
                <td className="px-2 py-1.5 text-right font-bold text-yellow-400">{row.p}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Match results */}
      <div className="border-t border-gray-800 divide-y divide-gray-800/40">
        {group.matches.map(m => {
          const played = m.status === 'played'
          const live = m.status === 'live'
          return (
            <div key={m.matchId} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              {/* Team 1 */}
              <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
                <span className={`truncate text-right ${played || live ? 'text-gray-200' : 'text-gray-500'}`}>{m.team1Id}</span>
                <Flag teamId={m.team1Id} size={16} />
              </div>

              {/* Score / date */}
              <div className="shrink-0 text-center min-w-[3.2rem]">
                {played || live ? (
                  <span className={`font-bold px-1.5 py-0.5 rounded ${live ? 'bg-red-950 text-red-300' : 'bg-gray-800 text-gray-100'}`}>
                    {m.score1}–{m.score2}
                  </span>
                ) : (
                  <span className="text-gray-600">{m.date ?? '—'}</span>
                )}
              </div>

              {/* Team 2 */}
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <Flag teamId={m.team2Id} size={16} />
                <span className={`truncate ${played || live ? 'text-gray-200' : 'text-gray-500'}`}>{m.team2Id}</span>
              </div>

              {/* Live badge */}
              {live && (
                <span className="shrink-0 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-[10px] font-semibold text-red-400">{m.clock ?? 'AO VIVO'}</span>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function ClassificacaoCopaPage() {
  const [groups, setGroups] = useState<GroupData[]>([])
  const [hasLive, setHasLive] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const load = () => {
      fetch('/api/copa-standings')
        .then(r => r.json())
        .then(d => {
          if (!active) return
          setGroups(d.groups ?? [])
          setHasLive(!!d.hasLive)
          setLoading(false)
        })
        .catch(() => active && setLoading(false))
    }
    load()
    const interval = setInterval(load, 30_000)
    return () => { active = false; clearInterval(interval) }
  }, [])

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">Classificação da Copa</h2>
          <p className="text-xs text-gray-500 mt-0.5">Tabela de pontos dos grupos e resultados dos jogos</p>
        </div>
        {hasLive && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-400">jogos ao vivo</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Classificados (1º e 2º)</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60 inline-block" /> Possível vaga (3º)</span>
      </div>

      {loading && <div className="text-center py-12 text-gray-500">Carregando…</div>}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {groups.map(g => <GroupCard key={g.id} group={g} />)}
        </div>
      )}
    </div>
  )
}
