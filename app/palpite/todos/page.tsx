'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Flag } from '@/components/Flag'
import { ALL_MATCHES, teamById, GROUPS } from '@/lib/copa2026'
import { PHASE_LABELS, MatchPrediction, Phase } from '@/lib/types'

type ParticipantInfo = { id: string; name: string }

type AllData = {
  participants: ParticipantInfo[]
  matchPredictions: MatchPrediction[]
}

const PHASE_ORDER: Phase[] = [
  'group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final',
]

export default function TodosPalpitesPage() {
  const [data, setData] = useState<AllData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/predictions/all')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const participantById = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(data.participants.map(p => [p.id, p]))
  }, [data])

  // Group predictions by matchId → scoreKey → participantNames
  const predsByMatch = useMemo(() => {
    if (!data) return {}
    const map: Record<string, Record<string, string[]>> = {}
    for (const pred of data.matchPredictions) {
      if (!map[pred.matchId]) map[pred.matchId] = {}
      const key = `${pred.score1}-${pred.score2}`
      if (!map[pred.matchId][key]) map[pred.matchId][key] = []
      const name = participantById[pred.participantId]?.name ?? pred.participantId
      map[pred.matchId][key].push(name)
    }
    return map
  }, [data, participantById])

  // Filter matches by group/phase search
  const filteredMatches = useMemo(() => {
    const q = search.trim().toUpperCase()
    return ALL_MATCHES.filter(m => {
      if (!q) return true
      const team1 = teamById[m.team1Id]
      const team2 = teamById[m.team2Id]
      return (
        m.id.toUpperCase().includes(q) ||
        team1?.name.toUpperCase().includes(q) ||
        team2?.name.toUpperCase().includes(q) ||
        (m.groupId && `GRUPO ${m.groupId}`.includes(q))
      )
    })
  }, [search])

  function toggleMatch(matchId: string) {
    setExpandedMatches(prev => {
      const next = new Set(prev)
      if (next.has(matchId)) next.delete(matchId)
      else next.add(matchId)
      return next
    })
  }

  function expandAll() {
    setExpandedMatches(new Set(filteredMatches.map(m => m.id)))
  }

  function collapseAll() {
    setExpandedMatches(new Set())
  }

  // Matches grouped by phase then by group
  const matchesByPhase = useMemo(() => {
    const result: { phase: Phase; label: string; groups: { groupLabel: string; matches: typeof ALL_MATCHES }[] }[] = []
    for (const phase of PHASE_ORDER) {
      const phaseMatches = filteredMatches.filter(m => m.phase === phase)
      if (phaseMatches.length === 0) continue
      if (phase === 'group') {
        const byGroup: Record<string, typeof ALL_MATCHES> = {}
        for (const m of phaseMatches) {
          const g = m.groupId ?? '?'
          if (!byGroup[g]) byGroup[g] = []
          byGroup[g].push(m)
        }
        const groups = GROUPS
          .filter(g => byGroup[g.id])
          .map(g => ({ groupLabel: g.name, matches: byGroup[g.id] }))
        result.push({ phase, label: PHASE_LABELS[phase], groups })
      } else {
        result.push({ phase, label: PHASE_LABELS[phase], groups: [{ groupLabel: '', matches: phaseMatches }] })
      }
    }
    return result
  }, [filteredMatches])

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Carregando palpites...</div>
  }

  const totalParticipants = data?.participants.length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/palpite" className="text-gray-400 hover:text-white text-sm">← Voltar</Link>
        <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">Palpites de Todos</h2>
        <span className="text-xs text-gray-500 ml-1">({totalParticipants} participantes)</span>
      </div>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por time ou grupo..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 placeholder:text-gray-600"
        />
        <button onClick={expandAll} className="text-xs text-gray-400 hover:text-white px-2 py-2 border border-gray-800 rounded-lg">
          Expandir tudo
        </button>
        <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-white px-2 py-2 border border-gray-800 rounded-lg">
          Recolher tudo
        </button>
      </div>

      {matchesByPhase.map(({ phase, label, groups }) => (
        <div key={phase} className="space-y-3">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider pt-2">{label}</h3>
          {groups.map(({ groupLabel, matches }) => (
            <div key={groupLabel || phase} className="space-y-2">
              {groupLabel && (
                <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wider pl-1">{groupLabel}</h4>
              )}
              {matches.map(match => {
                const team1 = teamById[match.team1Id]
                const team2 = teamById[match.team2Id]
                const matchPreds = predsByMatch[match.id] ?? {}
                const scoreKeys = Object.keys(matchPreds).sort((a, b) => {
                  return matchPreds[b].length - matchPreds[a].length
                })
                const totalPreds = scoreKeys.reduce((sum, k) => sum + matchPreds[k].length, 0)
                const isExpanded = expandedMatches.has(match.id)

                return (
                  <div key={match.id} className="border border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleMatch(match.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-600 shrink-0">#{match.matchNumber}</span>
                        <span className="font-semibold text-white text-sm">
                          {team1 ? <><Flag teamId={match.team1Id} size={18} /> {team1.name}</> : match.team1Id}
                          <span className="text-gray-500 mx-2">vs</span>
                          {team2 ? <><Flag teamId={match.team2Id} size={18} /> {team2.name}</> : match.team2Id}
                        </span>
                        {match.date && (
                          <span className="text-xs text-gray-600 hidden sm:inline shrink-0">{match.date}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-gray-500">{totalPreds} palpites</span>
                        <span className="text-gray-600">{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="divide-y divide-gray-800">
                        {scoreKeys.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-600">Nenhum palpite</div>
                        ) : (
                          scoreKeys.map(key => {
                            const [s1, s2] = key.split('-')
                            const names = matchPreds[key]
                            const pct = totalPreds > 0 ? Math.round((names.length / totalPreds) * 100) : 0
                            return (
                              <div key={key} className="px-4 py-3 flex gap-4 items-start">
                                <div className="shrink-0 w-14 text-center">
                                  <span className="font-bold text-lg text-yellow-400">{s1} × {s2}</span>
                                  <div className="text-xs text-gray-600 mt-0.5">{names.length} ({pct}%)</div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 text-xs text-gray-400">
                                  {names.sort().map(name => (
                                    <span key={name} className="bg-gray-800 rounded px-2 py-0.5">{name}</span>
                                  ))}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
