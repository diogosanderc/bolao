'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Flag } from '@/components/Flag'
import { Icon } from '@/components/Icon'
import { ALL_MATCHES, teamById, GROUPS } from '@/lib/copa2026'
import { computeBracketFromResults } from '@/lib/bracket'
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
  const [playedMatchIds, setPlayedMatchIds] = useState<Set<string>>(new Set())
  const [results, setResults] = useState<any[]>([])

  useEffect(() => {
    Promise.all([
      fetch('/api/predictions/all').then(r => r.json()),
      fetch('/api/results').then(r => r.json()),
    ])
      .then(([d, res]) => {
        setData(d)
        const arr = Array.isArray(res) ? res : []
        setResults(arr)
        setPlayedMatchIds(new Set(arr.map((r: any) => r.matchId)))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Resolve knockout fixtures (TBD) from the bracket so advancing teams show up
  const resolvedKnockout = useMemo(() => computeBracketFromResults(results as any), [results])
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
      if (playedMatchIds.has(m.id)) return false
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
  }, [search, playedMatchIds, resolvedKnockout])

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

  function shareMatchWhatsApp(matchId: string) {
    const match = ALL_MATCHES.find(m => m.id === matchId)
    if (!match) return
    const [t1Id, t2Id] = teamsOf(match)
    const team1 = teamById[t1Id]
    const team2 = teamById[t2Id]
    const matchPreds = predsByMatch[matchId] ?? {}
    const scoreKeys = Object.keys(matchPreds).sort((a, b) => matchPreds[b].length - matchPreds[a].length)
    const total = scoreKeys.reduce((sum, k) => sum + matchPreds[k].length, 0)

    const lines: string[] = [
      `⚽ *Palpites: ${team1?.name ?? match.team1Id} vs ${team2?.name ?? match.team2Id}*`,
      '',
    ]
    if (scoreKeys.length === 0) {
      lines.push('Nenhum palpite registrado.')
    } else {
      for (const key of scoreKeys) {
        const [s1, s2] = key.split('-')
        const names = matchPreds[key].sort()
        lines.push(`*${s1} × ${s2}* (${names.length}): ${names.join(', ')}`)
      }
    }
    const text = encodeURIComponent(lines.join('\n'))
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }


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
        <h2 className="text-2xl font-bold text-gray-200 dark:text-yellow-400">Palpites de Todos</h2>
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
                const [t1Id, t2Id] = teamsOf(match)
                const team1 = teamById[t1Id]
                const team2 = teamById[t2Id]
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
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-900 hover:bg-gray-800 transition-colors text-left text-gray-200"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs text-gray-600 shrink-0">#{match.matchNumber}</span>
                        <span className="font-semibold text-gray-200 text-sm inline-flex items-center gap-1.5 flex-wrap">
                          {team1 ? <><Flag teamId={t1Id} size={18} /> {team1.name}</> : <span className="text-gray-500 italic">a definir</span>}
                          <span className="text-gray-500 mx-1">vs</span>
                          {team2 ? <><Flag teamId={t2Id} size={18} /> {team2.name}</> : <span className="text-gray-500 italic">a definir</span>}
                        </span>
                        {match.date && (
                          <span className="text-xs text-gray-600 hidden sm:inline shrink-0">{match.date}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        <span className="text-xs text-gray-500">{totalPreds} palpites</span>
                        <button
                          onClick={e => { e.stopPropagation(); shareMatchWhatsApp(match.id) }}
                          title="Compartilhar no WhatsApp"
                          className="text-green-600 hover:text-green-400 transition-colors p-0.5"
                        >
                          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                          </svg>
                        </button>
                        <Icon name={isExpanded ? 'chevron-up' : 'chevron-down'} size={14} className="text-gray-600" />
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
                                  <span className="font-bold text-lg text-green-700 dark:text-yellow-400">{s1} × {s2}</span>
                                  <div className="text-xs text-gray-600 mt-0.5">{names.length} ({pct}%)</div>
                                </div>
                                <div className="flex flex-wrap gap-1.5 text-xs text-gray-400">
                                  {names.sort().map(name => (
                                    <span key={name} className="bg-gray-800 rounded px-2 py-0.5" title={name}>{name === 'LUCILIO' ? 'LCLI' : name === 'MORELLI' ? 'MRLI' : name.substring(0, 4)}</span>
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
