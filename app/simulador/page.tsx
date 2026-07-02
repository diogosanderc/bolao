'use client'

import { useEffect, useRef, useState, useCallback, ReactNode } from 'react'
import { GROUPS, GROUP_MATCHES, KNOCKOUT_MATCHES, teamById } from '@/lib/copa2026'
import { Flag } from '@/components/Flag'
import { Icon } from '@/components/Icon'
import { LeaderboardEntry, MatchResult } from '@/lib/types'

type SimScore = { score1: string; score2: string }
type Bracket = Record<string, { team1Id: string; team2Id: string }>
type PhaseKey = 'group' | 'round_of_32' | 'round_of_16' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final'

const PHASE_TABS: { key: PhaseKey; label: string }[] = [
  { key: 'group',       label: 'Grupos'   },
  { key: 'round_of_32', label: '16 avos'  },
  { key: 'round_of_16', label: 'Oitavas'  },
  { key: 'quarterfinal',label: 'Quartas'  },
  { key: 'semifinal',   label: 'Semi'     },
  { key: 'third_place', label: '3º Lugar' },
  { key: 'final',       label: 'Final'    },
]

export default function SimuladorPage() {
  const [inputs, setInputs]       = useState<Record<string, SimScore>>({})
  const [bracket, setBracket]     = useState<Bracket>({})
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [simulating, setSimulating]   = useState(false)
  const [phase, setPhase]         = useState<PhaseKey>('group')
  const [openGroup, setOpenGroup] = useState('A')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSimulate = useCallback(async (current: Record<string, SimScore>) => {
    setSimulating(true)
    const overrides: MatchResult[] = Object.entries(current)
      .filter(([, s]) => s.score1 !== '' && s.score2 !== '' && !isNaN(+s.score1) && !isNaN(+s.score2))
      .map(([matchId, s]) => ({ matchId, score1: +s.score1, score2: +s.score2 }))
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overrides }),
      })
      const data = await res.json()
      setLeaderboard(data.leaderboard ?? [])
      setBracket(data.bracket ?? {})
    } catch {}
    setSimulating(false)
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/results').then(r => r.json()).catch(() => []),
      fetch('/api/copa-standings').then(r => r.json()).catch(() => ({})),
    ]).then(([results, standings]) => {
      const init: Record<string, SimScore> = {}
      for (const r of (results as MatchResult[])) {
        init[r.matchId] = { score1: String(r.score1), score2: String(r.score2) }
      }
      // Seed knockout played matches from copa-standings (includes liveMatchStates completed)
      for (const phase of (standings.knockout ?? [])) {
        for (const m of (phase.matches ?? [])) {
          if (m.status === 'played' && m.score1 != null && m.score2 != null) {
            init[m.matchId] = { score1: String(m.score1), score2: String(m.score2) }
          }
        }
      }
      setInputs(init)
      runSimulate(init)
    })
  }, [runSimulate])

  const handleInput = (matchId: string, field: 'score1' | 'score2', value: string) => {
    const prev = inputs[matchId] ?? { score1: '', score2: '' }
    const next = { ...inputs, [matchId]: { ...prev, [field]: value } }
    setInputs(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSimulate(next), 400)
  }

  const clearSim = () => {
    Promise.all([
      fetch('/api/results').then(r => r.json()).catch(() => []),
      fetch('/api/copa-standings').then(r => r.json()).catch(() => ({})),
    ]).then(([results, standings]) => {
      const init: Record<string, SimScore> = {}
      for (const r of (results as MatchResult[])) {
        init[r.matchId] = { score1: String(r.score1), score2: String(r.score2) }
      }
      for (const phase of (standings.knockout ?? [])) {
        for (const m of (phase.matches ?? [])) {
          if (m.status === 'played' && m.score1 != null && m.score2 != null) {
            init[m.matchId] = { score1: String(m.score1), score2: String(m.score2) }
          }
        }
      }
      setInputs(init)
      runSimulate(init)
    })
  }

  const uniquePoints = [...new Set(leaderboard.map(e => e.totalPoints))].sort((a, b) => b - a)
  const tierOf = (pts: number) => uniquePoints.indexOf(pts) + 1
  const trophies: Record<number, ReactNode> = {
    1: <Icon name="medal" size={15} className="text-yellow-500 inline" />,
    2: <Icon name="medal" size={15} className="text-gray-400 inline" />,
    3: <Icon name="medal" size={15} className="text-amber-600 inline" />,
  }

  const knockoutMatches = (phaseKey: PhaseKey) =>
    KNOCKOUT_MATCHES.filter(m => m.phase === phaseKey).map(m => ({
      ...m,
      team1Id: bracket[m.id]?.team1Id ?? 'TBD',
      team2Id: bracket[m.id]?.team2Id ?? 'TBD',
    }))

  const renderMatchRow = (matchId: string, team1Id: string, team2Id: string) => {
    const s = inputs[matchId] ?? { score1: '', score2: '' }
    const t1 = teamById[team1Id]
    const t2 = teamById[team2Id]
    const tbd = team1Id === 'TBD' || team2Id === 'TBD'
    return (
      <div key={matchId} className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg bg-gray-900 border border-gray-800 ${tbd ? 'opacity-40' : ''}`}>
        <span className="text-xs text-gray-300 flex-1 text-right truncate min-w-0">{t1?.name ?? team1Id}</span>
        <span className="shrink-0">{team1Id !== 'TBD' ? <Flag teamId={team1Id} size={18} /> : <Icon name="flag" size={16} className="text-gray-600" />}</span>
        <input
          type="number" min="0" max="20"
          value={s.score1}
          onChange={e => handleInput(matchId, 'score1', e.target.value)}
          disabled={tbd}
          className="w-9 text-center bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm py-0.5 focus:outline-none focus:border-yellow-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="text-gray-600 text-xs shrink-0">×</span>
        <input
          type="number" min="0" max="20"
          value={s.score2}
          onChange={e => handleInput(matchId, 'score2', e.target.value)}
          disabled={tbd}
          className="w-9 text-center bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm py-0.5 focus:outline-none focus:border-yellow-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <span className="shrink-0">{team2Id !== 'TBD' ? <Flag teamId={team2Id} size={18} /> : <Icon name="flag" size={16} className="text-gray-600" />}</span>
        <span className="text-xs text-gray-300 flex-1 truncate min-w-0">{t2?.name ?? team2Id}</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold text-gray-200 dark:text-yellow-400">Simulador</h2>
          <p className="text-xs text-gray-500 mt-0.5">Insira resultados hipotéticos e veja como a classificação muda — nada é salvo</p>
        </div>
        <div className="flex gap-2 items-center">
          {simulating && <span className="text-xs text-gray-400 animate-pulse">Calculando…</span>}
          <button
            onClick={clearSim}
            className="text-sm px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 transition-colors"
          >
            <span className="inline-flex items-center gap-1.5"><Icon name="refresh" size={14} /> Limpar simulação</span>
          </button>
        </div>
      </div>

      <div className="flex gap-5 flex-col lg:flex-row">
        {/* LEFT: Match inputs */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Phase tabs */}
          <div className="flex flex-wrap gap-1">
            {PHASE_TABS.map(p => (
              <button
                key={p.key}
                onClick={() => setPhase(p.key)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  phase === p.key
                    ? 'bg-yellow-500 text-black border-yellow-500 font-bold'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Group stage */}
          {phase === 'group' && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1">
                {GROUPS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setOpenGroup(g.id)}
                    className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                      openGroup === g.id
                        ? 'bg-green-700 text-white border-green-600 font-bold'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                    }`}
                  >
                    {g.id}
                  </button>
                ))}
              </div>
              <div className="space-y-1.5">
                {GROUP_MATCHES.filter(m => m.groupId === openGroup).map(m =>
                  renderMatchRow(m.id, m.team1Id, m.team2Id)
                )}
              </div>
            </div>
          )}

          {/* Knockout phases */}
          {phase !== 'group' && (
            <div className="space-y-1.5">
              {knockoutMatches(phase).length === 0 && (
                <p className="text-gray-600 text-sm text-center py-6">Nenhum jogo nesta fase</p>
              )}
              {knockoutMatches(phase).map(m =>
                renderMatchRow(m.id, m.team1Id, m.team2Id)
              )}
              {knockoutMatches(phase).some(m => m.team1Id === 'TBD') && (
                <p className="text-xs text-gray-600 text-center pt-1">
                  Times marcados como TBD serão preenchidos conforme os resultados dos grupos são simulados
                </p>
              )}
            </div>
          )}
        </div>

        {/* RIGHT: Simulated leaderboard */}
        <div className="lg:w-72 xl:w-80 shrink-0">
          <div className="lg:sticky lg:top-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Classificação simulada</h3>
              {simulating && <span className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse inline-block" />}
            </div>
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-3 py-2 text-left w-8">#</th>
                    <th className="px-3 py-2 text-left">Participante</th>
                    <th className="px-3 py-2 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {leaderboard.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-8 text-center text-gray-600 text-xs">
                        Insira resultados para simular
                      </td>
                    </tr>
                  )}
                  {leaderboard.map((entry, idx) => {
                    const tier = tierOf(entry.totalPoints)
                    const rank = leaderboard.filter(e => e.totalPoints > entry.totalPoints).length + 1
                    const isFirst = idx === 0 || entry.totalPoints !== leaderboard[idx - 1].totalPoints
                    return (
                      <tr
                        key={entry.participant.id}
                        className={`text-xs transition-colors ${
                          tier === 1 ? 'bg-yellow-100 dark:bg-yellow-950/40' :
                          tier === 2 ? 'bg-gray-800/30' :
                          tier === 3 ? 'bg-orange-50 dark:bg-orange-950/30' : ''
                        }`}
                      >
                        <td className="px-3 py-1.5 text-center font-bold">
                          {trophies[tier] ?? (isFirst ? <span className="text-gray-500">{rank}</span> : null)}
                        </td>
                        <td className="px-3 py-1.5 text-gray-200 truncate max-w-[160px]">
                          {entry.participant.name}
                        </td>
                        <td className="px-3 py-1.5 text-right font-bold text-yellow-600 dark:text-yellow-400">
                          {entry.totalPoints}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
