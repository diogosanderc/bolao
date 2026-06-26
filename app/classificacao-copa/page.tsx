'use client'

import { useEffect, useState } from 'react'
import { Flag } from '@/components/Flag'
import { teamById } from '@/lib/copa2026'

type GroupRow = {
  teamId: string; pos: number
  p: number; j: number; v: number; e: number; d: number
  gp: number; gc: number; sg: number
}

type MatchInfo = {
  matchId: string; matchNumber: number; phase: string
  team1Id: string; team2Id: string
  date: string | null; venue: string | null
  score1: number | null; score2: number | null
  advancingTeamId?: string
  status: 'played' | 'live' | 'upcoming'
  clock: string | null
}

type GroupData  = { id: string; name: string; standings: GroupRow[]; matches: MatchInfo[] }
type KnockoutPhase = { phase: string; label: string; matches: MatchInfo[] }

// ─── Shared match row ────────────────────────────────────────────────────────

function MatchRow({ m, compact = false }: { m: MatchInfo; compact?: boolean }) {
  const played = m.status === 'played'
  const live   = m.status === 'live'
  const tbd    = m.team1Id === 'TBD' || m.team2Id === 'TBD'

  // Determine winner for styling
  const adv = m.advancingTeamId
  const w1 = played && !tbd && (m.score1! > m.score2! || adv === m.team1Id)
  const w2 = played && !tbd && (m.score2! > m.score1! || adv === m.team2Id)

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 text-xs ${tbd ? 'opacity-40' : ''}`}>
      {/* Team 1 */}
      <div className="flex items-center gap-1.5 flex-1 justify-end min-w-0">
        <span className={`truncate text-right font-semibold ${w1 ? 'text-gray-200' : played ? 'text-gray-400' : live ? 'text-gray-300' : 'text-gray-500'}`}>
          {compact ? m.team1Id : (teamById[m.team1Id]?.name ?? m.team1Id)}
        </span>
        {!tbd ? <Flag teamId={m.team1Id} size={16} /> : <span className="text-gray-600">🏳</span>}
      </div>

      {/* Score */}
      <div className="shrink-0 text-center min-w-[3.4rem]">
        {played || live ? (
          <span className={`font-bold px-1.5 py-0.5 rounded tabular-nums ${live ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300' : 'bg-gray-800 text-gray-100'}`}>
            {m.score1}–{m.score2}
          </span>
        ) : (
          <span className="text-gray-600 text-[11px]">×</span>
        )}
      </div>

      {/* Team 2 */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {!tbd ? <Flag teamId={m.team2Id} size={16} /> : <span className="text-gray-600">🏳</span>}
        <span className={`truncate font-semibold ${w2 ? 'text-gray-200' : played ? 'text-gray-400' : live ? 'text-gray-300' : 'text-gray-500'}`}>
          {compact ? m.team2Id : (teamById[m.team2Id]?.name ?? m.team2Id)}
        </span>
      </div>

      {/* Live badge */}
      {live && (
        <span className="shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">{m.clock ?? 'AO VIVO'}</span>
        </span>
      )}
    </div>
  )
}

// ─── Group card ──────────────────────────────────────────────────────────────

function GroupCard({ group }: { group: GroupData }) {
  return (
    <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
      <div className="bg-green-800 px-4 py-2">
        <h3 className="font-bold text-white text-sm tracking-wide uppercase">{group.name}</h3>
      </div>

      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-900 text-gray-500 uppercase tracking-wider">
            <th className="px-2 py-1.5 text-left w-5">#</th>
            <th className="px-1 py-1.5 text-left">Time</th>
            <th className="px-1 py-1.5 text-center w-6" title="Jogos">J</th>
            <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Vitórias">V</th>
            <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Empates">E</th>
            <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Derrotas">D</th>
            <th className="px-1 py-1.5 text-center w-7" title="Saldo">SG</th>
            <th className="px-2 py-1.5 text-right w-8 text-gray-200 dark:text-yellow-500" title="Pontos">Pts</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/60">
          {group.standings.map(row => {
            const team = teamById[row.teamId]
            const border = row.pos <= 2 ? 'border-l-2 border-green-500'
              : row.pos === 3 ? 'border-l-2 border-amber-500/60'
              : 'border-l-2 border-transparent'
            return (
              <tr key={row.teamId} className={border}>
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
                <td className="px-2 py-1.5 text-right font-bold text-gray-200 dark:text-yellow-400">{row.p}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="border-t border-gray-800 divide-y divide-gray-800/40">
        {group.matches.map(m => <MatchRow key={m.matchId} m={m} compact />)}
      </div>
    </div>
  )
}

// ─── Knockout section ────────────────────────────────────────────────────────

function KnockoutSection({ phases }: { phases: KnockoutPhase[] }) {
  const [activePhase, setActivePhase] = useState(() => phases[0]?.phase ?? '')

  // keep selection valid as data loads
  useEffect(() => {
    if (phases.length && !phases.find(p => p.phase === activePhase)) {
      setActivePhase(phases[0].phase)
    }
  }, [phases, activePhase])

  const current = phases.find(p => p.phase === activePhase)

  return (
    <div className="space-y-3">
      {/* Phase tabs */}
      <div className="flex flex-wrap gap-1.5">
        {phases.map(p => (
          <button
            key={p.phase}
            onClick={() => setActivePhase(p.phase)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              activePhase === p.phase
                ? 'bg-green-700 dark:bg-yellow-500 text-[white] dark:text-black border-green-700 dark:border-yellow-500 font-bold'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {current && (
        <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
          <div className="bg-yellow-600 px-4 py-2">
            <h3 className="font-bold text-white text-sm tracking-wide uppercase">{current.label}</h3>
          </div>
          <div className="divide-y divide-gray-800/50">
            {current.matches.map((m, i) => (
              <div key={m.matchId}>
                {/* Pair label for R32: show match number in bracket */}
                {current.phase === 'round_of_32' && i % 2 === 0 && (
                  <div className="px-3 pt-2 pb-0.5 text-[10px] text-gray-600 font-semibold uppercase tracking-wider">
                    Jogo {Math.floor(i / 2) + 1}
                  </div>
                )}
                <MatchRow key={m.matchId} m={m} compact={false} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Third-place ranking ─────────────────────────────────────────────────────

function ThirdsSection({ groups }: { groups: GroupData[] }) {
  // Extract 3rd-place team from each group that has standings
  const thirds = groups
    .map(g => {
      const row = g.standings.find(r => r.pos === 3)
      if (!row) return null
      const complete = g.standings.every(r => r.j >= 3)
      return { ...row, groupId: g.id, groupName: g.name, complete }
    })
    .filter(Boolean) as (GroupRow & { groupId: string; groupName: string; complete: boolean })[]

  // Sort: pts → sg → gp
  const sorted = [...thirds].sort((a, b) => {
    if (b.p !== a.p) return b.p - a.p
    if (b.sg !== a.sg) return b.sg - a.sg
    return b.gp - a.gp
  })

  const total = 12 // total groups in Copa 2026

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Top 8 se classificam</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-700 inline-block" /> Grupo ainda em disputa</span>
      </div>

      {thirds.length === 0 && (
        <p className="text-center py-10 text-gray-500">Nenhum grupo fechado ainda.</p>
      )}

      {sorted.length > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
          <div className="bg-amber-700 px-4 py-2 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm tracking-wide uppercase">Melhores 3ºs Lugares</h3>
            <span className="text-xs text-amber-200">{thirds.length}/{total} grupos</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-900 text-gray-500 uppercase tracking-wider">
                <th className="px-2 py-1.5 text-left w-6">#</th>
                <th className="px-1 py-1.5 text-left">Time</th>
                <th className="px-1 py-1.5 text-center w-8">Grp</th>
                <th className="px-1 py-1.5 text-center w-6">J</th>
                <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell">V</th>
                <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell">E</th>
                <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell">D</th>
                <th className="px-1 py-1.5 text-center w-7">SG</th>
                <th className="px-1 py-1.5 text-center w-7 hidden sm:table-cell">GP</th>
                <th className="px-2 py-1.5 text-right w-8 text-gray-200 dark:text-yellow-500">Pts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {sorted.map((row, idx) => {
                const team = teamById[row.teamId]
                const qualifies = idx < 8
                const border = qualifies
                  ? 'border-l-2 border-amber-500'
                  : 'border-l-2 border-transparent'
                const rowBg = !row.complete ? 'opacity-70' : ''
                return (
                  <tr key={row.teamId} className={`${border} ${rowBg}`}>
                    <td className="px-2 py-1.5 text-gray-500 font-semibold">{idx + 1}</td>
                    <td className="px-1 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Flag teamId={row.teamId} size={16} />
                        <span className="text-gray-200 font-semibold truncate">
                          <span className="sm:hidden">{row.teamId}</span>
                          <span className="hidden sm:inline">{team?.name ?? row.teamId}</span>
                        </span>
                        {!row.complete && <span className="text-[10px] text-amber-500 font-semibold ml-1">em jogo</span>}
                      </div>
                    </td>
                    <td className="px-1 py-1.5 text-center text-gray-500 font-semibold">{row.groupId}</td>
                    <td className="px-1 py-1.5 text-center text-gray-400">{row.j}</td>
                    <td className="px-1 py-1.5 text-center text-gray-400 hidden sm:table-cell">{row.v}</td>
                    <td className="px-1 py-1.5 text-center text-gray-400 hidden sm:table-cell">{row.e}</td>
                    <td className="px-1 py-1.5 text-center text-gray-400 hidden sm:table-cell">{row.d}</td>
                    <td className="px-1 py-1.5 text-center text-gray-400">{row.sg > 0 ? `+${row.sg}` : row.sg}</td>
                    <td className="px-1 py-1.5 text-center text-gray-400 hidden sm:table-cell">{row.gp}</td>
                    <td className="px-2 py-1.5 text-right font-bold text-gray-200 dark:text-yellow-400">{row.p}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {thirds.length < total && (
            <p className="text-[11px] text-gray-600 text-center py-2 border-t border-gray-800">
              {total - thirds.length} grupo(s) ainda não fechado(s) — classificação pode mudar
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

type Tab = 'groups' | 'knockout' | 'thirds'

export default function ClassificacaoCopaPage() {
  const [groups,   setGroups]   = useState<GroupData[]>([])
  const [knockout, setKnockout] = useState<KnockoutPhase[]>([])
  const [hasLive,  setHasLive]  = useState(false)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<Tab>('groups')

  useEffect(() => {
    let active = true
    const load = () => {
      fetch('/api/copa-standings')
        .then(r => r.json())
        .then(d => {
          if (!active) return
          setGroups(d.groups   ?? [])
          setKnockout(d.knockout ?? [])
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
          <h2 className="text-2xl font-bold text-gray-200 dark:text-yellow-400">Classificação da Copa</h2>
          <p className="text-xs text-gray-500 mt-0.5">Tabela dos grupos e resultados do mata-mata</p>
        </div>
        {hasLive && (
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-semibold text-red-400">jogos ao vivo</span>
          </div>
        )}
      </div>

      {/* Main tabs */}
      <div className="flex border-b border-gray-800">
        {([['groups', 'Fase de Grupos'], ['thirds', 'Terceiros'], ['knockout', 'Mata-Mata']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2.5 text-sm font-semibold transition-colors ${
              tab === key
                ? 'text-green-700 dark:text-yellow-400 border-b-2 border-green-700 dark:border-yellow-400 -mb-px'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <div className="text-center py-12 text-gray-500">Carregando…</div>}

      {!loading && tab === 'groups' && (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Classificados (1º e 2º)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60 inline-block" /> Possível vaga como melhor 3º</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map(g => <GroupCard key={g.id} group={g} />)}
          </div>
        </>
      )}

      {!loading && tab === 'thirds' && (
        <ThirdsSection groups={groups} />
      )}

      {!loading && tab === 'knockout' && (
        <KnockoutSection phases={knockout} />
      )}
    </div>
  )
}
