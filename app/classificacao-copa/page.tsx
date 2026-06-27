'use client'

import { useEffect, useState } from 'react'
import { Flag } from '@/components/Flag'
import { Scoreboard } from '@/components/Scoreboard'
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
      <div className="shrink-0 text-center min-w-[3.4rem] flex justify-center">
        {played || live ? (
          <Scoreboard score1={m.score1 ?? 0} score2={m.score2 ?? 0} size="sm" live={live} />
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
            const qualified = row.pos <= 2
            const border = qualified ? 'border-l-2 border-green-500'
              : row.pos === 3 ? 'border-l-2 border-amber-500/60'
              : 'border-l-2 border-transparent'
            const leaderBg = row.pos === 1 ? 'bg-green-50 dark:bg-green-950/30' : ''
            return (
              <tr key={row.teamId} className={`${border} ${leaderBg}`}>
                <td className="px-2 py-1.5 text-gray-500 font-semibold">{row.pos}</td>
                <td className="px-1 py-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Flag teamId={row.teamId} size={16} />
                    <span className="text-gray-200 font-semibold truncate">
                      <span className="sm:hidden">{row.teamId}</span>
                      <span className="hidden sm:inline">{team?.name ?? row.teamId}</span>
                    </span>
                    {qualified && <span className="shrink-0 text-green-600 dark:text-green-400 text-[10px] font-bold" title="Classificado">✓</span>}
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

// ─── Phase icons ─────────────────────────────────────────────────────────────

const PHASE_ICON: Record<string, string> = {
  round_of_32: '🎯',
  round_of_16: '⚔️',
  quarterfinal: '🥊',
  semifinal: '🔥',
  third_place: '🥉',
  final: '🏆',
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
            <span className="mr-1">{PHASE_ICON[p.phase] ?? ''}</span>{p.label}
          </button>
        ))}
      </div>

      {current && (
        <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden animate-fade-in">
          <div className="bg-yellow-600 px-4 py-2 flex items-center gap-2">
            <span className="text-base">{PHASE_ICON[current.phase] ?? ''}</span>
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

// ─── Thirds table ────────────────────────────────────────────────────────────

function ThirdsSection({ groups }: { groups: GroupData[] }) {
  const thirds = groups
    .map(g => {
      const row = g.standings.find(r => r.pos === 3)
      if (!row) return null
      const complete = g.matches.filter(m => m.status === 'played').length === 6
      return { ...row, groupId: g.id, groupName: g.name, complete }
    })
    .filter(Boolean) as (GroupRow & { groupId: string; groupName: string; complete: boolean })[]

  // Sort: pts DESC, sg DESC, gp DESC (FIFA criteria for best 3rds)
  const sorted = [...thirds].sort((a, b) =>
    b.p !== a.p ? b.p - a.p :
    b.sg !== a.sg ? b.sg - a.sg :
    b.gp !== a.gp ? b.gp - a.gp : 0
  )

  if (sorted.length === 0) {
    return <p className="text-center py-12 text-gray-500 text-sm">Nenhum grupo tem 3ºs lugares ainda.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500">
        Os 8 melhores 3ºs lugares classificam para as 16 avos. Critérios: pontos, saldo de gols, gols marcados.
      </p>
      <div className="rounded-xl border border-gray-800 bg-gray-950 overflow-hidden">
        <div className="bg-amber-700 px-4 py-2">
          <h3 className="font-bold text-white text-sm tracking-wide uppercase">Classificação — Melhores 3º Lugares</h3>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-900 text-gray-500 uppercase tracking-wider">
              <th className="px-2 py-1.5 text-left w-6">#</th>
              <th className="px-1 py-1.5 text-left">Time</th>
              <th className="px-1 py-1.5 text-center w-8">Grupo</th>
              <th className="px-1 py-1.5 text-center w-6" title="Jogos">J</th>
              <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Vitórias">V</th>
              <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Empates">E</th>
              <th className="px-1 py-1.5 text-center w-6 hidden sm:table-cell" title="Derrotas">D</th>
              <th className="px-1 py-1.5 text-center w-7" title="Saldo">SG</th>
              <th className="px-1 py-1.5 text-center w-7 hidden sm:table-cell" title="Gols Pró">GP</th>
              <th className="px-2 py-1.5 text-right w-8 text-gray-200 dark:text-yellow-500" title="Pontos">Pts</th>
              <th className="px-2 py-1.5 text-center w-14"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60">
            {sorted.map((row, idx) => {
              const team = teamById[row.teamId]
              const qualifies = idx < 8
              const border = qualifies ? 'border-l-2 border-amber-500' : 'border-l-2 border-transparent'
              return (
                <tr key={row.teamId} className={`${border} ${!row.complete ? 'opacity-60' : ''}`}>
                  <td className="px-2 py-1.5 text-gray-500 font-semibold">{idx + 1}</td>
                  <td className="px-1 py-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Flag teamId={row.teamId} size={16} />
                      <span className="text-gray-200 font-semibold truncate">
                        <span className="sm:hidden">{row.teamId}</span>
                        <span className="hidden sm:inline">{team?.name ?? row.teamId}</span>
                      </span>
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
                  <td className="px-2 py-1.5 text-center">
                    {!row.complete
                      ? <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded">em jogo</span>
                      : qualifies
                      ? <span className="text-[9px] font-semibold uppercase tracking-wide text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded">classif.</span>
                      : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Top 8 — classificados às 16 avos</span>
        <span className="flex items-center gap-1.5"><span className="opacity-50">⬜</span> Grupo ainda em andamento</span>
      </div>
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

      {/* Group stage progress bar */}
      {!loading && groups.length > 0 && (() => {
        const total = groups.reduce((s, g) => s + g.matches.length, 0)
        const played = groups.reduce((s, g) => s + g.matches.filter(m => m.status === 'played').length, 0)
        if (total === 0) return null
        const pct = Math.round((played / total) * 100)
        const done = played === total
        return (
          <div className="rounded-lg bg-gray-900 border border-gray-800 px-4 py-2.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-gray-400 font-semibold uppercase tracking-wide">Fase de grupos</span>
              <span className="text-gray-300 font-score font-bold">{played}/{total} jogos · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-gray-800 overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${done ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        )
      })()}

      {/* Main tabs */}
      <div className="flex border-b border-gray-800">
        {([['groups', 'Fase de Grupos'], ['thirds', 'Terceiros Lugares'], ['knockout', 'Mata-Mata']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === key
                ? 'text-green-700 dark:text-yellow-400 border-b-2 border-green-700 dark:border-yellow-400 -mb-px'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-gray-800 overflow-hidden">
              <div className="skeleton h-8 w-full" style={{ borderRadius: 0 }} />
              <div className="p-3 space-y-2">
                {Array.from({ length: 4 }).map((_, j) => <div key={j} className="skeleton h-5 w-full" />)}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && tab === 'groups' && (
        <div key="groups" className="space-y-4 animate-fade-in">
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block" /> Classificados (1º e 2º)</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500/60 inline-block" /> Possível vaga como melhor 3º</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {groups.map(g => <GroupCard key={g.id} group={g} />)}
          </div>
        </div>
      )}

      {!loading && tab === 'thirds' && (
        <div key="thirds" className="animate-fade-in"><ThirdsSection groups={groups} /></div>
      )}

      {!loading && tab === 'knockout' && (
        <div key="knockout" className="animate-fade-in"><KnockoutSection phases={knockout} /></div>
      )}
    </div>
  )
}
