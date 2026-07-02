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
  const [realTeams, setRealTeams] = useState<Bracket>({})
  const [advancing, setAdvancing] = useState<Record<string, string>>({})
  const [liveIds, setLiveIds]     = useState<Record<string, boolean>>({})
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [simulating, setSimulating]   = useState(false)
  const [phase, setPhase]         = useState<PhaseKey>('group')
  const [openGroup, setOpenGroup] = useState('A')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSimulate = useCallback(async (current: Record<string, SimScore>, adv: Record<string, string> = {}) => {
    setSimulating(true)
    const overrides: MatchResult[] = Object.entries(current)
      .filter(([, s]) => s.score1 !== '' && s.score2 !== '' && !isNaN(+s.score1) && !isNaN(+s.score2))
      .map(([matchId, s]) => {
        const isDraw = +s.score1 === +s.score2
        const isKnockout = !matchId.startsWith('G')
        const pick = isKnockout && isDraw ? adv[matchId] : undefined
        return { matchId, score1: +s.score1, score2: +s.score2, ...(pick ? { advancingTeamId: pick } : {}) }
      })
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

  const loadFromServer = useCallback(() => {
    Promise.all([
      fetch('/api/results').then(r => r.json()).catch(() => []),
      fetch('/api/copa-standings').then(r => r.json()).catch(() => ({})),
    ]).then(([results, standings]) => {
      const init: Record<string, SimScore> = {}
      for (const r of (results as MatchResult[])) {
        // Knockout matches that went to ET: seed with the 90-min score — that's what counts
        const s1 = r.regulationScore1 ?? r.score1
        const s2 = r.regulationScore2 ?? r.score2
        init[r.matchId] = { score1: String(s1), score2: String(s2) }
      }
      // Seed knockout matches from copa-standings (includes liveMatchStates completed)
      // and capture the real resolved teams — same source the /tabela renders.
      const teams: Bracket = {}
      const adv: Record<string, string> = {}
      const live: Record<string, boolean> = {}
      const collectLive = (m: any) => { if (m.status === 'live') live[m.matchId] = true }
      for (const g of (standings.groups ?? [])) {
        for (const m of (g.matches ?? [])) collectLive(m)
      }
      for (const phase of (standings.knockout ?? [])) {
        for (const m of (phase.matches ?? [])) {
          collectLive(m)
          teams[m.matchId] = { team1Id: m.team1Id ?? 'TBD', team2Id: m.team2Id ?? 'TBD' }
          if ((m.status === 'played' || m.status === 'live') && m.score1 != null && m.score2 != null) {
            const s1 = m.regulationScore1 ?? m.score1
            const s2 = m.regulationScore2 ?? m.score2
            init[m.matchId] = { score1: String(s1), score2: String(s2) }
          }
          if (m.advancingTeamId) adv[m.matchId] = m.advancingTeamId
        }
      }
      setRealTeams(teams)
      setAdvancing(adv)
      setLiveIds(live)
      setInputs(init)
      runSimulate(init, adv)
    })
  }, [runSimulate])

  useEffect(() => { loadFromServer() }, [loadFromServer])

  const handleInput = (matchId: string, field: 'score1' | 'score2', value: string) => {
    const prev = inputs[matchId] ?? { score1: '', score2: '' }
    const next = { ...inputs, [matchId]: { ...prev, [field]: value } }
    setInputs(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSimulate(next, advancing), 400)
  }

  const handleAdvance = (matchId: string, teamId: string) => {
    const next = { ...advancing, [matchId]: teamId }
    setAdvancing(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    runSimulate(inputs, next)
  }

  const clearSim = () => loadFromServer()

  const uniquePoints = [...new Set(leaderboard.map(e => e.totalPoints))].sort((a, b) => b - a)
  const tierOf = (pts: number) => uniquePoints.indexOf(pts) + 1
  const trophies: Record<number, ReactNode> = {
    1: <Icon name="medal" size={15} className="text-yellow-500 inline" />,
    2: <Icon name="medal" size={15} className="text-gray-400 inline" />,
    3: <Icon name="medal" size={15} className="text-amber-600 inline" />,
  }

  const knockoutMatches = (phaseKey: PhaseKey) =>
    KNOCKOUT_MATCHES.filter(m => m.phase === phaseKey).map(m => {
      // Prefer the simulated bracket; fall back to the real teams from /tabela
      const sim = bracket[m.id]
      const real = realTeams[m.id]
      const t1 = sim?.team1Id && sim.team1Id !== 'TBD' ? sim.team1Id : (real?.team1Id ?? 'TBD')
      const t2 = sim?.team2Id && sim.team2Id !== 'TBD' ? sim.team2Id : (real?.team2Id ?? 'TBD')
      return { ...m, team1Id: t1, team2Id: t2 }
    })

  const renderMatchRow = (matchId: string, team1Id: string, team2Id: string) => {
    const s = inputs[matchId] ?? { score1: '', score2: '' }
    const t1 = teamById[team1Id]
    const t2 = teamById[team2Id]
    const tbd = team1Id === 'TBD' || team2Id === 'TBD'
    const isLive = Boolean(liveIds[matchId])
    const locked = tbd || isLive
    const isKnockout = !matchId.startsWith('G')
    const isDraw = !tbd && s.score1 !== '' && s.score2 !== '' && +s.score1 === +s.score2
    // 3rd-place match: only the score counts — a draw needs no advancing pick
    const needsAdvance = isKnockout && isDraw && matchId !== 'TP_1'
    const pick = advancing[matchId]
    return (
      <div key={matchId} className={`rounded-lg bg-gray-900 border ${isLive ? 'border-green-800' : 'border-gray-800'} ${tbd ? 'opacity-40' : ''}`}>
        <div className="flex items-center gap-1.5 py-1.5 px-2">
          <span className="text-xs text-gray-300 flex-1 text-right truncate min-w-0">{t1?.name ?? team1Id}</span>
          <span className="shrink-0">{team1Id !== 'TBD' ? <Flag teamId={team1Id} size={18} /> : <Icon name="flag" size={16} className="text-gray-600" />}</span>
          <input
            type="number" min="0" max="20"
            value={s.score1}
            onChange={e => handleInput(matchId, 'score1', e.target.value)}
            disabled={locked}
            className="w-9 text-center bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm py-0.5 focus:outline-none focus:border-yellow-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="text-gray-600 text-xs shrink-0">×</span>
          <input
            type="number" min="0" max="20"
            value={s.score2}
            onChange={e => handleInput(matchId, 'score2', e.target.value)}
            disabled={locked}
            className="w-9 text-center bg-gray-800 border border-gray-700 rounded text-gray-200 text-sm py-0.5 focus:outline-none focus:border-yellow-500 disabled:opacity-40 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <span className="shrink-0">{team2Id !== 'TBD' ? <Flag teamId={team2Id} size={18} /> : <Icon name="flag" size={16} className="text-gray-600" />}</span>
          <span className="text-xs text-gray-300 flex-1 truncate min-w-0">{t2?.name ?? team2Id}</span>
        </div>
        {isLive && (
          <div className="flex items-center gap-1.5 pb-1.5 px-2">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block shrink-0" />
            <span className="text-[10px] text-green-500">Ao vivo — placar bloqueado durante o jogo</span>
          </div>
        )}
        {needsAdvance && !isLive && (
          <div className="flex items-center gap-1.5 pb-1.5 px-2">
            <span className="text-[10px] text-gray-500 shrink-0">Avança para próxima fase:</span>
            {[team1Id, team2Id].map(teamId => (
              <button
                key={teamId}
                onClick={() => handleAdvance(matchId, teamId)}
                className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                  pick === teamId
                    ? 'bg-yellow-500 text-black border-yellow-500 font-bold'
                    : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                }`}
              >
                <Flag teamId={teamId} size={13} />
                {teamById[teamId]?.name ?? teamId}
              </button>
            ))}
          </div>
        )}
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

      {/* Manual: how to fill in the simulator */}
      <details className="rounded-xl border border-gray-800 bg-gray-900 overflow-hidden group">
        <summary className="px-4 py-3 cursor-pointer select-none text-sm font-semibold text-gray-200 flex items-center gap-2 hover:bg-gray-800/50 transition-colors">
          <Icon name="bulb" size={15} className="text-yellow-500 shrink-0" />
          Como preencher o simulador — leia antes de simular
          <span className="ml-auto text-gray-500 text-xs group-open:hidden">mostrar</span>
          <span className="ml-auto text-gray-500 text-xs hidden group-open:inline">ocultar</span>
        </summary>
        <div className="px-4 pb-4 pt-1 space-y-4 text-sm text-gray-400 border-t border-gray-800">
          <div className="space-y-1.5">
            <h4 className="font-semibold text-yellow-500 text-xs uppercase tracking-wide pt-2">⏱ Tempo regulamentar (90 minutos)</h4>
            <p>
              Preencha sempre o placar do <strong className="text-gray-200">tempo regulamentar (90 min)</strong>.
              Gols de prorrogação e pênaltis <strong className="text-gray-200">não contam</strong> para a pontuação dos palpites.
            </p>
            <p className="text-xs bg-gray-950/60 border border-gray-800 rounded-lg px-3 py-2">
              <strong className="text-gray-300">Exemplo:</strong> Bélgica 3×2 Senegal, com gol decisivo na prorrogação.
              O placar que vale pontos é <strong className="text-gray-200">2×2</strong> (fim dos 90 min) — preencha 2×2 e
              marque a <strong className="text-gray-200">Bélgica</strong> em &quot;Avança para próxima fase&quot;.
            </p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-semibold text-yellow-500 text-xs uppercase tracking-wide">🎯 Como preencher</h4>
            <ul className="space-y-1 list-disc list-inside">
              <li>Os jogos já finalizados vêm preenchidos com o placar oficial dos 90 minutos — pode alterá-los para simular cenários alternativos</li>
              <li>No mata-mata, se você colocar <strong className="text-gray-200">empate</strong>, aparece a opção &quot;Avança para próxima fase&quot; — escolha o time classificado</li>
              <li>Times marcados como <strong className="text-gray-200">TBD</strong> são preenchidos automaticamente conforme os resultados das fases anteriores são simulados</li>
              <li>Jogos <strong className="text-green-500">ao vivo</strong> ficam bloqueados até o fim da partida</li>
              <li>Nada é salvo — use &quot;Limpar simulação&quot; para voltar aos resultados reais</li>
            </ul>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-semibold text-yellow-500 text-xs uppercase tracking-wide">⚽ Pontuação por jogo</h4>
            <ul className="space-y-0.5">
              <li className="flex justify-between gap-2"><span>Resultado certo (vitória/empate/derrota)</span><strong className="text-green-500 shrink-0">4 pts</strong></li>
              <li className="flex justify-between gap-2"><span>Gols exatos do time mandante</span><strong className="text-green-500 shrink-0">+1 pt</strong></li>
              <li className="flex justify-between gap-2"><span>Gols exatos do time visitante</span><strong className="text-green-500 shrink-0">+1 pt</strong></li>
              <li className="flex justify-between gap-2"><span>Placar exato completo</span><strong className="text-green-500 shrink-0">+2 pts</strong></li>
              <li className="flex justify-between gap-2"><span>Time fez ≥4 gols e você acertou quantos</span><strong className="text-green-500 shrink-0">+2 pts/time</strong></li>
              <li className="flex justify-between gap-2"><span>Classificação completa do grupo (1º ao 4º)</span><strong className="text-green-500 shrink-0">+2 pts/grupo</strong></li>
            </ul>
            <p className="text-xs text-gray-500">Máximo por jogo: 4 + 1 + 1 + 2 = 8 pontos (+ até 4 de bônus se algum time fizer ≥4 gols)</p>
          </div>
          <div className="space-y-1.5">
            <h4 className="font-semibold text-yellow-500 text-xs uppercase tracking-wide">🏆 Classificação no mata-mata</h4>
            <p className="text-xs">Pontos por cada time que você previu avançar em cada fase:</p>
            <ul className="space-y-0.5">
              <li className="flex justify-between gap-2"><span>16 avos (classificados dos grupos)</span><strong className="text-yellow-500 shrink-0">3 pts/time</strong></li>
              <li className="flex justify-between gap-2"><span>Oitavas de Final</span><strong className="text-yellow-500 shrink-0">4 pts/time</strong></li>
              <li className="flex justify-between gap-2"><span>Quartas de Final</span><strong className="text-yellow-500 shrink-0">6 pts/time</strong></li>
              <li className="flex justify-between gap-2"><span>Semifinal</span><strong className="text-yellow-500 shrink-0">8 pts/time</strong></li>
              <li className="flex justify-between gap-2"><span>Final</span><strong className="text-yellow-500 shrink-0">10 pts/time</strong></li>
              <li className="flex justify-between gap-2"><span>Campeão</span><strong className="text-yellow-500 shrink-0">+12 pts</strong></li>
            </ul>
            <p className="text-xs text-gray-500">
              Indicar quem avança num empate não soma pontos extras — serve como critério de desempate
              e para definir quem segue no chaveamento.
            </p>
          </div>
        </div>
      </details>

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
