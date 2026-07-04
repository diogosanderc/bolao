'use client'

import { useEffect, useMemo, useState } from 'react'
import { Flag } from '@/components/Flag'
import { Icon } from '@/components/Icon'
import { ALL_MATCHES, teamById, GROUPS, matchById } from '@/lib/copa2026'
import { computeBracketFromResults } from '@/lib/bracket'
import { PHASE_LABELS, MatchPrediction, MatchResult, Phase } from '@/lib/types'

type ParticipantInfo = { id: string; name: string }

type AllData = {
  participants: ParticipantInfo[]
  matchPredictions: MatchPrediction[]
}

const PHASE_ORDER: Phase[] = [
  'group', 'round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final',
]

const PHASE_FILTER_LABELS: { value: Phase | 'all'; label: string }[] = [
  { value: 'all',         label: 'Todos' },
  { value: 'group',       label: 'Grupos' },
  { value: 'round_of_32', label: '16 avos' },
  { value: 'round_of_16', label: 'Oitavas' },
  { value: 'quarterfinal',label: 'Quartas' },
  { value: 'semifinal',   label: 'Semi' },
  { value: 'final',       label: 'Final' },
]

export default function PalpitesDeTodosPage() {
  const [data, setData] = useState<AllData | null>(null)
  const [results, setResults] = useState<MatchResult[]>([])
  const [loading, setLoading] = useState(true)
  const [matchSearch, setMatchSearch] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const [phaseFilter, setPhaseFilter] = useState<Phase | 'all'>('all')
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set())

  useEffect(() => {
    Promise.all([
      fetch('/api/predictions/all').then(r => r.json()),
      fetch('/api/results').then(r => r.json()),
    ])
      .then(([d, res]) => {
        setData(d)
        const resultList: MatchResult[] = Array.isArray(res) ? res : []
        setResults(resultList)
        // Auto-select the phase currently being disputed: the first knockout
        // phase with games still to play (oitavas now → quartas → semi → ...)
        const played = new Set(resultList.map(r => r.matchId))
        const groupDone = ALL_MATCHES.filter(m => m.phase === 'group').every(m => played.has(m.id))
        if (groupDone) {
          const KO_PHASES: Phase[] = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'final']
          const current = KO_PHASES.find(ph =>
            ALL_MATCHES.some(m => m.phase === ph && !played.has(m.id))
          ) ?? 'final'
          setPhaseFilter(current)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const resultByMatch = useMemo(
    () => Object.fromEntries(results.map(r => [r.matchId, r])),
    [results]
  )

  // Resolve knockout fixtures (TBD) from the bracket so advancing teams show up
  const resolvedKnockout = useMemo(() => computeBracketFromResults(results), [results])
  function teamsOf(m: { id: string; team1Id: string; team2Id: string }): [string, string] {
    const rk = resolvedKnockout[m.id]
    return [
      m.team1Id !== 'TBD' ? m.team1Id : (rk?.team1Id ?? 'TBD'),
      m.team2Id !== 'TBD' ? m.team2Id : (rk?.team2Id ?? 'TBD'),
    ]
  }

  const participantById = useMemo(() => {
    if (!data) return {}
    return Object.fromEntries(data.participants.map(p => [p.id, p]))
  }, [data])

  // Manual overrides for ambiguous abbreviations
  const CHIP_OVERRIDES: Record<string, string> = {
    'MORELLI': 'MRLI',
    'LUCILIO': 'LCLI',
    'MOREATICO': 'MORE',
    'LUCIO VENTURIM': 'LUCI',
  }

  // Shortest unique prefix per participant (min 4 chars, grows until no collision)
  const chipLabel = useMemo(() => {
    if (!data) return (name: string) => name.slice(0, 4).toUpperCase()
    const names = data.participants.map(p => p.name.toUpperCase())
    const labels = new Map<string, string>()
    for (const name of names) {
      if (CHIP_OVERRIDES[name]) { labels.set(name, CHIP_OVERRIDES[name]); continue }
      let len = 4
      while (len < name.length && names.some(n => n !== name && !CHIP_OVERRIDES[n] && n.slice(0, len) === name.slice(0, len))) len++
      labels.set(name, name.slice(0, len))
    }
    return (name: string) => labels.get(name.toUpperCase()) ?? name.slice(0, 4).toUpperCase()
  }, [data])

  // matchId → participantId → prediction
  const predsByMatch = useMemo(() => {
    if (!data) return {}
    const map: Record<string, Record<string, MatchPrediction>> = {}
    for (const pred of data.matchPredictions) {
      if (!map[pred.matchId]) map[pred.matchId] = {}
      map[pred.matchId][pred.participantId] = pred
    }
    return map
  }, [data])

  const filteredMatches = useMemo(() => {
    const q = matchSearch.trim().toUpperCase()
    return ALL_MATCHES.filter(m => {
      if (phaseFilter !== 'all' && m.phase !== phaseFilter) return false
      if (!q) return true
      const [t1, t2] = teamsOf(m)
      const team1 = teamById[t1]
      const team2 = teamById[t2]
      return (
        m.id.toUpperCase().includes(q) ||
        team1?.name.toUpperCase().includes(q) ||
        team2?.name.toUpperCase().includes(q) ||
        (m.groupId && `GRUPO ${m.groupId}`.includes(q))
      )
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchSearch, phaseFilter, resolvedKnockout])

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

  if (loading) {
    return <div className="text-center py-20 text-gray-400">Carregando palpites...</div>
  }

  const totalParticipants = data?.participants.length ?? 0
  const nq = nameFilter.trim().toUpperCase()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex justify-center"><Icon name="ball" size={28} className="text-[#00bf63]" strokeWidth={1.4} /></div>
        <h2 className="text-2xl font-bold text-gray-200">Palpites de Todos</h2>
        <span className="text-xs text-gray-500 ml-1">({totalParticipants} participantes)</span>
      </div>

      {/* Phase filter pills */}
      <div className="flex flex-wrap gap-1.5">
        {PHASE_FILTER_LABELS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => { setPhaseFilter(value); setExpandedMatches(new Set()) }}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors whitespace-nowrap ${
              phaseFilter === value
                ? 'bg-green-600 border-green-500 text-white font-semibold'
                : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          value={matchSearch}
          onChange={e => setMatchSearch(e.target.value)}
          placeholder="Filtrar por time ou grupo..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 placeholder:text-gray-600"
        />
        <input
          type="text"
          value={nameFilter}
          onChange={e => setNameFilter(e.target.value)}
          placeholder="Filtrar por participante..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500 placeholder:text-gray-600"
        />
        <div className="flex gap-2 shrink-0">
          <button onClick={expandAll} className="text-xs text-gray-400 hover:text-white px-2 py-2 border border-gray-800 rounded-lg whitespace-nowrap">
            Expandir tudo
          </button>
          <button onClick={collapseAll} className="text-xs text-gray-400 hover:text-white px-2 py-2 border border-gray-800 rounded-lg whitespace-nowrap">
            Recolher tudo
          </button>
        </div>
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
                const [t1Id, t2Id] = teamsOf(match)
                const team1 = teamById[t1Id]
                const team2 = teamById[t2Id]
                const matchPreds = predsByMatch[match.id] ?? {}
                const result = resultByMatch[match.id]
                const isPlayed = !!result
                const isExpanded = expandedMatches.has(match.id)

                let rows = (data?.participants ?? [])
                  .map(p => ({ participant: p, pred: matchPreds[p.id] }))
                  .filter(r => !nq || r.participant.name.toUpperCase().includes(nq))
                rows = rows.slice().sort((a, b) => a.participant.name.localeCompare(b.participant.name))
                const predictedCount = rows.filter(r => r.pred).length

                return (
                  <div key={match.id} className="border border-gray-800 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleMatch(match.id)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left text-gray-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-600 shrink-0">#{match.matchNumber}</span>
                        <span className="font-semibold text-gray-200 text-sm inline-flex items-center gap-1.5 flex-wrap">
                          {team1 ? <><Flag teamId={t1Id} size={18} /> {t1Id}</> : <span className="text-gray-500 italic">a definir</span>}
                          <span className="text-gray-500 mx-1">vs</span>
                          {team2 ? <><Flag teamId={t2Id} size={18} /> {t2Id}</> : <span className="text-gray-500 italic">a definir</span>}
                        </span>
                        {isPlayed && (
                          <span className="text-xs font-bold text-yellow-400 font-score shrink-0">{result!.score1}–{result!.score2}</span>
                        )}
                        {match.date && (
                          <span className="text-xs text-gray-600 hidden sm:inline shrink-0">{match.date}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-gray-500">{predictedCount}/{rows.length} palpites</span>
                        <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} className="text-gray-500" />
                      </div>
                    </button>

                    {isExpanded && (() => {
                      // Group participants by their predicted score
                      const groups: Map<string, { pred: MatchPrediction | undefined; participants: ParticipantInfo[] }> = new Map()
                      for (const { participant, pred } of rows) {
                        const key = pred ? `${pred.score1}-${pred.score2}${pred.advancingTeamId ? `|${pred.advancingTeamId}` : ''}` : '__none__'
                        if (!groups.has(key)) groups.set(key, { pred, participants: [] })
                        groups.get(key)!.participants.push(participant)
                      }
                      const sorted = [...groups.values()].sort((a, b) => b.participants.length - a.participants.length)

                      return (
                        <div className="divide-y divide-gray-800/60 bg-gray-950">
                          {rows.length === 0 && (
                            <p className="text-center py-6 text-gray-600 text-sm">Nenhum participante encontrado.</p>
                          )}
                          {sorted.map(({ pred, participants }, i) => {
                            let colorClass = 'text-gray-500 bg-gray-800'
                            if (isPlayed && pred) {
                              const exact = pred.score1 === result!.score1 && pred.score2 === result!.score2
                              const sameResult = !exact && Math.sign(pred.score1 - pred.score2) === Math.sign(result!.score1 - result!.score2)
                              if (exact) colorClass = 'text-green-300 bg-green-950'
                              else if (sameResult) colorClass = 'text-blue-300 bg-blue-950/50'
                              else colorClass = 'text-red-400 bg-red-950/40'
                            }
                            return (
                              <div key={i} className="flex items-center gap-3 px-4 py-2">
                                <span className={`font-bold px-2 py-0.5 rounded font-score shrink-0 text-sm ${colorClass}`}>
                                  {pred ? `${pred.score1}–${pred.score2}` : '—'}
                                </span>
                                {pred?.advancingTeamId && pred.score1 === pred.score2 && (
                                  <span className="text-[10px] text-gray-600 shrink-0">{pred.advancingTeamId}</span>
                                )}
                                <span className="text-xs text-gray-600 shrink-0">×{participants.length}</span>
                                <div className="flex flex-wrap gap-1">
                                  {participants.map(p => (
                                    <span key={p.id} className="text-[11px] font-mono bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
                                      {chipLabel(p.name)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })()}
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
